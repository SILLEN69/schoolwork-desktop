import { describe, it, expect } from 'vitest';
import {
  buildExplainRequest, computeFollowReport, detectLanguage, extractKeyConcepts, firstFlaggedIndex,
  followImportSchema, followQuestionsSchema, followStructureSchema, followVerdictsSchema,
  heuristicVerdict, offlineQuestions, segmentFlagged, splitLessonText, stripFence,
  type FollowLesson, type FollowSegment, type FollowState,
} from './lessonFollower';

let counter = 0;
const seg = (over: Partial<FollowSegment> = {}): FollowSegment => ({
  id: 's' + ++counter, heading: '', text: 'Body text.', concepts: [],
  questions: [], status: 'pending', ...over,
});
const state = (segments: FollowSegment[]): FollowState => ({ structured: 'offline', segments, current: 0 });
const filler = (n: number) => Array.from({ length: n }, (_, i) => `fact${i}`).join(' ');

describe('splitLessonText', () => {
  it('rejects empty and oversized lessons', () => {
    expect(() => splitLessonText('   \n  ')).toThrow(/empty/);
    expect(() => splitLessonText('x'.repeat(200_001))).toThrow(/longer than/);
  });
  it('splits markdown headings into parts and suggests the first heading as title', () => {
    const { segments, suggestedTitle } = splitLessonText('# Photosynthesis\nPlants turn light into energy using chlorophyll in their leaves.\n\n## Respiration\nCells break down glucose to release that stored energy as ATP.');
    expect(suggestedTitle).toBe('Photosynthesis');
    expect(segments.map(s => s.heading)).toEqual(['Photosynthesis', 'Respiration']);
    expect(segments[0].text).toContain('chlorophyll');
    expect(segments[1].text).toContain('ATP');
    expect(segments.every(s => s.questions.length === 0 && s.status === 'pending' && s.concepts.length === 0)).toBe(true);
  });
  it('merges short paragraphs until the word budget and splits oversized single blocks at sentences', () => {
    const sentence = 'This is a sentence that adds one more idea to the part.';
    const para = Array.from({ length: 13 }, () => sentence).join(' ');
    const { segments } = splitLessonText([para, para, para].join('\n\n'));
    expect(segments).toHaveLength(2);
    const words = (s: string) => s.trim().match(/\S+/g)!.length;
    expect(words(segments[0].text)).toBe(words(para) * 2);
    expect(words(segments[1].text)).toBe(words(para));
    const huge = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} carries a distinct fact number ${i} forward.`).join(' ');
    const cut = splitLessonText(huge);
    expect(cut.segments.length).toBe(2);
    expect(cut.segments.every(s => words(s.text) <= 320)).toBe(true);
    expect(words(cut.segments.map(s => s.text).join(' '))).toBe(words(huge));
    expect(words(cut.segments[0].text)).toBe(320);
    expect(words(cut.segments[1].text)).toBe(80);
  });
  it('folds a short trailing part into the previous one and falls back to the first line as title', () => {
    const big = 'Word '.repeat(200).trim();
    const { segments, suggestedTitle } = splitLessonText(big + '\n\n\nShort tail.');
    expect(segments).toHaveLength(1);
    expect(segments[0].text.endsWith('Short tail.')).toBe(true);
    expect(suggestedTitle).toHaveLength(80);
  });
  it('attaches a heading without content of its own to the following text', () => {
    const { segments } = splitLessonText('## Section\n\nOnly text under this heading.');
    expect(segments.map(s => s.heading)).toEqual(['Section']);
  });
  it('labels headingless parts from their first line and numbers parts whose lines are too short', () => {
    const a = 'Osmosis is the movement of water across membranes.\n' + filler(292);
    const b = 'Diffusion carries solutes in the other direction.\n' + filler(210);
    const { segments } = splitLessonText(a + '\n\n' + b);
    expect(segments).toHaveLength(2);
    expect(segments[0].heading).toBe('Osmosis is the movement of water across membranes.');
    expect(segments[1].heading).toBe('Diffusion carries solutes in the other direction.');
    const tiny = Array.from({ length: 60 }, () => 'Hi.').join('\n');
    const titled = splitLessonText(a + '\n\n' + tiny, 'sv');
    expect(titled.segments.map(s => s.heading)).toEqual(['Osmosis is the movement of water across membranes.', 'Del 2']);
    expect(splitLessonText(a + '\n\n' + tiny).segments[1].heading).toBe('Part 2');
  });
  it('gives every segment a unique id and is deterministic across identical input', () => {
    const text = '## A\nfirst block of words here.\n\n## B\nsecond block of words here.\n\nplain paragraph without any heading at all.';
    const a = splitLessonText(text), b = splitLessonText(text);
    expect(a.segments.map(s => s.heading)).toEqual(b.segments.map(s => s.heading));
    expect(a.segments.map(s => s.text)).toEqual(b.segments.map(s => s.text));
    expect(a.suggestedTitle).toBe(b.suggestedTitle);
    const ids = a.segments.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('followImportSchema', () => {
  it('requires real text of a known language and caps the size', () => {
    expect(followImportSchema.parse({ text: 'A lesson.', language: 'sv' }).text).toBe('A lesson.');
    expect(() => followImportSchema.parse({ text: '', language: 'sv' })).toThrow();
    expect(() => followImportSchema.parse({ text: 'x'.repeat(200_001), language: 'sv' })).toThrow();
    expect(() => followImportSchema.parse({ text: 'A lesson.', language: 'fr' })).toThrow();
  });
});

describe('detectLanguage', () => {
  it('recognises Swedish and English lessons from their function words', () => {
    expect(detectLanguage('Fotosyntesen sker i kloroplasterna. Växter behöver ljus, vatten och koldioxid. Det är en process som är viktig för nästan allt liv på jorden och den håller på under dagen.')).toBe('sv');
    expect(detectLanguage('Photosynthesis happens in the chloroplasts. Plants need light, water and carbon dioxide. This process is important for almost all life and it goes on during the day while the sun is out there.')).toBe('en');
  });
});

describe('extractKeyConcepts', () => {
  it('ranks emphasized terms above frequent words and dedupes case-insensitively', () => {
    const text = '**Klorofyll** fångar ljuset. Fotosyntesen sker i kloroplasterna. fotosyntesen omvandlar ljus till energi. Fotosyntesen använder koldioxid. **Klorofyll** sitter i membranen.';
    expect(extractKeyConcepts(text, 'sv')).toEqual(['Klorofyll', 'Fotosyntesen']);
  });
  it('accepts bold, underline, code and quoted terms and caps the result at five', () => {
    const terms = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'];
    const text = terms.map(t => `**${t}** word. `).join('') + 'padding words here to fill the line out a bit more.';
    expect(extractKeyConcepts(text, 'en')).toHaveLength(5);
    expect(extractKeyConcepts('__underline__ `code` "quotes" \'apostrophes\'', 'en')).toEqual(['underline', 'code', 'quotes', 'apostrophes']);
  });
  it('falls back to frequent content words and stops before stop words', () => {
    expect(extractKeyConcepts('The membrane lets water through. Water moves slowly by osmosis.', 'en')).toEqual(['membrane', 'water']);
    expect(extractKeyConcepts('och och och och och som och för och', 'sv')).toEqual([]);
    // "the" is a stop word in English but an ordinary content word in Swedish.
    expect(extractKeyConcepts('the the the the the the the', 'en')).toEqual([]);
    expect(extractKeyConcepts('the the the the the the the', 'sv')).toEqual(['the']);
  });
});

describe('followStructureSchema', () => {
  const part = (i: number, over: Record<string, unknown> = {}) => ({ heading: `Heading ${i}`, text: 'x'.repeat(20), concepts: ['concept one', 'concept two'], ...over });
  it('accepts 4-10 segments with 2-5 concepts each', () => {
    const four = followStructureSchema.parse({ segments: [part(1), part(2), part(3), part(4)] });
    expect(four.segments).toHaveLength(4);
    const ten = followStructureSchema.parse({ segments: Array.from({ length: 10 }, (_, i) => part(i, { concepts: Array.from({ length: 5 }, (_, c) => 'c' + c) })) });
    expect(ten.segments).toHaveLength(10);
  });
  it('rejects out-of-range, short or malformed structures', () => {
    expect(() => followStructureSchema.parse({ segments: [part(1), part(2), part(3)] })).toThrow();
    expect(() => followStructureSchema.parse({ segments: Array.from({ length: 11 }, (_, i) => part(i)) })).toThrow();
    expect(() => followStructureSchema.parse({ segments: [part(1, { concepts: ['only one'] }), part(2), part(3), part(4)] })).toThrow();
    expect(() => followStructureSchema.parse({ segments: [part(1, { concepts: ['a', 'b', 'c', 'd', 'e', 'f'] }), part(2), part(3), part(4)] })).toThrow();
    expect(() => followStructureSchema.parse({ segments: [part(1, { heading: 'ab' }), part(2), part(3), part(4)] })).toThrow();
    expect(() => followStructureSchema.parse({ segments: [part(1, { text: 'too short' }), part(2), part(3), part(4)] })).toThrow();
    expect(() => followStructureSchema.parse({ segments: [part(1, { concepts: 'nope' }), part(2), part(3), part(4)] })).toThrow();
  });
});

describe('buildExplainRequest', () => {
  const lesson = (language: 'sv' | 'en'): FollowLesson => ({
    id: 'l1', title: 'Fotosyntes', language, text: 'whole document', createdAt: 1, updatedAt: 1,
    follow: { structured: 'offline', current: 0, segments: [seg({ heading: 'Klorofyll', text: 'Klorofyll fångar ljuset i kloroplasterna.', concepts: ['Klorofyll'] })] },
  });
  it('builds a pedagogical request with the segment as reference in both languages', () => {
    const en = buildExplainRequest(lesson('en'), lesson('en').follow.segments[0]);
    expect(en.userText).toContain('Fotosyntes');
    expect(en.userText).toContain('Klorofyll');
    expect(en.userText).toMatch(/explain this part/i);
    const reference = JSON.parse(en.reference);
    expect(reference).toMatchObject({ title: 'Fotosyntes', part: { heading: 'Klorofyll', text: 'Klorofyll fångar ljuset i kloroplasterna.', concepts: ['Klorofyll'] } });
    const sv = buildExplainRequest(lesson('sv'), lesson('sv').follow.segments[0]);
    expect(sv.userText).toMatch(/Förklara det här avsnittet/);
  });
});

describe('offlineQuestions', () => {
  it('always returns a deterministic 1-3 question bank per language', () => {
    for (let i = 0; i < 8; i++) {
      for (const language of ['sv', 'en'] as const) {
        const qs = offlineQuestions(language, i);
        expect(qs.length).toBeGreaterThanOrEqual(1);
        expect(qs.length).toBeLessThanOrEqual(3);
        expect(qs[0]).toBe(offlineQuestions(language, i)[0]);
      }
    }
    expect(offlineQuestions('en', 1)[1]).not.toBe(offlineQuestions('en', 0)[1]);
    expect(offlineQuestions('sv', 0)[0]).not.toBe(offlineQuestions('en', 0)[0]);
  });
});

describe('verdicts and report', () => {
  it('treats very short answers as weak and longer ones as passing', () => {
    expect(heuristicVerdict('')).toBe('review');
    expect(heuristicVerdict('two words')).toBe('review');
    expect(heuristicVerdict('three words pass')).toBe('pass');
  });
  it('flags skipped, unreached and weak parts; a clean run flags nothing', () => {
    const clean = [seg({ status: 'answered', questions: [{ text: 'q', answer: 'good solid answer', verdict: 'pass' }] })];
    expect(segmentFlagged(clean[0])).toBe(false);
    expect(segmentFlagged(seg({ status: 'skipped' }))).toBe(true);
    expect(segmentFlagged(seg())).toBe(true);
    expect(segmentFlagged(seg({ status: 'answered', questions: [{ text: 'q', answer: 'weak', verdict: 'review' }] }))).toBe(true);
    expect(segmentFlagged(seg({ status: 'answered', questions: [{ text: 'q1', answer: 'good solid answer', verdict: 'pass' }, { text: 'q2', answer: '' }] }))).toBe(true);
    const st = state([clean[0], seg({ status: 'skipped' }), seg()]);
    const report = computeFollowReport(st);
    expect(report.totalSegments).toBe(3);
    expect(report.completedSegments).toBe(1);
    expect(report.skippedSegments).toBe(2);
    expect(report.reviewSegmentIds).toEqual([st.segments[1].id, st.segments[2].id]);
    expect(firstFlaggedIndex(st)).toBe(1);
  });
  it('counts asked, answered and skipped questions', () => {
    const st = state([
      seg({ status: 'answered', questions: [{ text: 'q1', answer: 'a fine answer', verdict: 'pass' }, { text: 'q2', answer: '', verdict: 'review' }] }),
      seg({ status: 'skipped', questions: [{ text: 'q3', answer: '' }] }),
    ]);
    const report = computeFollowReport(st);
    expect(report.askedQuestions).toBe(3);
    expect(report.answeredQuestions).toBe(1);
    expect(report.skippedQuestions).toBe(2);
  });
});

describe('model JSON contracts', () => {
  it('accepts strict question/verdict JSON and rejects everything else', () => {
    expect(followQuestionsSchema.parse({ questions: ['What does this part explain?'] }).questions).toHaveLength(1);
    expect(() => followQuestionsSchema.parse({ questions: [] })).toThrow();
    expect(() => followQuestionsSchema.parse({ questions: ['x'.repeat(241)] })).toThrow();
    expect(() => followQuestionsSchema.parse({ questions: ['ok one', 'ok two', 'ok three', 'too many'] })).toThrow();
    expect(followVerdictsSchema.parse({ results: [{ verdict: 'review', feedback: 'Vagare svaret.' }] }).results[0].verdict).toBe('review');
    expect(() => followVerdictsSchema.parse({ results: [{ verdict: 'great', feedback: '' }] })).toThrow();
    expect(stripFence('```json\n{"questions":[]}\n```')).toBe('{"questions":[]}');
  });
});
