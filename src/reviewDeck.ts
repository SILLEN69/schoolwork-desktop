import { z } from 'zod';
import type { AudioLanguage } from './lesson';

export type ReviewCard = { front: string; back: string };
export type ReviewQuestion = { question: string; options: [string, string, string, string]; answer: number };
export type ReviewDeck = { cards: ReviewCard[]; quiz: ReviewQuestion[]; source: 'model' | 'offline' };
export type ReviewMark = 'got' | 'still';
export type ReviewItemState = {
  id: string; lessonId: string; kind: 'card' | 'quiz'; itemIndex: number;
  dueAt: number; lastReviewedAt: number | null;
  intervalIndex: number; attempts: number; correct: number; status: 'learning' | 'mastered';
};
export type ReviewDeckView = {
  lessonId: string; source: 'model' | 'offline'; generatedAt: number;
  cards: ReviewCard[]; quiz: ReviewQuestion[]; items: ReviewItemState[];
};
export type ReviewQueue = { count: number; lessons: Array<{ lessonId: string; title: string; cards: number; quiz: number }> };

const MINUTE_MS = 60_000;
export const MAX_CARDS = 10;
export const MIN_CARDS = 5;
export const MAX_QUIZ = 5;
export const MIN_QUIZ = 3;

/** Strict JSON contract for model-generated review decks: 5-10 cards and 3-5 multiple-choice questions. */
const quizOptionSchema = z.string().trim().min(2).max(120);
export const reviewQuestionInputSchema = z.object({
  question: z.string().trim().min(6).max(200),
  options: z.tuple([quizOptionSchema, quizOptionSchema, quizOptionSchema, quizOptionSchema]).refine(
    options => new Set(options.map(o => o.toLocaleLowerCase('en'))).size === 4, 'Duplicate quiz option.',
  ),
  answer: z.number().int().min(0).max(3),
});
export const reviewCardInputSchema = z.object({
  front: z.string().trim().min(2).max(160),
  back: z.string().trim().min(2).max(400),
});
export const reviewDeckInputSchema = z.object({
  cards: z.array(reviewCardInputSchema).min(MIN_CARDS).max(MAX_CARDS),
  quiz: z.array(reviewQuestionInputSchema).min(MIN_QUIZ).max(MAX_QUIZ),
});

// --- Spaced scheduling -----------------------------------------------------
// "Still learning" items come back tomorrow (the next study session); "got it"
// items climb a ladder of growing intervals. A miss always resets to the base.
export const REVIEW_RELEARN_MIN = 24 * 60; // one day
export const REVIEW_HIT_INTERVALS_MIN = [48 * 60, 96 * 60, 192 * 60, 384 * 60]; // 2, 4, 8, 16 days
export const REVIEW_MASTERED_AFTER = 2; // ladder position that counts as mastered

export function scheduleReview(mark: ReviewMark, now: number, current: { intervalIndex: number; attempts: number; correct: number }) {
  if (mark === 'still') {
    return {
      intervalIndex: 0,
      attempts: current.attempts + 1,
      correct: current.correct,
      dueAt: now + REVIEW_RELEARN_MIN * MINUTE_MS,
      lastReviewedAt: now,
      status: 'learning' as const,
    };
  }
  const intervalIndex = Math.min(current.intervalIndex + 1, REVIEW_HIT_INTERVALS_MIN.length - 1);
  return {
    intervalIndex,
    attempts: current.attempts + 1,
    correct: current.correct + 1,
    dueAt: now + REVIEW_HIT_INTERVALS_MIN[intervalIndex] * MINUTE_MS,
    lastReviewedAt: now,
    status: (intervalIndex >= REVIEW_MASTERED_AFTER ? 'mastered' : 'learning') as 'mastered' | 'learning',
  };
}

export function initialReviewItems(lessonId: string, deck: { cards: ReviewCard[]; quiz: ReviewQuestion[] }, now: number): ReviewItemState[] {
  const items: ReviewItemState[] = [];
  deck.cards.forEach((_, i) => items.push({ id: `${lessonId}:card:${i}`, lessonId, kind: 'card', itemIndex: i, dueAt: now, lastReviewedAt: null, intervalIndex: 0, attempts: 0, correct: 0, status: 'learning' }));
  deck.quiz.forEach((_, i) => items.push({ id: `${lessonId}:quiz:${i}`, lessonId, kind: 'quiz', itemIndex: i, dueAt: now, lastReviewedAt: null, intervalIndex: 0, attempts: 0, correct: 0, status: 'learning' }));
  return items;
}

export const isReviewDue = (item: ReviewItemState, now: number) => item.dueAt <= now;

// --- Deterministic offline deck --------------------------------------------
const SENTENCE_RE = /[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/gu;
const sentences = (text: string) => (text.match(SENTENCE_RE) ?? []).map(s => s.trim()).filter(Boolean);
const clip = (text: string, max = 300) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text);

function hashString(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}

function sentenceAbout(text: string, term: string): string {
  const all = sentences(text);
  const key = term.toLocaleLowerCase('en');
  const hit = all.find(s => s.toLocaleLowerCase('en').includes(key));
  return clip((hit || all[0] || text.trim()).replace(/\s+/g, ' '));
}

function leadSentences(text: string, count: number): string {
  return clip(sentences(text).slice(0, count).join(' ').replace(/\s+/g, ' '));
}

/** Deterministically builds a review deck from the stored segments: concept cards first, summary cards to reach five, and location quiz questions when the lesson has at least four parts. */
export function offlineDeck(language: AudioLanguage, segments: Array<{ heading: string; text: string; concepts: string[] }>): ReviewDeck {
  const cards: ReviewCard[] = [];
  const used = new Set<string>();
  for (const seg of segments) {
    if (cards.length >= MAX_CARDS) break;
    for (const concept of seg.concepts) {
      if (cards.length >= MAX_CARDS) break;
      const key = concept.trim().toLocaleLowerCase('en');
      if (!key || used.has(key)) continue;
      used.add(key);
      cards.push({
        front: language === 'sv' ? `Vad menas med "${concept}" i lektionen?` : `What does "${concept}" mean in this lesson?`,
        back: sentenceAbout(seg.text, concept),
      });
    }
  }
  // Lessons too small for five concept cards are padded with per-part summary and main-idea cards.
  for (const pad of [
    (seg: { heading: string; text: string }) => ({
      front: language === 'sv' ? `Sammanfatta: ${seg.heading}` : `Summarise: ${seg.heading}`,
      back: leadSentences(seg.text, 2),
    }),
    (seg: { heading: string; text: string }) => ({
      front: language === 'sv' ? `Vad är huvudidén i ${seg.heading}?` : `What is the main idea of ${seg.heading}?`,
      back: leadSentences(seg.text, 3),
    }),
  ]) {
    if (cards.length >= MIN_CARDS) break;
    for (const seg of segments) {
      if (cards.length >= MIN_CARDS) break;
      if (!seg.text.trim()) continue;
      cards.push(pad(seg));
    }
  }
  const quiz: ReviewQuestion[] = [];
  if (segments.length >= 4) {
    const pickIndexes = [...new Set([0, Math.floor(segments.length / 2), segments.length - 1])].sort((a, b) => a - b);
    const seenTerms = new Set<string>();
    for (const i of pickIndexes) {
      if (quiz.length >= MIN_QUIZ) break;
      const seg = segments[i];
      const concept = seg.concepts.find(c => {
        const key = c.trim().toLocaleLowerCase('en');
        return key && !seenTerms.has(key) && segments.filter(s => s.concepts.some(x => x.trim().toLocaleLowerCase('en') === key)).length === 1;
      });
      if (!concept) continue;
      const distinctOthers = [...new Set(segments.filter(s => s !== seg && s.heading && s.heading !== seg.heading).map(s => s.heading))].slice(0, 3);
      if (distinctOthers.length < 3) continue;
      const term = concept.trim();
      seenTerms.add(term.toLocaleLowerCase('en'));
      // Deterministic option order: the correct heading lands at a hashed position.
      const options = [...distinctOthers];
      options.splice(hashString(language + '|' + seg.heading + '|' + term) % 4, 0, seg.heading);
      quiz.push({
        question: language === 'sv' ? `I vilket avsnitt introduceras "${term}"?` : `In which part of the lesson is "${term}" introduced?`,
        options: options as [string, string, string, string],
        answer: options.indexOf(seg.heading),
      });
    }
  }
  return { cards, quiz, source: 'offline' };
}
