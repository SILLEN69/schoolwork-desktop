// Real Electron app, isolated profile, no TeachGPT key: the Lesson Follower must
// import, structure offline, follow, persist, import from file and explain-safe hint,
// (phase 2) run self-checks, record answers/skips, produce and persist a gap
// report whose "Review weak segments" jumps to the first flagged part, and
// (phase 3) generate an offline review deck (cards + location quiz), step through
// it with got-it / still-learning marks, show the due-review badge, regenerate the
// deck idempotently, and resume the queue after a restart.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const data = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-follower-ui-'));
const shots = path.resolve('work/follower-verification');
await fs.mkdir(shots, { recursive: true });
let app;
const results = [];
function pass(text) { results.push(text); console.log('PASS:', text); }
async function launch() {
  return electron.launch({
    executablePath: process.platform === 'win32' ? path.resolve('node_modules/electron/dist/electron.exe') : path.resolve('node_modules/electron/dist/electron'),
    args: [path.resolve('scripts/test-lesson-follower-app.cjs'), '--user-data-dir=' + data, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env: { ...process.env, SCHOOLWORK_FOLLOWER_TEST_DATA: data },
    timeout: 30_000,
  });
}
const seg = (page, n, total) => page.locator('.follower-progress-label', { hasText: `Segment ${n} of ${total}` });
const waterDeckQuizBelongsToLesson = (q, lesson) => lesson.follow.segments.some(s => s.heading === q.options[q.answer]);
const PASTED = [
  '# Photosynthesis',
  '',
  'Plants turn light into energy. **Chlorophyll** in the leaves captures the light and **chloroplasts** store the energy as sugar. Water travels up the stem from the roots.',
  '',
  '## The light reactions',
  '',
  'Light energy splits water in the thylakoid membranes. The released energy is carried as ATP and NADPH into the next stage of the process.',
  '',
  '## The Calvin cycle',
  '',
  'Carbon dioxide enters the leaf through tiny pores called stomata. The Calvin cycle fixes that carbon into sugar using the energy from the light reactions.',
].join('\n');
try {
  app = await launch();
  app.process().stderr.on('data', chunk => { void fs.appendFile(path.join(shots, 'electron-stderr.log'), chunk); });
  let page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.schoolwork));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Lesson Follower' }).click();
  await page.getByRole('heading', { name: 'Bring a lesson along.' }).waitFor();
  await page.getByText(/No API key configured . the lesson is structured offline/).waitFor();
  pass('follower opens on the import view with the offline banner when no key is configured');
  await page.locator('textarea.follow-textarea').fill(PASTED);
  await page.getByRole('button', { name: 'Import and start following' }).click();
  await seg(page, 1, 3).waitFor({ timeout: 20_000 });
  await page.locator('.lesson-intro h1', { hasText: 'Photosynthesis' }).waitFor();
  await page.getByText(/Structured offline . no API key was available/).waitFor();
  await page.getByText(/Offline structure: parts follow the lesson/).waitFor();
  const chips = await page.locator('.follower-concepts em').allTextContents();
  assert(chips.includes('Chlorophyll'), 'Chlorophyll chip missing: ' + chips.join(', '));
  pass('pasted lesson is structured offline into three titled segments with key-concept chips and visible offline notices');
  await page.screenshot({ path: path.join(shots, 'follower-segment-1.png') });
  await page.getByRole('button', { name: 'Next' }).click();
  await seg(page, 2, 3).waitFor();
  assert.equal(await page.locator('.follower-jump button[aria-current="true"]').textContent(), '2');
  assert.equal(await page.locator('.follower-jump button[aria-current="true"]').getAttribute('aria-label'), 'Go to segment 2: The light reactions');
  await page.getByRole('button', { name: 'Previous' }).click();
  await seg(page, 1, 3).waitFor();
  await page.locator('.follower-jump button').nth(2).click();
  await seg(page, 3, 3).waitFor();
  assert.equal(await page.locator('.follower-jump button[aria-current="true"]').textContent(), '3');
  pass('next, previous and jump navigation move the persisted segment position');
  await page.getByRole('button', { name: 'Previous' }).click();
  await seg(page, 2, 3).waitFor();
  await page.getByText(/Needs your TeachGPT API key . add it in Settings\./).waitFor();
  await page.getByRole('button', { name: 'Explain more' }).click();
  await page.locator('.lesson-notice').getByText(/Explanations need your TeachGPT API key\./).waitFor();
  await page.waitForTimeout(200);
  assert.equal(await app.evaluate(() => global.__followerTest.explainRequests.length), 0, 'no model request may leave the app without a key');
  pass('Explain more without a key shows the needs-API-key notice and sends nothing');
  // The native file dialog is resolved to a fixture file by the harness.
  await page.getByRole('button', { name: 'Import a lesson' }).click();
  await app.evaluate(() => { global.__followerTest.cancelledDialog = true; });
  await page.getByRole('button', { name: /Choose a \.txt\/\.md file/ }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(async () => (await window.schoolwork.followList()).length), 1, 'cancelled dialog must not import');
  assert.deepEqual(await app.evaluate(() => global.__followerTest.dialogTitles), ['Import a lesson file'], 'dialog opened with the lesson-file title');
  await app.evaluate(() => { global.__followerTest.cancelledDialog = false; });
  await page.getByRole('button', { name: /Choose a \.txt\/\.md file/ }).click();
  await page.getByRole('heading', { name: 'fixture-lesson' }).waitFor({ timeout: 20_000 });
  await seg(page, 1, 2).waitFor();
  const fixtureFile = await page.evaluate(async () => (await window.schoolwork.followList()).find(l => l.title === 'fixture-lesson'));
  assert.equal(fixtureFile.follow.sourceName, 'fixture-lesson.md');
  assert.equal(fixtureFile.language, 'en', 'detectLanguage must recognise the English fixture');
  assert.equal(await page.evaluate(async () => (await window.schoolwork.followList()).length), 2);
  pass('file import reads the chosen .md file, auto-detects its language and adds it to the lesson list; a cancelled dialog imports nothing');
  const fixtureId = fixtureFile.id;
  await page.getByRole('button', { name: 'Next' }).click();
  await seg(page, 2, 2).waitFor();
  assert.equal((await page.evaluate(id => window.schoolwork.followGet(id), fixtureId)).follow.current, 1);
  pass('file-imported lesson follows with its own segments');
  // Restart: lessons, structure and the reading position survive.
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.schoolwork));
  page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Lesson Follower' }).click();
  await seg(page, 2, 2).waitFor({ timeout: 20_000 });
  assert.equal((await page.evaluate(id => window.schoolwork.followGet(id), fixtureId)).follow.current, 1);
  assert.equal(await page.evaluate(async () => (await window.schoolwork.followList()).length), 2);
  pass('lessons and the reading position resume after an application restart');
  await page.screenshot({ path: path.join(shots, 'follower-resumed.png') });
  // Delete flow: confirm dialog, then the lesson and its state are gone.
  await page.getByRole('button', { name: 'Delete fixture-lesson' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const remaining = await page.evaluate(() => window.schoolwork.followList());
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].title, 'Photosynthesis');
  pass('delete removes the lesson and its persisted state');
  // --- Phase 2: comprehension checkpoints and the personal gap report (fully offline) ---
  // Select the remaining Photosynthesis lesson; its reading position is still segment 2.
  await page.locator('.lesson-history-row', { hasText: 'Photosynthesis' }).locator('button').first().click();
  await seg(page, 2, 3).waitFor();
  const photoId = remaining[0].id;
  await page.getByRole('button', { name: 'Previous' }).click();
  await seg(page, 1, 3).waitFor();
  // 1) Self-check on segment 1: offline recall questions appear, plain-text answers are
  // recorded, and the length heuristic grades them without any model call.
  await page.getByRole('button', { name: 'Check myself' }).click();
  assert.equal(await page.locator('.follow-checkpoint .follow-answer').count(), 2, 'offline checkpoint must offer two recall questions');
  assert.ok((await page.locator('.follow-checkpoint .follow-answer-top span').first().textContent()).includes('List two key concepts'), 'first offline question is the key-concepts recall prompt');
  await page.locator('.follow-checkpoint .follow-answer textarea').nth(0).fill('Chlorophyll captures light and chloroplasts store the energy as sugar.');
  await page.getByRole('button', { name: 'Save my answers' }).click();
  await page.locator('.follow-checkpoint .follow-verdict.pass').first().waitFor({ timeout: 15_000 });
  let photo = await page.evaluate(id => window.schoolwork.followGet(id), photoId);
  assert.equal(photo.follow.segments[0].status, 'answered');
  assert.equal(photo.follow.segments[0].source, 'offline');
  assert.deepEqual(photo.follow.segments[0].questions.map(q => q.verdict), ['pass', 'review']);
  pass('the offline self-check offers recall questions, records plain-text answers and grades them with the length heuristic');
  // 2) Segment 2 is skipped.
  await page.getByRole('button', { name: 'Next' }).click();
  await seg(page, 2, 3).waitFor();
  await page.getByRole('button', { name: 'Skip this part' }).click();
  await page.locator('.lesson-card-head .follow-verdict.skip', { hasText: 'Skipped' }).waitFor({ timeout: 15_000 });
  photo = await page.evaluate(id => window.schoolwork.followGet(id), photoId);
  assert.equal(photo.follow.segments[1].status, 'skipped');
  pass('a part can be skipped and the skip is persisted');
  // 3) Segment 3 is answered solidly: every question passes.
  await page.getByRole('button', { name: 'Next' }).click();
  await seg(page, 3, 3).waitFor();
  await page.getByRole('button', { name: 'Check myself' }).click();
  const segment3Textareas = page.locator('.follow-checkpoint .follow-answer textarea');
  assert.equal(await segment3Textareas.count(), 2);
  await segment3Textareas.nth(0).fill('Carbon dioxide enters through stomata and the Calvin cycle fixes it into sugar.');
  await segment3Textareas.nth(1).fill('The Calvin cycle uses ATP and NADPH from the light reactions to build sugar.');
  await page.getByRole('button', { name: 'Save my answers' }).click();
  photo = await page.evaluate(id => window.schoolwork.followGet(id), photoId);
  assert.deepEqual(photo.follow.segments[2].questions.map(q => q.verdict), ['pass', 'pass']);
  pass('a fully answered part grades every question passing');
  // 4) Finish: the gap report is computed, shown and persisted with the lesson.
  await page.getByRole('button', { name: 'Finish & get my gap report' }).click();
  await page.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor();
  const statText = (await page.locator('.follow-stat').allTextContents()).join(' | ');
  assert.ok(statText.includes('SEGMENTS3') && statText.includes('ANSWERED2') && statText.includes('SKIPPED1') && statText.includes('SELF-CHECK ANSWERED3'), 'report stats: ' + statText);
  const reviewRows = (await page.locator('.follow-review-row').allTextContents()).join(' | ');
  assert.ok(reviewRows.includes('Photosynthesis') && reviewRows.includes('The light reactions') && reviewRows.includes('Skipped'), 'to-review rows: ' + reviewRows);
  assert.equal(await page.locator('.follow-report details .follow-verdict.review').count(), 1, 'the weak segment shows its review verdict');
  assert.equal(await page.locator('.follow-report details .follow-verdict.pass').count(), 1, 'the clean segment shows its pass verdict');
  photo = await page.evaluate(id => window.schoolwork.followGet(id), photoId);
  assert.deepEqual(photo.follow.report, { totalSegments: 3, completedSegments: 2, skippedSegments: 1, askedQuestions: 4, answeredQuestions: 3, skippedQuestions: 1, reviewSegmentIds: [photo.follow.segments[0].id, photo.follow.segments[1].id] });
  assert.equal(await app.evaluate(() => global.__followerTest.explainRequests.length), 0, 'no model request may leave the app without a key');
  await page.screenshot({ path: path.join(shots, 'follower-gap-report.png') });
  pass('finishing shows the gap report: stats, to-review list and per-question self-check results, persisted with the lesson');
  // 5) Restart: the report is shown again for the finished lesson, and "Review weak
  // segments" jumps the follow view to the first flagged part.
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.schoolwork));
  page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Lesson Follower' }).click();
  await page.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor({ timeout: 20_000 });
  photo = await page.evaluate(id => window.schoolwork.followGet(id), photoId);
  assert.ok(photo.follow.report, 'the report must survive the restart');
  await page.getByRole('button', { name: 'Review weak segments' }).click();
  await seg(page, 1, 3).waitFor();
  assert.equal(await page.locator('.follower-jump button.flagged').count(), 2, 'flagged parts stay marked in the jump nav');
  await page.screenshot({ path: path.join(shots, 'follower-review-jump.png') });
  pass('the gap report is shown again when the finished lesson is reopened, and Review weak segments jumps to the first flagged part');
  // --- Phase 3: generated review deck + spaced review queue (fully offline) ---
  const WATER = [
    '# The Water Cycle',
    '',
    'Water evaporates from warm oceans and lakes. **Evaporation** lifts moisture into the air as invisible vapour.',
    '',
    '## Condensation',
    '',
    'The rising vapour cools and **condensation** turns it back into tiny droplets. These droplets gather and form clouds.',
    '',
    '## Precipitation',
    '',
    'When the droplets grow heavy, **precipitation** falls to the ground as rain, snow or hail.',
    '',
    '## Collection',
    '',
    'The fallen water flows into rivers and lakes. **Collection** gathers it in oceans until the cycle starts again.',
  ].join('\n');
  const optionIndexByText = async (text) => {
    const n = await page.locator('.follow-quiz-option').count();
    for (let i = 0; i < n; i++) {
      const t = (await page.locator('.follow-quiz-option').nth(i).textContent()).replace(/^[A-D]\s*/, '').trim();
      if (t === text) return i;
    }
    throw new Error('quiz option not found: ' + text);
  };
  // 1) A four-part lesson, finished without answers, gets an offline review deck with cards and location quiz.
  await page.getByRole('button', { name: 'Import a lesson' }).click();
  await page.locator('textarea.follow-textarea').fill(WATER);
  await page.getByRole('button', { name: 'Import and start following' }).click();
  await seg(page, 1, 4).waitFor({ timeout: 20_000 });
  const waterId = (await page.evaluate(() => window.schoolwork.followList())).find(l => l.title === 'The Water Cycle').id;
  const waterBefore = await page.evaluate(id => window.schoolwork.followGet(id), waterId);
  await page.locator('.follower-jump button').nth(3).click();
  await seg(page, 4, 4).waitFor();
  await page.getByRole('button', { name: 'Finish & get my gap report' }).click();
  await page.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor();
  await page.getByRole('button', { name: 'Build review deck' }).click();
  await page.locator('.follow-card-front').waitFor({ timeout: 15_000 });
  let waterDeck = await page.evaluate(id => window.schoolwork.followDeck(id), waterId);
  assert.equal(waterDeck.source, 'offline', 'no key must mean an offline deck');
  assert.ok(waterDeck.cards.length >= 5 && waterDeck.cards.length <= 10, '5-10 cards: ' + waterDeck.cards.length);
  assert.equal(waterDeck.quiz.length, 3, 'a four-part lesson builds three location questions');
  assert.ok(waterDeck.quiz.every(q => q.options.length === 4 && new Set(q.options.map(o => o.toLowerCase())).size === 4), 'quiz options are distinct');
  assert.ok(waterDeck.quiz.every(q => waterDeckQuizBelongsToLesson(q, waterBefore)), 'quiz answers point at real segments');
  pass('a finished lesson generates an offline review deck: concept cards and location quiz questions, with zero model traffic');
  // 2) Step through the deck: reveal each card, mark one 'still learning' and the rest 'got it', then score the quiz.
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await page.getByRole('button', { name: 'Still learning' }).click();
  for (let i = 1; i < waterDeck.cards.length; i++) {
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'Got it' }).click();
  }
  await page.locator('.follow-quiz-option').first().waitFor({ timeout: 15_000 });
  const lq = waterDeck.quiz;
  await page.locator('.follow-quiz-option').nth(await optionIndexByText(lq[0].options[lq[0].answer])).click();
  await page.getByRole('button', { name: 'Next question' }).click();
  await page.locator('.follow-quiz-option').nth(await optionIndexByText(lq[1].options[lq[1].answer === 0 ? 1 : 0])).click();
  await page.getByText(/Not quite\. The correct answer is/).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor();
  waterDeck = await page.evaluate(id => window.schoolwork.followDeck(id), waterId);
  const nowMs = Date.now();
  assert.ok(waterDeck.items[0].dueAt > nowMs && waterDeck.items[0].intervalIndex === 0, 'still-learning comes back tomorrow');
  assert.ok(waterDeck.items[1].dueAt > waterDeck.items[0].dueAt && waterDeck.items[1].correct === 1, 'got-it is scheduled farther out');
  assert.ok(waterDeck.items[waterDeck.cards.length + 1].correct === 0, 'a wrong quiz answer is recorded as still learning');
  let queue = await page.evaluate(() => window.schoolwork.followDueQueue());
  assert.deepEqual(queue, { count: 1, lessons: [{ lessonId: waterId, title: 'The Water Cycle', cards: 0, quiz: 1 }] }, 'only the unreviewed quiz question is due: ' + JSON.stringify(queue));
  pass('cards are revealed and marked got it / still learning, the quiz scores answers and shows the correct one, and the due queue follows the marks');
  // 3) The sidebar badge shows the due count.
  await page.getByRole('button', { name: 'SchoolWork', exact: true }).click();
  await page.waitForFunction(() => { const el = document.querySelector('.shell'); return el && !el.hasAttribute('inert'); }, null, { timeout: 30_000 });
  await page.locator('.review-nav .review-badge', { hasText: '1' }).waitFor({ timeout: 15_000 });
  pass('the Due reviews sidebar badge shows the due-review count');
  // 4) Photosynthesis: open its gap report, build its deck, review every card to the results screen.
  await page.getByRole('button', { name: 'Lesson Follower' }).click();
  await page.locator('.lesson-history-row', { hasText: 'Photosynthesis' }).locator('button').first().click();
  await page.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Build review deck' }).click();
  await page.locator('.follow-card-front').waitFor({ timeout: 15_000 });
  const photoDeck = await page.evaluate(id => window.schoolwork.followDeck(id), photoId);
  assert.equal(photoDeck.quiz.length, 0, 'a three-part lesson builds no location quiz');
  for (let i = 0; i < photoDeck.cards.length; i++) {
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: i === 0 ? 'Still learning' : 'Got it' }).click();
  }
  await page.locator('.follow-done-copy').waitFor({ timeout: 15_000 });
  queue = await page.evaluate(() => window.schoolwork.followDueQueue());
  assert.equal(queue.count, 1, 'a fully reviewed lesson adds nothing to the due queue');
  const photoAfter = await page.evaluate(id => window.schoolwork.followGet(id), photoId);
  assert.equal(photoAfter.text, PASTED, 'the lesson document is untouched by reviewing');
  pass('a full card pass reaches the results screen, and reviewing never touches the lesson document');
  // 5) Regeneration: one deck per lesson, schedule state reset, document intact.
  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('.lesson-history-row', { hasText: 'The Water Cycle' }).locator('button').first().click();
  await page.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor();
  await page.getByRole('button', { name: 'Open review deck' }).click();
  await page.locator('.follow-card-front').waitFor();
  await page.getByRole('button', { name: 'Regenerate deck' }).click();
  await page.getByRole('button', { name: /Really regenerate/ }).click();
  await page.locator('.follow-card-front').waitFor({ timeout: 15_000 });
  waterDeck = await page.evaluate(id => window.schoolwork.followDeck(id), waterId);
  assert.ok(waterDeck.items.every(i => i.attempts === 0 && i.dueAt <= Date.now()), 'regeneration resets the schedule');
  queue = await page.evaluate(() => window.schoolwork.followDueQueue());
  assert.deepEqual(queue, { count: waterDeck.items.length, lessons: [{ lessonId: waterId, title: 'The Water Cycle', cards: waterDeck.cards.length, quiz: waterDeck.quiz.length }] }, 'regenerated items are all due again: ' + JSON.stringify(queue));
  assert.equal(await page.evaluate(() => window.schoolwork.followList().then(l => l.length)), 2, 'regeneration never duplicates lessons');
  const waterAfter = await page.evaluate(id => window.schoolwork.followGet(id), waterId);
  assert.equal(waterAfter.text, waterBefore.text, 'regeneration leaves the lesson document intact');
  assert.deepEqual(waterAfter.follow.segments.map(s => [s.status, s.questions.length]), waterBefore.follow.segments.map(s => [s.status, s.questions.length]), 'regeneration leaves the follow state intact');
  pass('regenerating replaces the single deck idempotently, resets the schedule, and never duplicates a deck');
  // 6) Restart: the badge persists and the queue deep-links into the lesson's review deck.
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.schoolwork));
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => { const el = document.querySelector('.shell'); return el && !el.hasAttribute('inert'); }, null, { timeout: 30_000 });
  await page.locator('.review-nav .review-badge', { hasText: String(waterDeck.items.length) }).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Due reviews' }).click();
  await page.locator('.follow-review-row', { hasText: 'The Water Cycle' }).waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Review now' }).click();
  await page.locator('.follow-card-front').waitFor({ timeout: 20_000 });
  const resumed = await page.evaluate(id => window.schoolwork.followDeck(id), waterId);
  assert.ok(resumed.items.length === resumed.cards.length + resumed.quiz.length, 'the queue resumes the regenerated deck');
  assert.equal(await app.evaluate(() => global.__followerTest.explainRequests.length), 0, 'no model request may leave the app without a key');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(shots, 'follower-review-queue.png') });
  pass('the due-review badge and queue survive a restart, and Review now reopens the lesson’s review deck');
  await page.screenshot({ path: path.join(shots, 'follower-final.png') });
  console.log(`PASS: ${results.length} lesson-follower UI checks; real Electron IPC, offline structuring, self-checks, the persisted gap report and persistence exercised with no external traffic.`);
} catch (error) {
  console.error('FOLLOWER_TEST_FAILURE', error);
  if (app) {
    const page = await app.firstWindow().catch(() => null);
    await page?.screenshot({ path: path.join(shots, 'failure.png') }).catch(() => {});
    console.log('SAVED_SESSION_DIAGNOSTIC', await page?.evaluate(() => window.schoolwork.followList()).catch(() => []));
  }
  throw error;
} finally {
  if (app) { app.process().kill(); await app.close().catch(() => {}); }
  await fs.rm(data, { recursive: true, force: true });
}
