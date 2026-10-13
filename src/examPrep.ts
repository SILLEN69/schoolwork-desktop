import { z } from 'zod';
import type { AudioLanguage } from './lesson';
import { extractKeyConcepts, splitLessonText } from './lessonFollower';

export type ExamQuestionKind = 'mc' | 'short' | 'explain';
export type ExamQuestion = {
  id: string;
  kind: ExamQuestionKind;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  /** The model answer or what a good answer must contain; used for grading in phase 2. */
  reference: string;
};
export type ExamAnswer = { optionIndex?: number; text?: string; flagged?: boolean };
export type ExamStatus = 'ready' | 'in_progress' | 'submitted';
export type ExamState = {
  status: ExamStatus;
  startedAt?: number;
  submittedAt?: number;
  timeUsedMs?: number;
  autoSubmitted?: boolean;
  answers: Record<string, ExamAnswer>;
  /** Per-question grades, keyed by question id. Re-grading replaces entries; it never appends. */
  grades?: Record<string, QuestionGrade>;
  /** Where the model-grading run stands; absent until the first submit/grade. */
  grading?: ExamGrading;
};
export type ExamDocument = {
  id: string;
  title: string;
  language: AudioLanguage;
  sourceKind: 'lesson' | 'notes';
  sourceLessonId?: string;
  sourceTitle: string;
  sourceText: string;
  questions: ExamQuestion[];
  durationMin: number;
  builtWith: 'model' | 'offline';
  createdAt: number;
  updatedAt: number;
  state: ExamState;
};
export type ExamSummary = {
  id: string;
  title: string;
  sourceKind: 'lesson' | 'notes';
  sourceTitle: string;
  questionCount: number;
  durationMin: number;
  status: ExamStatus;
  builtWith: 'model' | 'offline';
  createdAt: number;
  updatedAt: number;
};
export type ExamPart = { heading: string; text: string; concepts: string[] };

export const EXAM_MIN_QUESTIONS = 8;
export const EXAM_MAX_QUESTIONS = 12;
export const MIN_NOTES_CHARS = 200;
export const MAX_NOTES_CHARS = 200_000;
export const MIN_OFFLINE_QUESTIONS = 4;
export const MAX_OFFLINE_QUESTIONS = 12;
export const MAX_EXAM_ANSWER_CHARS = 4000;

// --- Strict model JSON contract ---------------------------------------------
const EXAM_OPTION = z.string().trim().min(2).max(120);
const EXAM_PROMPT = z.string().trim().min(6).max(300);
const EXAM_REFERENCE = z.string().trim().min(2).max(800);
export const examQuestionInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('mc'),
    prompt: EXAM_PROMPT,
    options: z.tuple([EXAM_OPTION, EXAM_OPTION, EXAM_OPTION, EXAM_OPTION]).refine(
      options => new Set(options.map(o => o.toLocaleLowerCase('en'))).size === 4, 'Duplicate exam option.',
    ),
    answer: z.number().int().min(0).max(3),
    reference: EXAM_REFERENCE,
  }),
  z.object({ kind: z.literal('short'), prompt: EXAM_PROMPT, reference: EXAM_REFERENCE.min(10) }),
  z.object({ kind: z.literal('explain'), prompt: EXAM_PROMPT, reference: EXAM_REFERENCE.min(20) }),
]);

/** 8-12 questions mixing types: at least one multiple choice, at least one short answer, exactly one explain. */
export const examInputSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  questions: z.array(examQuestionInputSchema).min(EXAM_MIN_QUESTIONS).max(EXAM_MAX_QUESTIONS).superRefine((questions, ctx) => {
    const count = (kind: ExamQuestionKind) => questions.filter(q => q.kind === kind).length;
    if (count('explain') !== 1) ctx.addIssue({ code: 'custom', message: 'The exam needs exactly one explain question.' });
    if (!count('short')) ctx.addIssue({ code: 'custom', message: 'The exam needs at least one short answer question.' });
    if (!count('mc')) ctx.addIssue({ code: 'custom', message: 'The exam needs at least one multiple choice question.' });
  }),
  durationMin: z.number().int().min(5).max(120).optional(),
});

// --- Timer -------------------------------------------------------------------
/** Three minutes per question, clamped to 10-60 minutes. */
export function defaultDurationMin(questionCount: number): number {
  return Math.max(10, Math.min(60, questionCount * 3));
}

export function examClock(endsAt: number, now: number): { remainingMs: number; expired: boolean } {
  const remainingMs = Math.max(0, endsAt - now);
  return { remainingMs, expired: endsAt <= now };
}

export function formatExamClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

// --- Deterministic offline exam ----------------------------------------------
function hashString(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}

const dedupe = (list: string[]) => [...new Map(list.map(x => [x.trim().toLocaleLowerCase('en'), x.trim()])).values()].filter(Boolean);

function sentenceAbout(text: string, term: string): string {
  const sentences = (text.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/gu) ?? []).map(s => s.trim()).filter(Boolean);
  const key = term.toLocaleLowerCase('en');
  const hit = sentences.find(s => s.toLocaleLowerCase('en').includes(key));
  const picked = (hit || sentences[0] || text.trim()).replace(/\s+/g, ' ');
  return picked.length > 300 ? picked.slice(0, 299).trimEnd() + '…' : picked;
}

/**
 * Deterministically builds multiple-choice exam questions from the parts' stored key
 * concepts. Two formats, both faithful to the source: which concept belongs to a part,
 * and in which part a unique term is introduced. Throws when the content is too thin
 * for a usable exam.
 */
export function offlineExamQuestions(language: AudioLanguage, parts: ExamPart[]): Omit<ExamQuestion, 'id'>[] {
  const byKey = (x: string) => x.trim().toLocaleLowerCase('en');
  const headings = dedupe(parts.map(p => p.heading)).filter(h => h.length >= 3);
  const concepts = parts.filter(p => p.concepts.length);
  if (headings.length < 4 || concepts.length < 2) {
    throw new Error(language === 'sv'
      ? 'Innehållet är för tunt för ett offlineprov — flera avsnitt med nyckelbegrepp behövs.'
      : 'The content is too thin for an offline exam — several parts with key concepts are needed.');
  }
  // Terms that only ever appear in one part can be asked about unambiguously.
  const uniqueOwners = new Map<string, number>();
  parts.forEach((part, i) => {
    for (const concept of part.concepts) {
      const key = byKey(concept);
      if (!key) continue;
      if (uniqueOwners.has(key)) uniqueOwners.delete(key);
      else uniqueOwners.set(key, i);
    }
  });
  const questions: Omit<ExamQuestion, 'id'>[] = [];
  const usedTerms = new Set<string>();
  const firstUniqueTerm = (partIndex: number) =>
    parts[partIndex].concepts.map(c => c.trim()).find(c => { const key = byKey(c); return key && uniqueOwners.get(key) === partIndex && !usedTerms.has(key); });
  // Pass 1: one "which concept belongs to this part" question per part, in lesson order.
  for (let i = 0; i < parts.length && questions.length < MAX_OFFLINE_QUESTIONS; i++) {
    const part = parts[i];
    const term = firstUniqueTerm(i);
    if (!term) continue;
    const distractors = new Map<string, string>();
    for (let j = 0; j < parts.length && distractors.size < 3; j++) {
      if (j === i) continue;
      for (const candidate of parts[j].concepts) {
        if (distractors.size >= 3) break;
        const key = byKey(candidate);
        if (key && key !== byKey(term) && !distractors.has(key)) distractors.set(key, candidate.trim());
      }
    }
    if (distractors.size < 3) continue;
    usedTerms.add(byKey(term));
    const options = [...distractors.values()];
    options.splice(hashString(language + '|' + part.heading + '|' + term) % 4, 0, term);
    questions.push({
      kind: 'mc',
      prompt: language === 'sv' ? `Vilket av dessa begrepp behandlas i avsnittet ${part.heading}?` : `Which of these concepts is covered in the part "${part.heading}"?`,
      options: options as [string, string, string, string],
      correctIndex: options.indexOf(term),
      reference: sentenceAbout(part.text, term),
    });
  }
  // Pass 2: "in which part is this term introduced" questions with the part headings as options.
  for (let i = 0; i < parts.length && questions.length < MAX_OFFLINE_QUESTIONS; i++) {
    const part = parts[i];
    if (!part.heading) continue;
    const term = firstUniqueTerm(i);
    if (!term) continue;
    usedTerms.add(byKey(term));
    const others = dedupe(parts.filter(p => p !== part && p.heading && p.heading !== part.heading).map(p => p.heading)).slice(0, 3);
    if (others.length < 3) continue;
    const options = [...others];
    options.splice(hashString(language + '|intro|' + part.heading + '|' + term) % 4, 0, part.heading);
    questions.push({
      kind: 'mc',
      prompt: language === 'sv' ? `I vilket avsnitt introduceras "${term}"?` : `In which part is "${term}" introduced?`,
      options: options as [string, string, string, string],
      correctIndex: options.indexOf(part.heading),
      reference: sentenceAbout(part.text, term),
    });
  }
  if (questions.length < MIN_OFFLINE_QUESTIONS) {
    throw new Error(language === 'sv'
      ? 'Innehållet ger färre än fyra säkra flervalsfrågor — lägg till mer material eller konfigurera en API-nyckel.'
      : 'The content yields fewer than four reliable multiple-choice questions — add more material or configure an API key.');
  }
  return questions;
}

/** Splits raw notes into parts with key concepts, for an offline exam built from pasted notes. */
export function notesToParts(text: string, language: AudioLanguage): ExamPart[] {
  return splitLessonText(text, language).segments.map(s => ({ heading: s.heading, text: s.text, concepts: extractKeyConcepts(s.text, language) }));
}

// --- Grading (phase 2) ------------------------------------------------------
export type GradeVerdict = 'correct' | 'partial' | 'wrong' | 'needs_review';
export type QuestionGrade = {
  verdict: GradeVerdict;
  /** Score 0-1, or null when no numeric claim is made (needs_review). */
  score: number | null;
  rationale?: string;
  gradedAt: number;
  gradedWith: 'local' | 'model' | 'none';
};
export type GradingStatus = 'idle' | 'running' | 'done' | 'error';
export type ExamGrading = {
  status: GradingStatus;
  model?: string;
  startedAt?: number;
  finishedAt?: number;
};
export type GradingEvent = 'start' | 'complete' | 'fail';

/** Verdict thresholds for a model-graded score: >= 0.85 correct, >= 0.45 partial (uncertain), below wrong. */
export const CORRECT_SCORE_FLOOR = 0.85;
export const PARTIAL_SCORE_FLOOR = 0.45;

export function verdictForScore(score: number): 'correct' | 'partial' | 'wrong' {
  const clamped = Math.max(0, Math.min(1, score));
  if (clamped >= CORRECT_SCORE_FLOOR) return 'correct';
  if (clamped >= PARTIAL_SCORE_FLOOR) return 'partial';
  return 'wrong';
}

/** Local multiple-choice grading: exact, instant, never needs review. */
export function gradeMcQuestion(
  question: Pick<ExamQuestion, 'kind' | 'options' | 'correctIndex'>,
  answer: ExamAnswer | undefined,
  gradedAt = Date.now(),
): QuestionGrade {
  const correct = question.correctIndex !== undefined && answer?.optionIndex === question.correctIndex;
  return { verdict: correct ? 'correct' : 'wrong', score: correct ? 1 : 0, gradedAt, gradedWith: 'local' };
}

/** Grades every multiple-choice question; short and explain questions are left to the model (or manual review). */
export function gradeMcExam(questions: ExamQuestion[], answers: Record<string, ExamAnswer>, gradedAt = Date.now()): Record<string, QuestionGrade> {
  const grades: Record<string, QuestionGrade> = {};
  for (const question of questions) if (question.kind === 'mc') grades[question.id] = gradeMcQuestion(question, answers[question.id], gradedAt);
  return grades;
}

/** A free-text question that the model cannot grade is marked for manual review, never auto-graded. */
export function needsReviewGrade(rationale?: string, gradedAt = Date.now()): QuestionGrade {
  return { verdict: 'needs_review', score: null, ...(rationale ? { rationale } : {}), gradedAt, gradedWith: 'none' };
}

/** The grading state machine. Invalid transitions are no-ops so a stale event can never corrupt the state. */
export function gradingTransition(status: GradingStatus, event: GradingEvent): GradingStatus {
  switch (status) {
    case 'idle': return event === 'start' ? 'running' : 'idle';
    case 'running': return event === 'complete' ? 'done' : event === 'fail' ? 'error' : 'running';
    case 'done':
    case 'error': return event === 'start' ? 'running' : status; // re-grade
  }
}

/** A grading run can be (re)started except while one is running. */
export function canGrade(status: GradingStatus | undefined): boolean {
  return status !== 'running';
}

export type ExamScoreSummary = {
  correct: number; partial: number; wrong: number; needsReview: number;
  scored: number; total: number;
  /** Average of the numeric scores, as a 0-100 percentage; 0 when nothing is numerically scored. */
  percent: number;
};

export function examScoreSummary(questions: ExamQuestion[], grades: Record<string, QuestionGrade>): ExamScoreSummary {
  let correct = 0, partial = 0, wrong = 0, needsReview = 0, scoreSum = 0, scored = 0;
  for (const question of questions) {
    const grade = grades[question.id];
    if (!grade) continue;
    if (grade.verdict === 'correct') correct++;
    else if (grade.verdict === 'partial') partial++;
    else if (grade.verdict === 'wrong') wrong++;
    else needsReview++;
    if (typeof grade.score === 'number') { scoreSum += Math.max(0, Math.min(1, grade.score)); scored++; }
  }
  return { correct, partial, wrong, needsReview, scored, total: questions.length, percent: scored ? Math.round((scoreSum / scored) * 100) : 0 };
}

/** Wrong, partial (uncertain) and needs-review questions in exam order — exactly what the mistake review walks. */
export function missedQuestions(doc: Pick<ExamDocument, 'questions' | 'state'>): ExamQuestion[] {
  const grades = doc.state.grades ?? {};
  return doc.questions.filter(question => {
    const grade = grades[question.id];
    return grade ? grade.verdict !== 'correct' : question.kind !== 'mc';
  });
}

/** Strict contract for one model-graded question: a 0-1 score plus a one-line rationale. */
export const gradeResultSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string().trim().min(5).max(160),
});

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
};

/** Composes the deeper-study message for missed questions; goes through the normal conversation send path. */
export function missedTopicsMessage(
  doc: Pick<ExamDocument, 'title' | 'language' | 'questions' | 'state'>,
  questionIds: string[],
): string {
  const swedish = doc.language === 'sv';
  const byId = new Map(doc.questions.map(q => [q.id, q]));
  const picked = questionIds.map(id => byId.get(id)).filter((q): q is ExamQuestion => Boolean(q));
  const grades = doc.state.grades ?? {};
  const answerText = (q: ExamQuestion) => {
    const answer = doc.state.answers[q.id];
    if (q.kind === 'mc' && answer?.optionIndex !== undefined && q.options) return q.options[answer.optionIndex];
    return answer?.text?.trim() || '';
  };
  const lines = picked.map((q, i) => {
    const grade = grades[q.id];
    const parts = [`${i + 1}. ${q.prompt}`];
    const answer = answerText(q);
    parts.push((swedish ? 'Mitt svar: ' : 'My answer: ') + (answer ? clip(answer, 300) : swedish ? '(inga svar)' : '(no answer)'));
    parts.push((swedish ? 'Så ska det vara: ' : 'What a good answer looks like: ') + clip(q.reference, 300));
    if (grade?.rationale) parts.push((swedish ? 'Bedömning: ' : 'Grading note: ') + clip(grade.rationale, 160));
    return parts.join(' ');
  });
  const header = swedish
    ? `Jag repeterar misstag från övningsprovet “${doc.title}”. Förklara varför svaren är felaktiga eller ofullständiga, gå igenom varje fråga och ge ett extra exempel eller en övningsfråga per ämne.`
    : `I am reviewing my mistakes from the practice exam “${doc.title}”. Explain why each answer is wrong or incomplete, walk through each question, and give one extra example or practice question per topic.`;
  return [header, '', ...lines].join('\n');
}
