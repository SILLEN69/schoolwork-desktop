import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LessonFollower } from './lessonFollower';
import { SchoolWorkStore } from './storage';
import { offlineQuestions } from '../src/lessonFollower';
import { isReviewDue } from '../src/reviewDeck';

let dir: string, store: SchoolWorkStore;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-follower-'));
  store = new SchoolWorkStore(dir);
});
afterEach(() => {
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
const noKey = () => { throw new Error('Add your TeachGPT API key in Settings.'); };
const make = (key: () => string = noKey, fetcher: typeof fetch = vi.fn() as typeof fetch) => new LessonFollower(store, key, fetcher);
const sse = (text: string) => new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
const LESSON = '# Fotosyntes\nVäxter använder ljus för att tillverka socker i kloroplasterna. Klorofyll fångar ljuset.\n\n## Cellandning\nCellerna bryter ner glukos och frigör energi som ATP. Det händer i mitokondrien.';
const structureJson = JSON.stringify({ segments: [
  { heading: 'Ljusreaktioner', text: 'Ljusreaktionerna sker i thylakoiderna och ger ATP och NADPH till växtcellen.', concepts: ['Ljusreaktioner', 'ATP'] },
  { heading: 'Kalvinyxlet', text: 'Kalvinyxlet fixerar koldioxid till socker i stromatet hos växterna.', concepts: ['Kalvinyxlet', 'Koldioxid'] },
  { heading: 'Klorofyll', text: 'Klorofyll fångar ljuset i pigmenten och överför energin vidare in i cellen.', concepts: ['Klorofyll', 'Pigment'] },
  { heading: 'Sammanfattning', text: 'Fotosyntesen omvandlar ljusenergi till kemisk energi i växter och alger.', concepts: ['Fotosyntes', 'Energi'] },
] });

it('imports offline lessons with deterministic structure, key concepts and the persisted document', async () => {
  const fetcher = vi.fn() as typeof fetch;
  const follower = make(noKey, fetcher);
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  expect(lesson.follow.structured).toBe('offline');
  expect(lesson.title).toBe('Fotosyntes');
  expect(lesson.text).toBe(LESSON);
  expect(lesson.follow.current).toBe(0);
  expect(lesson.follow.segments.map(s => s.heading)).toEqual(['Fotosyntes', 'Cellandning']);
  expect(lesson.follow.segments[0].concepts).toEqual(['Växter', 'använder']);
  expect(lesson.follow.segments[1].concepts).toEqual(['Cellerna', 'bryter']);
  expect(lesson.follow.segments.every(s => s.questions.length === 0 && s.status === 'pending')).toBe(true);
  expect(follower.list()).toHaveLength(1);
  expect(fetcher).not.toHaveBeenCalled();
  // A fresh store over the same database file sees the persisted document and state.
  store.close();
  store = new SchoolWorkStore(dir);
  const reopened = new LessonFollower(store, noKey);
  expect(reopened.get(lesson.id).text).toBe(LESSON);
  expect(reopened.get(lesson.id).follow.structured).toBe('offline');
  expect(reopened.get(lesson.id).follow.segments[0].concepts).toEqual(['Växter', 'använder']);
});

it('structures lessons with the model when a key is configured', async () => {
  const rawFetcher = vi.fn(async (_url: string | URL, init?: RequestInit) => { void init; return sse(structureJson); });
  const follower = make(() => 'test-credential', rawFetcher as unknown as typeof fetch);
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  expect(lesson.follow.structured).toBe('model');
  expect(lesson.title).toBe('Fotosyntes');
  expect(lesson.follow.segments.map(s => s.heading)).toEqual(['Ljusreaktioner', 'Kalvinyxlet', 'Klorofyll', 'Sammanfattning']);
  expect(lesson.follow.segments[0].concepts).toEqual(['Ljusreaktioner', 'ATP']);
  expect(lesson.follow.segments.every(s => s.concepts.length >= 2 && s.concepts.length <= 5)).toBe(true);
  expect(lesson.text).toBe(LESSON);
  expect(rawFetcher).toHaveBeenCalledTimes(1);
  expect((rawFetcher.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-credential' });
});

it('never calls the structuring model for speech models or when the answer breaks the contract', async () => {
  const speechFetcher = vi.fn(async () => sse(structureJson)) as typeof fetch;
  const speech = await make(() => 'test-credential', speechFetcher).import({ text: LESSON, language: 'sv' }, 'kb-whisper-large');
  expect(speech.follow.structured).toBe('offline');
  expect(speechFetcher).not.toHaveBeenCalled();
  let reply = 'not JSON at all';
  const fetcher = vi.fn(async () => sse(reply)) as typeof fetch;
  const follower = make(() => 'test-credential', fetcher);
  const malformed = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  expect(malformed.follow.structured).toBe('offline');
  expect(malformed.follow.segments.map(s => s.heading)).toEqual(['Fotosyntes', 'Cellandning']);
  reply = JSON.stringify({ segments: [
    { heading: 'En', text: 'x'.repeat(20), concepts: ['a', 'b'] },
    { heading: 'Två', text: 'x'.repeat(20), concepts: ['c', 'd'] },
    { heading: 'Tre', text: 'x'.repeat(20), concepts: ['e', 'f'] },
  ] });
  const outOfContract = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  expect(outOfContract.follow.structured).toBe('offline');
});

it('appends deterministic continued parts when a lesson outgrows the model input', async () => {
  const text = Array.from({ length: 800 }, (_, i) => `Sentence number ${i} carries a distinct fact number ${i} forward.`).join(' ');
  const fetcher = vi.fn(async () => sse(structureJson)) as typeof fetch;
  const follower = make(() => 'test-credential', fetcher);
  const lesson = await follower.import({ text, language: 'sv' }, 'Qwen3.8-27B');
  expect(lesson.follow.structured).toBe('model');
  expect(lesson.follow.segments.length).toBeGreaterThan(4);
  expect(lesson.follow.segments[4].heading).toBe('Fortsättning 1');
  expect(lesson.follow.segments.at(-1)!.heading).toMatch(/^Fortsättning \d+$/);
  expect(lesson.text).toBe(text);
});

it('keeps a readable position with clamped advances that persist across instances', async () => {
  const follower = make();
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  expect(follower.advance(lesson.id, 99).follow.current).toBe(1);
  expect(follower.advance(lesson.id, -5).follow.current).toBe(0);
  expect(() => follower.advance(crypto.randomUUID(), 0)).toThrow(/not found/i);
  store.close();
  store = new SchoolWorkStore(dir);
  expect(new LessonFollower(store, noKey).get(lesson.id).follow.current).toBe(0);
});

it('builds explain requests for one segment and remembers the explain chat', async () => {
  const follower = make();
  const lesson = await follower.import({ text: LESSON, language: 'en' }, 'Qwen3.8-27B');
  const segId = lesson.follow.segments[0].id;
  const { userText, reference } = follower.explainContext(lesson.id, segId);
  expect(userText).toMatch(/explain this part/i);
  expect(userText).toContain('Fotosyntes');
  expect(JSON.parse(reference)).toMatchObject({ title: 'Fotosyntes', part: { heading: 'Fotosyntes', concepts: ['Växter', 'använder'] } });
  expect(() => follower.explainContext(lesson.id, crypto.randomUUID())).toThrow(/segment/i);
  expect(follower.setExplainChat(lesson.id, 'chat-123').follow.explainChatId).toBe('chat-123');
});

it('removes lessons and their persisted state', async () => {
  const follower = make();
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  await follower.remove(lesson.id);
  expect(follower.list()).toHaveLength(0);
  expect(() => follower.get(lesson.id)).toThrow(/not found/i);
  await expect(follower.remove(crypto.randomUUID())).rejects.toThrow(/not found/i);
});

it('generates offline recall questions when no key is configured', async () => {
  const follower = make(noKey, vi.fn() as typeof fetch);
  const lesson = await follower.import({ text: LESSON, language: 'en' }, 'Qwen3.8-27B');
  const segId = lesson.follow.segments[0].id;
  const result = await follower.questions(lesson.id, segId, 'Qwen3.8-27B');
  const seg = result.follow.segments[0];
  expect(seg.source).toBe('offline');
  expect(seg.questions.map(q => q.text)).toEqual(offlineQuestions('en', 0));
  // Preparing twice never duplicates questions.
  const again = await follower.questions(lesson.id, segId, 'Qwen3.8-27B');
  expect(again.follow.segments[0].questions.map(q => q.text)).toEqual(seg.questions.map(q => q.text));
});

it('uses model-generated questions with strict validation and falls back offline on malformed JSON', async () => {
  const good = JSON.stringify({ questions: ['What captures the light?', 'Where does respiration happen?'] });
  let mode: 'good' | 'bad' = 'good';
  const fetcher = vi.fn(async () => sse(mode === 'good' ? good : 'not JSON at all')) as typeof fetch;
  const follower = make(() => 'key', fetcher);
  const lesson = await follower.import({ text: LESSON, language: 'en' }, 'Qwen3.8-27B');
  const result = await follower.questions(lesson.id, lesson.follow.segments[0].id, 'Qwen3.8-27B');
  expect(result.follow.segments[0].source).toBe('model');
  expect(result.follow.segments[0].questions.map(q => q.text)).toEqual(['What captures the light?', 'Where does respiration happen?']);
  mode = 'bad';
  const second = await follower.questions(lesson.id, lesson.follow.segments[1].id, 'Qwen3.8-27B');
  expect(second.follow.segments[1].source).toBe('offline');
  expect(second.follow.segments[1].questions).toHaveLength(2);
  await expect(follower.questions(lesson.id, crypto.randomUUID(), 'Qwen3.8-27B')).rejects.toThrow(/segment/i);
});

it('records answers with model verdicts, heuristic verdicts on model failure, and persisted refreshed reports', async () => {
  const questionJson = JSON.stringify({ questions: ['Q one?', 'Q two?'] });
  const verdictJson = JSON.stringify({ results: [{ verdict: 'pass', feedback: 'Rätt.' }, { verdict: 'review', feedback: 'Vagare.' }] });
  let reply = questionJson;
  const fetcher = vi.fn(async () => sse(reply)) as typeof fetch;
  const follower = make(() => 'key', fetcher);
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  const [a, b] = lesson.follow.segments;
  await follower.questions(lesson.id, a.id, 'Qwen3.8-27B');
  reply = verdictJson;
  await expect(follower.answer(lesson.id, a.id, ['', ''], 'Qwen3.8-27B')).rejects.toThrow(/at least one answer/i);
  const answered = await follower.answer(lesson.id, a.id, ['Klorofyll fångar ljuset i kloroplasterna.', ''], 'Qwen3.8-27B');
  expect(answered.follow.segments[0].status).toBe('answered');
  expect(answered.follow.segments[0].questions.map(q => q.verdict)).toEqual(['pass', 'review']);
  expect(answered.follow.segments[0].questions[0].feedback).toBe('Rätt.');
  // A broken model review must not lose the answers: fall back to the length heuristic.
  reply = questionJson;
  await follower.questions(lesson.id, b.id, 'Qwen3.8-27B');
  reply = 'not JSON at all';
  const fallback = await follower.answer(lesson.id, b.id, ['Kort', 'Glukos bryts ner till ATP i mitokondrien.'], 'Qwen3.8-27B');
  expect(fallback.follow.segments[1].questions.map(q => q.verdict)).toEqual(['review', 'pass']);
  expect(() => follower.skip(lesson.id, a.id)).toThrow(/already answered/i);
  const finished = follower.finish(lesson.id);
  expect(finished.follow.report).toMatchObject({ totalSegments: 2, completedSegments: 2, skippedSegments: 0, askedQuestions: 4, answeredQuestions: 3, skippedQuestions: 1 });
  expect(finished.follow.report!.reviewSegmentIds).toEqual([a.id, b.id]);
  // A second instance over the same store sees the persisted report.
  store.close();
  store = new SchoolWorkStore(dir);
  expect(new LessonFollower(store, () => 'key').get(lesson.id).follow.report!.completedSegments).toBe(2);
});

const deckJson = JSON.stringify({
  cards: [
    { front: 'What captures the light?', back: 'Chlorophyll captures the light in the thylakoid membranes.' },
    { front: 'Where is ATP made?', back: 'ATP is made during the light reactions.' },
    { front: 'What is fixed in the Calvin cycle?', back: 'Carbon dioxide is fixed into sugar.' },
    { front: 'Name the green pigment.', back: 'Chlorophyll is the green pigment.' },
    { front: 'What stores the energy?', back: 'Sugar stores the energy in chemical bonds.' },
  ],
  quiz: [
    { question: 'Which part explains the light reactions?', options: ['Ljusreaktioner', 'Kalvinyxlet', 'Klorofyll', 'Sammanfattning'], answer: 0 },
    { question: 'Where does the Calvin cycle fix carbon?', options: ['Stromat', 'Thylakoid', 'Mitokondrie', 'Cytoplasma'], answer: 0 },
    { question: 'Which pigment captures the light?', options: ['Klorofyll', 'Hemoglobin', 'Karoten', 'Melanin'], answer: 0 },
  ],
});

it('builds an offline review deck from the stored key concepts and stores one due item per card', async () => {
  const follower = make(noKey, vi.fn() as typeof fetch);
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  const deck = await follower.deckGenerate(lesson.id, 'Qwen3.8-27B');
  expect(deck.source).toBe('offline');
  expect(deck.cards.length).toBeGreaterThanOrEqual(5);
  expect(deck.cards.length).toBeLessThanOrEqual(10);
  expect(deck.cards.every(c => c.front && c.back)).toBe(true);
  // The two-part fixture has no location quiz, and a second instance sees the same single deck.
  expect(deck.quiz).toEqual([]);
  expect(deck.items).toHaveLength(deck.cards.length);
  expect(deck.items.every(i => isReviewDue(i, Date.now()))).toBe(true);
  expect(follower.deckGet(lesson.id)?.items).toHaveLength(deck.items.length);
  // Deck generation must not touch the lesson document or its follow state.
  const after = follower.get(lesson.id);
  expect(after.text).toBe(LESSON);
  expect(after.follow.segments).toHaveLength(2);
  expect(after.follow.current).toBe(0);
});

it('uses the model to generate a review deck with strict validation and falls back offline on broken answers', async () => {
  let reply = deckJson;
  const rawFetcher = vi.fn(async (_url: string | URL, init?: RequestInit) => { void init; return sse(reply); });
  const follower = make(() => 'key', rawFetcher as unknown as typeof fetch);
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  const deck = await follower.deckGenerate(lesson.id, 'Qwen3.8-27B');
  expect(deck.source).toBe('model');
  expect(deck.cards).toHaveLength(5);
  expect(deck.quiz).toHaveLength(3);
  const request = JSON.parse((rawFetcher.mock.calls.at(-1)![1] as RequestInit).body as string);
  expect(request.model).toBe('Qwen3.8-27B');
  expect(String(request.messages.at(-1).content)).toContain('Fotosyntes');
  reply = 'not JSON at all';
  expect((await follower.deckGenerate(lesson.id, 'Qwen3.8-27B')).source).toBe('offline');
  reply = JSON.stringify({ cards: [{ front: 'a', back: 'b' }], quiz: [] });
  expect((await follower.deckGenerate(lesson.id, 'Qwen3.8-27B')).source).toBe('offline');
  // Regeneration is idempotent: one deck per lesson, schedule state reset.
  expect(follower.dueQueue().lessons).toHaveLength(1);
  expect(follower.deckGet(lesson.id)?.items.every(i => i.attempts === 0)).toBe(true);
});

it('schedules review marks: still-learning returns tomorrow, got-it climbs the ladder, and the due queue follows', async () => {
  const follower = make(noKey, vi.fn() as typeof fetch);
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  const deck = await follower.deckGenerate(lesson.id, 'Qwen3.8-27B');
  const before = Date.now();
  const missed = follower.reviewMark(lesson.id, 'card', 0, 'still');
  expect(missed.item).toMatchObject({ intervalIndex: 0, attempts: 1, correct: 0, status: 'learning' });
  expect(missed.item.dueAt).toBeGreaterThanOrEqual(before + 24 * 3600 * 1000);
  expect(missed.item.dueAt).toBeLessThanOrEqual(before + 24 * 3600 * 1000 + 5000);
  const got = follower.reviewMark(lesson.id, 'card', 1, 'got');
  expect(got.item).toMatchObject({ intervalIndex: 1, correct: 1 });
  expect(got.item.dueAt).toBeGreaterThanOrEqual(before + 48 * 3600 * 1000);
  const mastered = follower.reviewMark(lesson.id, 'card', 1, 'got');
  expect(mastered.item.status).toBe('mastered');
  expect(follower.reviewMark(lesson.id, 'card', 1, 'still').item.intervalIndex).toBe(0);
  expect(follower.dueQueue().count).toBe(deck.items.length - 2);
  expect(follower.dueQueue().lessons[0]).toMatchObject({ lessonId: lesson.id, title: 'Fotosyntes', cards: deck.items.length - 2, quiz: 0 });
  expect(() => follower.reviewMark(lesson.id, 'card', 99, 'got')).toThrow(/not found/i);
});

it('persists the deck and schedule across instances and cascades them on lesson deletion', async () => {
  const follower = make(noKey, vi.fn() as typeof fetch);
  const lesson = await follower.import({ text: LESSON, language: 'sv' }, 'Qwen3.8-27B');
  const deck = await follower.deckGenerate(lesson.id, 'Qwen3.8-27B');
  follower.reviewMark(lesson.id, 'card', 0, 'got');
  store.close();
  store = new SchoolWorkStore(dir);
  const reopened = new LessonFollower(store, noKey);
  expect(reopened.deckGet(lesson.id)?.items[0]).toMatchObject({ correct: 1, attempts: 1, intervalIndex: 1 });
  expect(reopened.dueQueue().count).toBe(deck.items.length - 1);
  await reopened.remove(lesson.id);
  expect(reopened.dueQueue()).toEqual({ count: 0, lessons: [] });
  expect(() => reopened.deckGet(lesson.id)).toThrow(/not found/i);
});

it('cancels a hanging deck generation without storing a partial deck', async () => {
  let ready!: () => void;
  const requested = new Promise<void>(resolve => { ready = resolve; });
  let calls = 0;
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    calls++;
    if (calls === 1) return sse(structureJson);
    ready();
    return new Promise<Response>((_resolve, reject) => { init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true }); });
  }) as typeof fetch;
  const follower = make(() => 'key', fetcher);
  const lesson = await follower.import({ text: LESSON, language: 'en' }, 'Qwen3.8-27B');
  const request = follower.deckGenerate(lesson.id, 'Qwen3.8-27B');
  await requested;
  follower.cancel(lesson.id);
  await expect(request).rejects.toThrow(/cancelled/i);
  expect(follower.deckGet(lesson.id)).toBeNull();
});

it('cancels a hanging model request without storing partial questions', async () => {
  let ready!: () => void;
  const requested = new Promise<void>(resolve => { ready = resolve; });
  let calls = 0;
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    calls++;
    if (calls === 1) return sse(structureJson); // The import structures fine; the question request hangs.
    ready();
    return new Promise<Response>((_resolve, reject) => { init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true }); });
  }) as typeof fetch;
  const follower = make(() => 'key', fetcher);
  const lesson = await follower.import({ text: LESSON, language: 'en' }, 'Qwen3.8-27B');
  const request = follower.questions(lesson.id, lesson.follow.segments[0].id, 'Qwen3.8-27B');
  await requested;
  follower.cancel(lesson.id);
  await expect(request).rejects.toThrow(/cancelled/i);
  expect(follower.get(lesson.id).follow.segments[0].questions).toHaveLength(0);
  expect(follower.get(lesson.id).follow.segments[0].source).toBeUndefined();
});
