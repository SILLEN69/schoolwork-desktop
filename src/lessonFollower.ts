import { z } from 'zod';
import type { AudioLanguage } from './lesson';

export type FollowVerdict = 'pass' | 'review';
export type FollowQuestion = { text: string; answer?: string; verdict?: FollowVerdict; feedback?: string };
export type FollowSegment = {
  id: string; heading: string; text: string; concepts: string[];
  source?: 'model' | 'offline';
  questions: FollowQuestion[]; status: 'pending' | 'answered' | 'skipped'; at?: number;
};
export type FollowReport = {
  totalSegments: number; completedSegments: number; skippedSegments: number;
  askedQuestions: number; answeredQuestions: number; skippedQuestions: number; reviewSegmentIds: string[];
};
export type FollowState = {
  sourceName?: string; structured: 'model' | 'offline';
  segments: FollowSegment[]; current: number; explainChatId?: string;
  finishedAt?: number; report?: FollowReport;
};
export type FollowLesson = {
  id: string; title: string; language: AudioLanguage; text: string;
  createdAt: number; updatedAt: number; follow: FollowState;
};

export const MAX_LESSON_CHARS = 200_000;
const MAX_SEGMENTS = 100;
const MAX_SEGMENT_WORDS = 320;
const MIN_TAIL_WORDS = 60;
export const MIN_ANSWER_WORDS = 3;
export const followImportSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  text: z.string().min(1).max(MAX_LESSON_CHARS),
  language: z.enum(['sv', 'en']),
  sourceName: z.string().max(240).optional(),
});

const wordCount = (s: string) => s.trim().match(/\S+/g)?.length ?? 0;

/** Deterministically splits a lesson document into readable parts for following. */
export function splitLessonText(raw: string, language: AudioLanguage = 'en'): { segments: FollowSegment[]; suggestedTitle: string } {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (!text) throw new Error('The lesson text is empty.');
  if (text.length > MAX_LESSON_CHARS) throw new Error(`The lesson is longer than ${MAX_LESSON_CHARS.toLocaleString('en')} characters. Split it into smaller parts.`);
  const lines = text.split('\n');
  const headingRe = /^#{1,6}\s+(.+?)\s*$/;
  type Piece = { heading: string; body: string };
  const pieces: Piece[] = [];
  if (lines.some(l => headingRe.test(l))) {
    let piece: Piece = { heading: '', body: '' };
    for (const line of lines) {
      const m = line.match(headingRe);
      if (m) {
        if (piece.heading || piece.body.trim()) pieces.push(piece);
        piece = { heading: m[1].trim(), body: '' };
      } else piece.body += (piece.body ? '\n' : '') + line;
    }
    if (piece.heading || piece.body.trim()) pieces.push(piece);
  } else {
    for (const para of text.split(/\n{2,}/)) { const body = para.trim(); if (body) pieces.push({ heading: '', body }); }
  }
  // A heading without content of its own belongs to the text that follows it.
  const blocks: Piece[] = [];
  let pendingHeading = '';
  for (const piece of pieces) {
    if (!piece.body.trim()) { if (piece.heading) pendingHeading = piece.heading; continue; }
    blocks.push({ heading: piece.heading || pendingHeading, body: piece.body.trim() });
    pendingHeading = '';
  }
  // A single block far beyond the budget (a headingless wall of text) is split at sentence boundaries.
  const sized: Piece[] = [];
  for (const block of blocks) {
    if (wordCount(block.body) <= MAX_SEGMENT_WORDS) { sized.push(block); continue; }
    const sentences = block.body.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/gu) ?? [block.body];
    let piece = '';
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if (piece && wordCount(piece) + wordCount(sentence) > MAX_SEGMENT_WORDS) { sized.push({ heading: block.heading, body: piece.trim() }); piece = ''; block.heading = ''; }
      piece += (piece ? ' ' : '') + sentence;
    }
    if (piece.trim()) sized.push({ heading: '', body: piece.trim() });
  }
  // A heading starts a new part; word budget keeps parts a readable length.
  const chunks: Piece[] = [];
  let bucket = ''; let heading = ''; let words = 0;
  const flush = () => { if (bucket.trim()) chunks.push({ heading, body: bucket.trim() }); bucket = ''; heading = ''; words = 0; };
  for (const block of sized) {
    const n = wordCount(block.body);
    if (bucket && (block.heading || words + n > MAX_SEGMENT_WORDS)) flush();
    if (!bucket) heading = block.heading;
    bucket += (bucket ? '\n\n' : '') + block.body;
    words += n;
  }
  flush();
  // A short, headingless leftover folds into the previous part; a short titled section stays its own part.
  const lastChunk = chunks.at(-1)!;
  if (chunks.length > 1 && !lastChunk.heading && wordCount(lastChunk.body) < MIN_TAIL_WORDS) {
    chunks.pop();
    chunks.at(-1)!.body += '\n\n' + lastChunk.body;
  }
  if (!chunks.length) throw new Error('The lesson text is empty.');
  if (chunks.length > MAX_SEGMENTS) throw new Error(`This lesson splits into more than ${MAX_SEGMENTS} parts. Shorten it first.`);
  const firstLine = (blocks.find(b => b.body.trim())?.body.split('\n').find(l => l.trim()) || '').trim();
  const suggestedTitle = (chunks[0].heading || firstLine).replace(/\s+/g, ' ').trim().slice(0, 80) || 'Lesson';
  // Parts without a heading of their own get a generated label from their first line.
  const label = (body: string, n: number) => {
    const line = body.split('\n').map(l => l.replace(/^[\s>#*•.\-()\d]+/, '').trim()).find(l => l.length >= 4) || '';
    const clean = line.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length >= 4) return clean.slice(0, 64) + (clean.length > 64 ? '…' : '');
    return language === 'sv' ? `Del ${n}` : `Part ${n}`;
  };
  return { segments: chunks.map((piece, i) => ({ id: crypto.randomUUID(), heading: piece.heading || label(piece.body, i + 1), text: piece.body, concepts: [], questions: [], status: 'pending' as const })), suggestedTitle };
}

const STOP_EN = new Set(['the','and','for','that','with','this','from','they','have','will','when','what','which','about','into','over','such','than','then','them','there','these','those','under','were','while','would','could','should','each','other','some','more','most','only','also','very','just','like','because','being','between','both','during','after','before','where','whose','does','done','using','used','uses','however','example','examples','since','through','without','within','upon','part','parts','segment','text','word','words','line','page','chapter','lesson','note','notes','shown','shown']);
const STOP_SV = new Set(['och','som','att','med','för','den','det','ett','en','av','till','är','var','på','ska','kan','har','hade','men','eller','om','dessa','denna','dette','så','man','vi','ni','hans','hennes','deras','sin','sitt','nu','här','der','när','vad','vem','vilket','vilka','inte','också','bara','mycket','del','delar','avsnitt','text','ord','mening','sidan','kapitel','lektion','blir','blev','finns','göra','gör','ska','särskilt','exempel','sådant','sådär','eftersom','innan','sedan','under','över','mellan','utan','vid','först','sen','mycket']);
const SV_MARKERS = ['och', 'som', 'att', 'med', 'för', 'den', 'det', 'ett', 'till', 'är', 'var', 'ska', 'har', 'men', 'eller', 'inte', 'kan', 'på', 'vid', 'blir', 'när', 'hur', 'varför'];
const EN_MARKERS = ['the', 'and', 'that', 'with', 'for', 'from', 'this', 'have', 'was', 'were', 'will', 'can', 'but', 'or', 'not', 'when', 'how', 'what', 'their', 'there', 'which'];

/** Heuristic lesson-language detection used when importing a file without a chosen language. */
export function detectLanguage(text: string): AudioLanguage {
  const words = (' ' + text.slice(0, 8000).toLocaleLowerCase('en').replace(/[^\p{L}\s]/gu, ' ')).split(' ');
  const count = (markers: string[]) => markers.reduce((sum, m) => sum + words.filter(w => w === m).length, 0);
  return count(SV_MARKERS) >= count(EN_MARKERS) ? 'sv' : 'en';
}

/** Deterministically extracts 0-5 key concepts: emphasized terms first, then frequent content words. */
export function extractKeyConcepts(text: string, language: AudioLanguage): string[] {
  const stop = language === 'sv' ? STOP_SV : STOP_EN;
  const found: { term: string; score: number; order: number }[] = [];
  const seen = new Map<string, number>();
  const add = (raw: string, weight: number) => {
    const term = raw.replace(/\s+/g, ' ').replace(/^[\s"'“”‘’`*_]+|[\s"'“”‘’`*_]+$/g, '').trim();
    if (term.length < 2 || term.length > 60) return;
    if (!/[\p{L}]{2}/u.test(term)) return;
    const key = term.toLocaleLowerCase('en');
    if (stop.has(key)) return;
    const index = seen.get(key);
    if (index === undefined) { seen.set(key, found.length); found.push({ term, score: weight, order: found.length }); }
    else found[index].score += weight;
  };
  for (const m of text.matchAll(/\*\*([^*\n]{2,60}?)\*\*|__([^_\n]{2,60}?)__|`([^`\n]{2,60}?)`/g)) add(m[1] || m[2] || m[3], 10);
  for (const m of text.matchAll(/“([^”\n]{2,60}?)”|‘([^’\n]{2,60}?)’|"([^"\n]{2,60}?)"|'([^'\n]{2,60}?)'/g)) add(m[1] || m[2] || m[3] || m[4], 8);
  const counts = new Map<string, { count: number; order: number; display: string }>();
  for (const m of text.matchAll(/[\p{L}][\p{L}'’\-]{2,28}/gu)) {
    const word = m[0], key = word.toLocaleLowerCase('en');
    if (stop.has(key)) continue;
    const entry = counts.get(key) || { count: 0, order: counts.size, display: word };
    entry.count++;
    counts.set(key, entry);
  }
  for (const entry of [...counts.values()].sort((a, b) => b.count - a.count || a.order - b.order)) {
    if (entry.count >= 2) add(entry.display, Math.min(6, entry.count));
  }
  if (found.length < 2) {
    for (const entry of [...counts.values()].sort((a, b) => a.order - b.order)) {
      if (found.length >= 2) break;
      if (entry.count === 1) add(entry.display, 3);
    }
  }
  found.sort((a, b) => b.score - a.score || a.order - b.order);
  return found.slice(0, 5).map(f => f.term);
}

/** Strict JSON contract for model-structured lessons: 4-10 titled segments, 2-5 concepts each. */
export const followSegmentInputSchema = z.object({
  heading: z.string().trim().min(3).max(80),
  text: z.string().trim().min(20).max(4000),
  concepts: z.array(z.string().trim().min(2).max(60)).min(2).max(5),
});
export const followStructureSchema = z.object({ segments: z.array(followSegmentInputSchema).min(4).max(10) });

/** Composes the "Explain more" request sent through the existing Work send path. */
export function buildExplainRequest(lesson: FollowLesson, segment: FollowSegment): { userText: string; reference: string } {
  const userText = lesson.language === 'sv'
    ? `Förklara det här avsnittet från lektionen "${lesson.title}" mer ingående: "${segment.heading}". Var tydlig och pedagogisk, ge minst ett konkret exempel och peka på det som är viktigast att förstå innan jag går vidare.`
    : `Explain this part of the lesson "${lesson.title}" in more depth: "${segment.heading}". Be clear and pedagogical, give at least one concrete example, and point out what matters most to understand before moving on.`;
  const reference = JSON.stringify({ title: lesson.title, part: { heading: segment.heading, text: segment.text.slice(0, 12_000), concepts: segment.concepts } });
  return { userText, reference };
}

const OFFLINE_QUESTIONS: Record<AudioLanguage, string[][]> = {
  en: [
    ['List two key concepts from this part from memory and give each a one-sentence explanation.', 'Explain the main idea of this part in your own words.'],
    ['List two key concepts from this part from memory and give each a one-sentence explanation.', 'Which example, number, or formula in this part matters most? Why?'],
    ['List two key concepts from this part from memory and give each a one-sentence explanation.', 'Summarise this part in two or three sentences, as if explaining it to a classmate.'],
  ],
  sv: [
    ['Notera två viktiga begrepp ur det här avsnittet ur minnet och ge varje en kort förklaring.', 'Förklara det huvudsakliga innehållet i det här avsnittet med egna ord.'],
    ['Notera två viktiga begrepp ur det här avsnittet ur minnet och ge varje en kort förklaring.', 'Vilket exempel, tal eller formel i avsnittet är viktigast? Varför?'],
    ['Notera två viktiga begrepp ur det här avsnittet ur minnet och ge varje en kort förklaring.', 'Sammanfatta avsnittet på två till tre meningar, som om du förklarade det för en klasskamrat.'],
  ],
};

/** Deterministic recall prompts used when no model is available. */
export function offlineQuestions(language: AudioLanguage, segmentIndex: number): string[] {
  const bank = OFFLINE_QUESTIONS[language];
  return bank[Math.max(0, Math.trunc(segmentIndex)) % bank.length];
}

export function heuristicVerdict(answer: string): FollowVerdict {
  return wordCount(answer) >= MIN_ANSWER_WORDS ? 'pass' : 'review';
}

/** A part needs review when it was skipped, never reached, or answered with gaps. */
export function segmentFlagged(segment: FollowSegment): boolean {
  if (segment.status !== 'answered') return true;
  return segment.questions.some(q => q.verdict === 'review' || !(q.answer ?? '').trim());
}

export function computeFollowReport(state: FollowState): FollowReport {
  const segments = state.segments;
  const completedSegments = segments.filter(s => s.status === 'answered').length;
  const questions = segments.flatMap(s => s.questions);
  const answeredQuestions = questions.filter(q => (q.answer ?? '').trim()).length;
  return {
    totalSegments: segments.length,
    completedSegments,
    skippedSegments: segments.length - completedSegments,
    askedQuestions: questions.length,
    answeredQuestions,
    skippedQuestions: questions.length - answeredQuestions,
    reviewSegmentIds: segments.filter(segmentFlagged).map(s => s.id),
  };
}

export function firstFlaggedIndex(state: FollowState): number {
  return state.segments.findIndex(segmentFlagged);
}

export const followQuestionsSchema = z.object({ questions: z.array(z.string().trim().min(6).max(240)).min(1).max(3) });
export const followVerdictsSchema = z.object({
  results: z.array(z.object({ verdict: z.enum(['pass', 'review']), feedback: z.string().trim().max(160) })).min(1).max(3),
});

/** Models often wrap the JSON in a code fence even when told not to. */
export function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}
