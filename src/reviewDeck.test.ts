import { describe, expect, it } from 'vitest';
import {
  initialReviewItems, isReviewDue, offlineDeck, reviewDeckInputSchema, scheduleReview,
  REVIEW_HIT_INTERVALS_MIN, REVIEW_MASTERED_AFTER, REVIEW_RELEARN_MIN,
} from './reviewDeck';

const MINUTE = 60_000;
const NOW = 1_760_000_000_000;
const seg = (heading: string, text: string, concepts: string[]) => ({ heading, text, concepts });
const FOUR_SEGMENTS = [
  seg('Evaporation', 'Water evaporates from lakes and rivers. The sun drives evaporation of warm surface water every day.', ['Evaporation']),
  seg('Condensation', 'Rising vapour cools and condenses into droplets. Condensation forms visible clouds high in the sky.', ['Condensation']),
  seg('Precipitation', 'Heavy droplets fall as rain or snow. Precipitation returns water to the ground.', ['Precipitation']),
  seg('Collection', 'Water collects in rivers, lakes and oceans. Collection stores the water until it evaporates again.', ['Collection']),
];

describe('review deck schema', () => {
  const card = (front = 'What is X?', back = 'X is a thing.') => ({ front, back });
  const options = ['A one', 'B two', 'C three', 'D four'];
  const question = (question = 'Which part is about X?', customOptions: string[] = options, answer = 0) => ({ question, options: customOptions, answer });
  const cards = (n: number) => Array.from({ length: n }, () => card());
  it('accepts a deck inside the 5-10 cards and 3-5 quiz contract', () => {
    const parsed = reviewDeckInputSchema.parse({ cards: cards(5), quiz: Array.from({ length: 3 }, (_, i) => question(`Question number ${i + 1}?`)) });
    expect(parsed.cards).toHaveLength(5);
    expect(parsed.quiz).toHaveLength(3);
    expect(reviewDeckInputSchema.parse({ cards: cards(10), quiz: Array.from({ length: 5 }, (_, i) => question(`Question number ${i + 1}?`)) }).cards).toHaveLength(10);
  });
  it('rejects out-of-contract decks and malformed questions', () => {
    expect(() => reviewDeckInputSchema.parse({ cards: cards(4), quiz: [question(), question(), question()] })).toThrow();
    expect(() => reviewDeckInputSchema.parse({ cards: cards(11), quiz: [question(), question(), question()] })).toThrow();
    expect(() => reviewDeckInputSchema.parse({ cards: cards(5), quiz: [question(), question()] })).toThrow();
    expect(() => reviewDeckInputSchema.parse({ cards: cards(5), quiz: Array.from({ length: 6 }, (_, i) => question(`Question number ${i + 1}?`)) })).toThrow();
    expect(() => reviewDeckInputSchema.parse({ cards: cards(5), quiz: [question('What is X?', ['A one', 'a one', 'C three', 'D four']), question(), question()] })).toThrow();
    expect(() => reviewDeckInputSchema.parse({ cards: cards(5), quiz: [question('What is X?', options, 4), question(), question()] })).toThrow();
    expect(() => reviewDeckInputSchema.parse({ cards: [card('X', 'ok')], quiz: [question(), question(), question()] })).toThrow();
    expect(() => reviewDeckInputSchema.parse({ cards: cards(5), quiz: [question('What is X?', options, 1), question(), question()] })).not.toThrow();
  });
});

describe('offline deck', () => {
  it('builds concept cards with sentence backs, capped at ten', () => {
    const segments = Array.from({ length: 6 }, (_, i) =>
      seg(`Part ${i + 1}`, `The concept ${i + 1} matters here. Concept ${i + 1} repeats in the text.`, [`Concept ${i + 1}`, `Term ${i + 1}`]));
    const deck = offlineDeck('en', segments);
    expect(deck.source).toBe('offline');
    expect(deck.cards).toHaveLength(10);
    expect(deck.cards[0].front).toBe('What does "Concept 1" mean in this lesson?');
    expect(deck.cards[0].back).toContain('The concept 1 matters here.');
    expect(deck.quiz).toHaveLength(3);
  });
  it('pads short decks to five cards with summary cards and stays deterministic', () => {
    const segments = [
      seg('Intro', 'Photosynthesis builds sugar. Light drives the whole process forward.', ['Sugar']),
      seg('Details', 'Chlorophyll captures the light of the sun.', ['Chlorophyll']),
    ];
    const first = offlineDeck('en', segments);
    const second = offlineDeck('en', segments);
    expect(first).toEqual(second);
    expect(first.cards.length).toBeGreaterThanOrEqual(5);
    expect(first.cards.some(c => c.front === 'Summarise: Intro')).toBe(true);
    expect(first.cards.some(c => c.front === 'What is the main idea of Intro?')).toBe(true);
    expect(first.cards.every(c => c.back.length > 0)).toBe(true);
    expect(first.quiz).toEqual([]);
  });
  it('builds location quiz questions from parts with a unique concept and a deterministic answer position', () => {
    const deck = offlineDeck('en', FOUR_SEGMENTS);
    expect(deck.quiz).toHaveLength(3);
    for (const q of deck.quiz) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map(o => o.toLocaleLowerCase('en'))).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThanOrEqual(3);
      expect(FOUR_SEGMENTS.some(s => s.heading === q.options[q.answer])).toBe(true);
      const term = q.question.match(/"(.+?)"/)?.[1];
      expect(term).toBeTruthy();
      expect(FOUR_SEGMENTS.find(s => s.heading === q.options[q.answer])?.concepts.map(c => c.toLowerCase())).toContain(term!.toLowerCase());
    }
    const sv = offlineDeck('sv', FOUR_SEGMENTS);
    expect(sv.quiz[0].question).toContain('I vilket avsnitt introduceras');
    expect(offlineDeck('en', FOUR_SEGMENTS).quiz).toEqual(deck.quiz);
  });
});

describe('spaced review scheduling', () => {
  const fresh = { intervalIndex: 0, attempts: 0, correct: 0 };
  it('new items are immediately due', () => {
    const items = initialReviewItems('lesson-1', { cards: [{ front: 'a', back: 'b' }], quiz: [] }, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'lesson-1:card:0', kind: 'card', intervalIndex: 0, attempts: 0, correct: 0, status: 'learning' });
    expect(isReviewDue(items[0], NOW)).toBe(true);
    expect(isReviewDue(items[0], NOW - 1)).toBe(false);
  });
  it('a miss schedules the item for the next session and resets progress', () => {
    const after = scheduleReview('still', NOW, fresh);
    expect(after).toEqual({ intervalIndex: 0, attempts: 1, correct: 0, dueAt: NOW + REVIEW_RELEARN_MIN * MINUTE, lastReviewedAt: NOW, status: 'learning' });
    const climbed = { intervalIndex: 2, attempts: 3, correct: 3 };
    const reset = scheduleReview('still', NOW, climbed);
    expect(reset.intervalIndex).toBe(0);
    expect(reset.dueAt).toBe(NOW + REVIEW_RELEARN_MIN * MINUTE);
    expect(reset.correct).toBe(3);
    expect(reset.attempts).toBe(4);
  });
  it('a hit climbs the ladder, caps at the longest interval, and marks items mastered', () => {
    const first = scheduleReview('got', NOW, fresh);
    expect(first.intervalIndex).toBe(1);
    expect(first.dueAt).toBe(NOW + REVIEW_HIT_INTERVALS_MIN[1] * MINUTE);
    expect(first.correct).toBe(1);
    const second = scheduleReview('got', NOW, first);
    expect(second.intervalIndex).toBe(2);
    expect(second.status).toBe('mastered');
    expect(second.dueAt).toBe(NOW + REVIEW_HIT_INTERVALS_MIN[2] * MINUTE);
    const capped = scheduleReview('got', NOW, { ...second, intervalIndex: REVIEW_HIT_INTERVALS_MIN.length - 1 });
    expect(capped.intervalIndex).toBe(REVIEW_HIT_INTERVALS_MIN.length - 1);
    expect(capped.dueAt).toBe(NOW + REVIEW_HIT_INTERVALS_MIN[REVIEW_HIT_INTERVALS_MIN.length - 1] * MINUTE);
    expect(REVIEW_HIT_INTERVALS_MIN[0] * MINUTE).toBeGreaterThan(REVIEW_RELEARN_MIN * MINUTE);
    expect(REVIEW_MASTERED_AFTER).toBeGreaterThanOrEqual(1);
  });
});
