import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExamPrep } from './examPrep';
import { SchoolWorkStore } from './storage';
import type { ExamDocument, ExamQuestion } from '../src/examPrep';

let dir: string, store: SchoolWorkStore;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-exam-'));
  store = new SchoolWorkStore(dir);
});
afterEach(() => {
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const noKey = () => { throw new Error('Add your TeachGPT API key in Settings.'); };
const fastWait = async (_ms: number, _signal: AbortSignal) => {};
const sse = (text: string) => new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
const EXAM_ID = '3f2c1a0e-1111-4222-8333-444455556666';
const NOW = 1_700_000_000_000;
const QUESTIONS: ExamQuestion[] = [
  { id: 'q-mc-1', kind: 'mc', prompt: 'Where do the light reactions take place?', options: ['In the thylakoids', 'In the stroma', 'In the nucleus', 'In the mitochondrion'], correctIndex: 0, reference: 'The light reactions happen in the thylakoids.' },
  { id: 'q-mc-2', kind: 'mc', prompt: 'Which pigment captures light?', options: ['Glucose', 'Chlorophyll', 'ATP', 'Carbon dioxide'], correctIndex: 1, reference: 'Chlorophyll captures the light.' },
  { id: 'q-short-1', kind: 'short', prompt: 'What do the light reactions produce for the Calvin cycle?', reference: 'ATP and NADPH.' },
  { id: 'q-explain-1', kind: 'explain', prompt: 'Explain where and how the Calvin cycle works.', reference: 'The Calvin cycle fixes carbon dioxide into sugar in the stroma.' },
];
const makeExam = (state: Partial<ExamDocument['state']> = {}, status: ExamDocument['state']['status'] = 'in_progress'): ExamDocument => ({
  id: EXAM_ID, title: 'Photosynthesis practice', language: 'en', sourceKind: 'notes', sourceTitle: 'Photosynthesis',
  sourceText: 'Plants make sugar using light in the chloroplasts. Chlorophyll captures the light. The light reactions happen in the thylakoids and produce ATP and NADPH. The Calvin cycle fixes carbon dioxide into sugar in the stroma.',
  questions: QUESTIONS, durationMin: 10, builtWith: 'model', createdAt: NOW, updatedAt: NOW,
  state: { status, startedAt: NOW - 60_000, answers: {}, ...state },
});
const ANSWERS = {
  'q-mc-1': { optionIndex: 0 },
  'q-mc-2': { optionIndex: 0 },
  'q-short-1': { text: 'ATP.' },
  'q-explain-1': {},
};
const ANSWERS_FULL = {
  ...ANSWERS,
  'q-explain-1': { text: 'It happens in the stroma and fixes carbon dioxide into sugar.' },
};
const gradeJson = (score: number, rationale: string) => JSON.stringify({ score, rationale });

it('submits: grades multiple choice locally and immediately, marks free text for manual review without a model', async () => {
  const fetcher = vi.fn() as typeof fetch;
  const exams = new ExamPrep(store, noKey, fetcher, fastWait);
  store.saveExam(makeExam());
  const doc = exams.submit(EXAM_ID, ANSWERS, 'Qwen3.8-27B');
  expect(doc.state.status).toBe('submitted');
  expect(doc.state.answers['q-explain-1']).toBeUndefined(); // the empty answer is frozen out
  expect(doc.state.grades!['q-mc-1']).toMatchObject({ verdict: 'correct', score: 1, gradedWith: 'local' });
  expect(doc.state.grades!['q-mc-2']).toMatchObject({ verdict: 'wrong', score: 0, gradedWith: 'local' });
  expect(doc.state.grades!['q-short-1']).toMatchObject({ verdict: 'needs_review', score: null, gradedWith: 'none' });
  expect(doc.state.grades!['q-explain-1']).toMatchObject({ verdict: 'wrong', score: 0, gradedWith: 'local' }); // empty free text, graded locally
  expect(doc.state.grading).toMatchObject({ status: 'done' });
  expect(fetcher).not.toHaveBeenCalled();
  // A speech model is not a usable grader either.
  const speech = new ExamPrep(store, () => 'test-credential', fetcher, fastWait);
  store.saveExam(makeExam());
  const speechDoc = speech.submit(EXAM_ID, ANSWERS, 'kb-whisper-large');
  expect(speechDoc.state.grades!['q-short-1'].verdict).toBe('needs_review');
  expect(fetcher).not.toHaveBeenCalled();
});

it('grades free text against the source with the model and stores per-question score and rationale', async () => {
  const fetcher = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse((init as RequestInit).body as string);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-credential' });
    expect(body.model).toBe('Qwen3.8-27B');
    const user = JSON.parse(body.messages[1].content);
    expect(user.source.title).toBe('Photosynthesis');
    expect(user.source.text).toContain('thylakoids');
    expect(user.reference).toBeTruthy();
    if (user.prompt.includes('Calvin cycle works')) return sse(gradeJson(0.1, 'Describes the wrong process.'));
    return sse(gradeJson(0.7, 'Right process, but NADPH is missing.'));
  }) as typeof fetch;
  const exams = new ExamPrep(store, () => 'test-credential', fetcher, fastWait);
  store.saveExam(makeExam());
  const submitted = exams.submit(EXAM_ID, ANSWERS_FULL, 'Qwen3.8-27B');
  expect(submitted.state.grading).toMatchObject({ status: 'idle', model: 'Qwen3.8-27B' }); // model available: grading pending
  const graded = await exams.grade(EXAM_ID, 'Qwen3.8-27B');
  expect(fetcher).toHaveBeenCalledTimes(2); // one call per answered free-text question
  expect(graded.state.grades!['q-short-1']).toMatchObject({ verdict: 'partial', score: 0.7, gradedWith: 'model', rationale: 'Right process, but NADPH is missing.' });
  expect(graded.state.grades!['q-explain-1']).toMatchObject({ verdict: 'wrong', score: 0.1, gradedWith: 'model', rationale: 'Describes the wrong process.' });
  expect(graded.state.grading).toMatchObject({ status: 'done', model: 'Qwen3.8-27B' });
  // The grades persist in SQLite across store restarts.
  store.close();
  store = new SchoolWorkStore(dir);
  expect(new ExamPrep(store, noKey).get(EXAM_ID).state.grades!['q-short-1'].score).toBe(0.7);
});

it('re-grading replaces grades one for one and never duplicates results', async () => {
  const fetcher = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const user = JSON.parse(JSON.parse((init as RequestInit).body as string).messages[1].content);
    return sse(user.prompt.includes('Calvin cycle works') ? gradeJson(0.2, 'Only a fragment is right.') : gradeJson(0.9, 'Covers the reference answer.'));
  }) as typeof fetch;
  const exams = new ExamPrep(store, () => 'test-credential', fetcher, fastWait);
  store.saveExam(makeExam());
  exams.submit(EXAM_ID, ANSWERS_FULL, 'Qwen3.8-27B');
  const first = await exams.grade(EXAM_ID, 'Qwen3.8-27B');
  const firstKeys = Object.keys(first.state.grades!).sort();
  expect(firstKeys).toHaveLength(4);
  const again = await exams.grade(EXAM_ID, 'Qwen3.8-27B');
  expect(Object.keys(again.state.grades!).sort()).toEqual(firstKeys); // same keys, nothing appended
  expect(again.state.grades!['q-short-1']).toMatchObject({ verdict: 'correct', score: 0.9, gradedWith: 'model' });
  expect(fetcher).toHaveBeenCalledTimes(4); // one call per free-text question per run
});

it('refuses a second grading run while one is in flight', async () => {
  let release!: () => void;
  const pending = new Promise<Response>(resolve => { release = () => resolve(sse(gradeJson(1, 'Fully correct.'))); });
  const fetcher = vi.fn(async () => pending) as typeof fetch;
  const exams = new ExamPrep(store, () => 'test-credential', fetcher, fastWait);
  store.saveExam(makeExam());
  exams.submit(EXAM_ID, ANSWERS, 'Qwen3.8-27B');
  const first = exams.grade(EXAM_ID, 'Qwen3.8-27B');
  await expect(exams.grade(EXAM_ID, 'Qwen3.8-27B')).rejects.toThrow(/already running/i);
  release();
  await expect(first).resolves.toMatchObject({ state: { status: 'submitted' } });
  expect(exams.get(EXAM_ID).state.grading?.status).toBe('done');
});

it('refuses to delete an exam while its grading run is in flight, and deletes it once the run settles', async () => {
  let release!: () => void;
  const pending = new Promise<Response>(resolve => { release = () => resolve(sse(gradeJson(1, 'Fully correct.'))); });
  const fetcher = vi.fn(async () => pending) as typeof fetch;
  const exams = new ExamPrep(store, () => 'test-credential', fetcher, fastWait);
  store.saveExam(makeExam());
  exams.submit(EXAM_ID, ANSWERS, 'Qwen3.8-27B');
  const run = exams.grade(EXAM_ID, 'Qwen3.8-27B');
  await new Promise(r => setTimeout(r, 25)); // let the run register in the busy map
  expect(() => exams.remove(EXAM_ID)).toThrow(/graded/i);
  release();
  await expect(run).resolves.toMatchObject({ state: { status: 'submitted' } });
  exams.remove(EXAM_ID);
  expect(store.getExam(EXAM_ID)).toBeUndefined();
});

it('marks failed model grading as needs review, never as auto-graded, and flags the run as an error', async () => {
  const fetcher = vi.fn(async () => sse('not JSON at all')) as typeof fetch;
  const exams = new ExamPrep(store, () => 'test-credential', fetcher, fastWait);
  store.saveExam(makeExam());
  exams.submit(EXAM_ID, ANSWERS, 'Qwen3.8-27B');
  const doc = await exams.grade(EXAM_ID, 'Qwen3.8-27B');
  expect(doc.state.grades!['q-short-1']).toMatchObject({ verdict: 'needs_review', score: null, gradedWith: 'none' });
  expect(doc.state.grades!['q-short-1'].rationale).toBeTruthy();
  expect(doc.state.grades!['q-explain-1']).toMatchObject({ verdict: 'wrong', score: 0, gradedWith: 'local' }); // empty answer stays local
  expect(doc.state.grading?.status).toBe('error'); // the only model-graded question failed
  // A retry can start from the error state.
  const retryFetcher = vi.fn(async () => sse(gradeJson(0.85, 'Now it matches the reference.'))) as typeof fetch;
  const retry = new ExamPrep(store, () => 'test-credential', retryFetcher, fastWait);
  const retried = await retry.grade(EXAM_ID, 'Qwen3.8-27B');
  expect(retried.state.grades!['q-short-1']).toMatchObject({ verdict: 'correct', score: 0.85, gradedWith: 'model' });
  expect(retried.state.grading?.status).toBe('done');
});

it('recovers a grading run that died with the app so the student can re-grade', async () => {
  store.saveExam(makeExam({
    status: 'submitted',
    grades: { 'q-mc-1': { verdict: 'correct', score: 1, gradedAt: NOW, gradedWith: 'local' } },
    grading: { status: 'running', model: 'Qwen3.8-27B', startedAt: NOW },
    submittedAt: NOW, timeUsedMs: 60_000,
  }, 'submitted'));
  store.close();
  store = new SchoolWorkStore(dir);
  expect(new ExamPrep(store, noKey).get(EXAM_ID).state.grading?.status).toBe('error');
});

it('grades a legacy submitted exam that has no grades yet, offline for multiple choice', async () => {
  const fetcher = vi.fn() as typeof fetch;
  const exams = new ExamPrep(store, noKey, fetcher, fastWait);
  store.saveExam(makeExam({
    status: 'submitted', answers: { ...ANSWERS }, submittedAt: NOW, timeUsedMs: 60_000,
  }, 'submitted'));
  const doc = await exams.grade(EXAM_ID, 'Qwen3.8-27B');
  expect(doc.state.grades!['q-mc-1']).toMatchObject({ verdict: 'correct', gradedWith: 'local' });
  expect(doc.state.grades!['q-short-1']).toMatchObject({ verdict: 'needs_review', gradedWith: 'none' });
  expect(doc.state.grading?.status).toBe('done');
  expect(fetcher).not.toHaveBeenCalled();
});
