import { expect, it } from 'vitest';
import {
  CORRECT_SCORE_FLOOR, defaultDurationMin, examClock, examInputSchema, examScoreSummary,
  formatExamClock, gradeMcExam, gradeMcQuestion, gradingTransition, gradeResultSchema,
  missedQuestions, missedTopicsMessage, notesToParts, offlineExamQuestions, PARTIAL_SCORE_FLOOR,
  verdictForScore,
  type ExamQuestion,
} from './examPrep';

const MC = (id: string, correctIndex = 0): ExamQuestion => ({
  id, kind: 'mc', prompt: 'Where do the light reactions take place?',
  options: ['In the thylakoids', 'In the stroma', 'In the nucleus', 'In the mitochondrion'],
  correctIndex, reference: 'The light reactions happen in the thylakoids.',
});
const SHORT = (id: string): ExamQuestion => ({ id, kind: 'short', prompt: 'What do the light reactions produce?', reference: 'ATP and NADPH.' });
const EXPLAIN = (id: string): ExamQuestion => ({ id, kind: 'explain', prompt: 'Explain the Calvin cycle.', reference: 'The Calvin cycle fixes carbon dioxide into sugar in the stroma.' });

it('maps model scores to verdicts with stable thresholds and clamps out-of-range scores', () => {
  expect(verdictForScore(0)).toBe('wrong');
  expect(verdictForScore(PARTIAL_SCORE_FLOOR - 0.01)).toBe('wrong');
  expect(verdictForScore(PARTIAL_SCORE_FLOOR)).toBe('partial');
  expect(verdictForScore(CORRECT_SCORE_FLOOR - 0.01)).toBe('partial');
  expect(verdictForScore(CORRECT_SCORE_FLOOR)).toBe('correct');
  expect(verdictForScore(1)).toBe('correct');
  expect(verdictForScore(-3)).toBe('wrong');
  expect(verdictForScore(7)).toBe('correct');
});

it('grades multiple choice locally and immediately, including missing answers', () => {
  const question = MC('q1');
  expect(gradeMcQuestion(question, { optionIndex: 0 }, 42)).toEqual({ verdict: 'correct', score: 1, gradedAt: 42, gradedWith: 'local' });
  expect(gradeMcQuestion(question, { optionIndex: 2 }, 42)).toEqual({ verdict: 'wrong', score: 0, gradedAt: 42, gradedWith: 'local' });
  expect(gradeMcQuestion(question, undefined, 42)).toEqual({ verdict: 'wrong', score: 0, gradedAt: 42, gradedWith: 'local' });
  expect(gradeMcQuestion(question, { optionIndex: 4 }, 42).verdict).toBe('wrong');
  expect(gradeMcExam([question, SHORT('q2'), EXPLAIN('q3')], { [question.id]: { optionIndex: 0 } }, 7).q1).toMatchObject({ verdict: 'correct', gradedWith: 'local' });
  expect(Object.keys(gradeMcExam([question, SHORT('q2')], {}, 7))).toEqual([question.id]);
});

it('sums the exam score across verdicts and excludes needs-review from the percentage', () => {
  const questions = [MC('q1'), MC('q2'), SHORT('q3'), EXPLAIN('q4')];
  const summary = examScoreSummary(questions, {
    q1: { verdict: 'correct', score: 1, gradedAt: 1, gradedWith: 'local' },
    q2: { verdict: 'partial', score: 0.7, gradedAt: 1, gradedWith: 'model' },
    q3: { verdict: 'wrong', score: 0, gradedAt: 1, gradedWith: 'model' },
    q4: { verdict: 'needs_review', score: null, gradedAt: 1, gradedWith: 'none' },
  });
  expect(summary).toMatchObject({ correct: 1, partial: 1, wrong: 1, needsReview: 1, scored: 3, total: 4, percent: 57 });
  expect(examScoreSummary(questions, {})).toMatchObject({ percent: 0, scored: 0 });
});

it('runs the grading state machine and treats invalid transitions as no-ops', () => {
  expect(gradingTransition('idle', 'start')).toBe('running');
  expect(gradingTransition('idle', 'complete')).toBe('idle');
  expect(gradingTransition('idle', 'fail')).toBe('idle');
  expect(gradingTransition('running', 'start')).toBe('running');
  expect(gradingTransition('running', 'complete')).toBe('done');
  expect(gradingTransition('running', 'fail')).toBe('error');
  expect(gradingTransition('done', 'start')).toBe('running'); // re-grade
  expect(gradingTransition('done', 'fail')).toBe('done');
  expect(gradingTransition('error', 'start')).toBe('running'); // retry after failure
  expect(gradingTransition('error', 'complete')).toBe('error');
});

it('selects exactly the missed and uncertain questions for the mistake review, in exam order', () => {
  const questions = [MC('q1'), MC('q2'), SHORT('q3'), EXPLAIN('q4')];
  const doc = {
    questions,
    state: {
      status: 'submitted' as const,
      answers: {},
      grades: {
        q1: { verdict: 'correct' as const, score: 1, gradedAt: 1, gradedWith: 'local' as const },
        q2: { verdict: 'wrong' as const, score: 0, gradedAt: 1, gradedWith: 'local' as const },
        q3: { verdict: 'partial' as const, score: 0.6, gradedAt: 1, gradedWith: 'model' as const },
        q4: { verdict: 'needs_review' as const, score: null, gradedAt: 1, gradedWith: 'none' as const },
      },
    },
  };
  expect(missedQuestions(doc).map(q => q.id)).toEqual(['q2', 'q3', 'q4']);
  expect(missedQuestions({ ...doc, state: { ...doc.state, grades: undefined } }).map(q => q.id)).toEqual(['q3', 'q4']);
});

it('validates the strict model grading contract', () => {
  expect(gradeResultSchema.parse({ score: 0.5, rationale: 'Mostly right.' })).toEqual({ score: 0.5, rationale: 'Mostly right.' });
  expect(() => gradeResultSchema.parse({ score: 1.5, rationale: 'Too high.' })).toThrow();
  expect(() => gradeResultSchema.parse({ score: -0.1, rationale: 'Too low.' })).toThrow();
  expect(() => gradeResultSchema.parse({ score: 0.5, rationale: 'no' })).toThrow();
  expect(() => gradeResultSchema.parse({ score: 0.5, rationale: 'x'.repeat(161) })).toThrow();
});

it('composes the missed-topics conversation message in both languages', () => {
  const questions = [MC('q1', 1), SHORT('q3'), EXPLAIN('q4')];
  const state = {
    status: 'submitted' as const,
    answers: {
      q1: { optionIndex: 3 },
      q3: { text: 'ATP' },
      q4: { text: 'It happens in the stroma.' },
    },
    grades: {
      q1: { verdict: 'wrong' as const, score: 0, gradedAt: 1, gradedWith: 'local' as const },
      q3: { verdict: 'partial' as const, score: 0.5, gradedAt: 1, gradedWith: 'model' as const, rationale: 'Missing NADPH.' },
      q4: { verdict: 'needs_review' as const, score: null, gradedAt: 1, gradedWith: 'none' as const },
    },
  };
  const english = missedTopicsMessage({ title: 'Photosynthesis', language: 'en', questions, state }, ['q1', 'q3', 'q4']);
  expect(english).toContain('Photosynthesis');
  expect(english).toContain('1. Where do the light reactions take place?');
  expect(english).toContain('In the mitochondrion'); // the wrong MC option the student picked
  expect(english).toContain('My answer: ATP');
  expect(english).toContain('Grading note: Missing NADPH.');
  expect(english).toContain('The Calvin cycle fixes carbon dioxide into sugar in the stroma.');
  expect(english).not.toContain('(no answer)');
  const swedish = missedTopicsMessage({ title: 'Fotosyntes', language: 'sv', questions, state }, ['q4']);
  expect(swedish).toContain('Jag repeterar misstag från övningsprovet “Fotosyntes”');
  expect(swedish).toContain('Mitt svar: It happens in the stroma.');
  expect(swedish).toContain('Så ska det vara:');
});

it('builds a deterministic offline exam with valid multiple-choice questions', () => {
  const notes = [
    '# Photosynthesis', 'Plants use light to make sugar in the chloroplasts.', 'Chlorophyll captures the light energy.', '',
    '## Light reactions', 'The light reactions happen in the thylakoids and produce ATP.', 'NADPH is also generated for the next stage.', '',
    '## Calvin cycle', 'The Calvin cycle fixes carbon dioxide into sugar in the stroma.', 'This stage does not need light directly.', '',
    '## Cellular respiration', 'Cells break down glucose and release energy as ATP.', 'It happens in the mitochondrion of the cell.',
  ].join('\n');
  const parts = notesToParts(notes, 'en');
  const questions = offlineExamQuestions('en', parts);
  expect(questions.length).toBeGreaterThanOrEqual(4);
  for (const question of questions) {
    expect(question.kind).toBe('mc');
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options!.map(o => o.toLocaleLowerCase('en'))).size).toBe(4);
    expect(question.correctIndex).toBeGreaterThanOrEqual(0);
    expect(question.correctIndex).toBeLessThanOrEqual(3);
    expect(question.reference.length).toBeGreaterThan(0);
  }
});

it('enforces the exam question mix in the strict input schema', () => {
  const mc = (prompt: string) => ({ kind: 'mc' as const, prompt, options: ['One', 'Two', 'Three', 'Four'], answer: 0, reference: 'One is right.' });
  const base = {
    questions: [mc('Where are the light reactions?'), mc('Which pigment captures light?'), mc('Where does the Calvin cycle work?'), mc('What breaks down glucose?'), mc('What do the light reactions make?'),
      { kind: 'short' as const, prompt: 'Name the pigment.', reference: 'Chlorophyll captures light energy in the leaf.' },
      { kind: 'short' as const, prompt: 'Name the product.', reference: 'The light reactions produce ATP and NADPH for the cell.' },
      { kind: 'explain' as const, prompt: 'Explain the Calvin cycle in a few sentences.', reference: 'The Calvin cycle fixes carbon dioxide into sugar in the stroma.' }],
  };
  expect(examInputSchema.parse(base).questions).toHaveLength(8);
  expect(() => examInputSchema.parse({ questions: base.questions.slice(0, 7) })).toThrow(); // 7 questions
  expect(() => examInputSchema.parse({ ...base, questions: base.questions.filter(q => q.kind !== 'explain') })).toThrow(); // no explain
});

it('computes the default duration, the countdown clock and its display format', () => {
  expect(defaultDurationMin(4)).toBe(12);
  expect(defaultDurationMin(10)).toBe(30);
  expect(defaultDurationMin(40)).toBe(60);
  expect(examClock(1000, 400)).toEqual({ remainingMs: 600, expired: false });
  expect(examClock(1000, 1000).expired).toBe(true);
  expect(formatExamClock(0)).toBe('00:00');
  expect(formatExamClock(61_000)).toBe('01:01');
  expect(formatExamClock(-500)).toBe('00:00');
});
