// Live end-to-end verification of Exam Prep phase 2 in the real built app on the
// isolated dev profile, with the real TeachGPT key entered through the Settings UI
// (never written by this script). Verifies: a model-built exam, submitting it,
// instant local MC grading, model grading of free-text answers with score and
// rationale, the scored results screen, idempotent re-grading, the mistake review
// walk, and sending missed topics into a conversation through the normal send path.
// The key file path arrives only via SCHOOLWORK_EXAM_KEY_FILE.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const keyFile = process.env.SCHOOLWORK_EXAM_KEY_FILE;
if (!keyFile || !path.isAbsolute(keyFile)) throw new Error('Set SCHOOLWORK_EXAM_KEY_FILE to an absolute key-file path.');
const key = fs.readFileSync(keyFile, 'utf8').trim();
if (!key) throw new Error('The key file is empty.');
const profile = path.resolve('work/dev-profile');
fs.mkdirSync(profile, { recursive: true });
const shots = path.resolve('work/exam-verification');
fs.mkdirSync(shots, { recursive: true });
fs.writeFileSync(path.join(shots, 'live-electron-stderr.log'), '');
const settingsFile = path.join(profile, 'schoolwork-settings.json');
if (!fs.existsSync(settingsFile)) {
  fs.writeFileSync(settingsFile, JSON.stringify({ model: 'Qwen3.8-27B', workspace: path.resolve('work/dev-workspace'), language: 'en', capabilities: { allApps: false, launchApps: false, viewScreen: false, controlScreen: false, allowedApps: [] } }));
}
const notes = [
  '# Photosynthesis',
  'Plants use light to make sugar in the chloroplasts. Chlorophyll captures the light energy.',
  '',
  '## Light reactions',
  'The light reactions happen in the thylakoids and produce ATP. NADPH is also generated for the next stage.',
  '',
  '## Calvin cycle',
  'The Calvin cycle fixes carbon dioxide into sugar in the stroma. This stage does not need light directly.',
  '',
  '## Cellular respiration',
  'Cells break down glucose and release energy as ATP. It happens in the mitochondrion of the cell.',
].join('\n');
const WRONG_FREE_TEXT = 'No idea.';

let app;
try {
  app = await electron.launch({
    executablePath: process.platform === 'win32' ? path.resolve('node_modules/electron/dist/electron.exe') : path.resolve('node_modules/electron/dist/electron'),
    args: ['.', '--user-data-dir=' + profile, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    timeout: 60_000,
  });
  const page = await app.firstWindow();
  app.process().stderr.on('data', chunk => fs.appendFileSync(path.join(shots, 'live-electron-stderr.log'), chunk));
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => Boolean(window.schoolwork), null, { timeout: 45_000 });
  await page.waitForFunction(() => { const el = document.querySelector('.shell'); return el && !el.hasAttribute('inert'); }, null, { timeout: 30_000 });

  // 1) Configure the key through the real Settings UI in this isolated profile only.
  let settings = await page.evaluate(() => window.schoolwork.settingsGet());
  if (!settings.configured) {
    await page.getByRole('button', { name: 'Settings', exact: false }).last().click();
    await page.locator('.settings-modal .key-row input[type=password]').fill(key);
    await page.locator('.settings-modal .key-row .primary-btn').click();
    await page.locator('.settings-modal .key-state', { hasText: /API key configured|API-nyckel konfigurerad/ }).waitFor({ timeout: 30_000 });
    await page.locator('.settings-modal header .icon').click();
    settings = await page.evaluate(() => window.schoolwork.settingsGet());
    assert.ok(settings.configured, 'API key must be configured');
  }
  assert.equal(settings.model, 'Qwen3.8-27B');
  console.log('configured:', settings.configured, 'model:', settings.model);
  // No task from an earlier run may still occupy a conversation when the missed topic is sent.
  for (const c of await page.evaluate(() => window.schoolwork.listChats(true))) {
    await page.evaluate(id => window.schoolwork.cancel(id), c.id).catch(() => {});
  }

  // 2) Start from a clean exam list in this isolated profile.
  for (const old of await page.evaluate(() => window.schoolwork.examList())) await page.evaluate(id => window.schoolwork.examDelete(id), old.id);
  assert.equal((await page.evaluate(() => window.schoolwork.examList())).length, 0, 'the profile must start with no exams');

  // 3) Build a practice exam from pasted notes through the real UI (live model when possible).
  await page.getByRole('button', { name: 'Practice exams' }).click();
  await page.locator('.exam-shell').waitFor();
  await page.getByRole('button', { name: 'New practice exam' }).click();
  await page.locator('.exam-tabs button', { hasText: 'My own notes' }).click();
  await page.locator('.exam-builder-card input').first().fill('Photosynthesis practice');
  await page.locator('.exam-builder-card .follow-textarea').fill(notes);
  await page.locator('[data-exam-build]').click();
  console.log('live exam build in flight...');
  await page.locator('[data-exam-start]').waitFor({ timeout: 300_000 });
  const built = (await page.evaluate(() => window.schoolwork.examList()))[0];
  assert.ok(built, 'the built exam must be listed');
  console.log('built exam:', built.builtWith, built.questionCount, 'questions');
  assert.ok(built.questionCount >= 4, 'at least 4 questions: ' + built.questionCount);
  await page.screenshot({ path: path.join(shots, '01-ready.png') });

  // 4) Start the exam through the UI and answer: every MC correct, one free-text answer wrong, the rest empty.
  await page.locator('[data-exam-start]').click();
  let doc = await page.evaluate(id => window.schoolwork.examGet(id), built.id);
  assert.equal(doc.state.status, 'in_progress');
  let answeredFreeText = false;
  for (const question of doc.questions) {
    if (question.kind === 'mc') {
      await page.locator(`[data-exam-option="${question.correctIndex}"]`).click();
    } else if (!answeredFreeText) {
      answeredFreeText = true;
      await page.locator('[data-exam-answer]').fill(WRONG_FREE_TEXT);
    }
    await page.waitForTimeout(700); // let the debounced answer persistence land
    if (question !== doc.questions.at(-1)) await page.locator('[data-exam-next]').click();
  }
  doc = await page.evaluate(id => window.schoolwork.examGet(id), built.id);
  assert.equal(doc.state.answers[doc.questions.find(q => q.kind === 'mc').id]?.optionIndex, doc.questions.find(q => q.kind === 'mc').correctIndex, 'the first MC answer must be stored');
  const freeTexts = doc.questions.filter(q => q.kind !== 'mc');
  assert.equal(doc.state.answers[freeTexts[0].id]?.text, WRONG_FREE_TEXT, 'the first free-text answer must be stored');
  console.log('answered:', doc.questions.length, 'questions, free-text answered:', answeredFreeText);
  await page.locator('[data-exam-submit]').click();
  await page.locator('[data-exam-submit-confirm]').click({ timeout: 10_000 }).catch(() => {});
  doc = await page.evaluate(id => window.schoolwork.examGet(id), built.id);
  assert.equal(doc.state.status, 'submitted');
  // MC grading is local and immediate, right after submit.
  const firstMc = doc.questions.find(q => q.kind === 'mc');
  assert.equal(doc.state.grades[firstMc.id]?.verdict, 'correct', 'MC must be graded correct locally and immediately');
  assert.equal(doc.state.grades[firstMc.id]?.gradedWith, 'local');
  await page.screenshot({ path: path.join(shots, '02-submitting.png') });

  // 5) Wait for the model grading run to finish and check per-question scores and rationales.
  const deadline = Date.now() + 420_000;
  while (Date.now() < deadline) {
    doc = await page.evaluate(id => window.schoolwork.examGet(id), built.id);
    if (doc.state.grading && ['done', 'error'].includes(doc.state.grading.status)) break;
    await page.waitForTimeout(5_000);
  }
  assert.equal(doc.state.grading?.status, 'done', 'model grading must finish: ' + JSON.stringify(doc.state.grading));
  const grades = doc.state.grades;
  for (const q of doc.questions.filter(q => q.kind === 'mc')) {
    assert.equal(grades[q.id].verdict, 'correct', 'every MC was answered correctly');
    assert.equal(grades[q.id].score, 1);
  }
  assert.equal(grades[freeTexts[0].id].gradedWith, 'model', 'the answered free-text question must be model-graded');
  const ftScore = grades[freeTexts[0].id].score;
  assert.ok(typeof ftScore === 'number' && ftScore >= 0 && ftScore <= 1, 'model score must be 0-1: ' + ftScore);
  assert.ok(grades[freeTexts[0].id].rationale?.length >= 5, 'a one-line rationale must be stored');
  assert.ok(['wrong', 'partial'].includes(grades[freeTexts[0].id].verdict), 'the deliberately wrong answer must not be graded correct');
  for (const q of freeTexts.slice(1)) {
    assert.equal(grades[q.id].score, 0, 'an empty free-text answer is graded wrong locally, never invented');
    assert.equal(grades[q.id].gradedWith, 'local');
  }
  console.log('model grading done:', freeTexts[0].id.slice(-4), 'score', grades[freeTexts[0].id].score, '-', grades[freeTexts[0].id].rationale);

  // 6) The results screen shows the score, per-question verdicts and the correct answer for the missed ones.
  await page.locator('.exam-score-stats').waitFor({ timeout: 15_000 });
  const scoreText = await page.locator('.exam-score-stats').innerText();
  assert.match(scoreText, /SCORE/i);
  assert.match(scoreText, /\d+%/);
  assert.ok(await page.locator('.exam-verdict.correct').count() >= 1, 'at least one correct verdict chip');
  assert.ok(await page.locator('.exam-correct-answer').count() >= 1, 'missed questions must show the correct answer');
  await page.screenshot({ path: path.join(shots, '03-results.png') });
  console.log('results screen shows score and verdicts:', scoreText.replace(/\n/g, ' '));

  // 7) Re-grading through the UI is idempotent: same question set, nothing duplicated.
  const keysBefore = Object.keys(doc.state.grades).sort();
  await page.locator('[data-exam-regrade]').click();
  const reDeadline = Date.now() + 420_000;
  let regraded;
  while (Date.now() < reDeadline) {
    regraded = await page.evaluate(id => window.schoolwork.examGet(id), built.id);
    if (regraded.state.grading && ['done', 'error'].includes(regraded.state.grading.status)) break;
    await page.waitForTimeout(5_000);
  }
  assert.equal(regraded.state.grading?.status, 'done', 're-grading must finish: ' + JSON.stringify(regraded.state.grading));
  assert.deepEqual(Object.keys(regraded.state.grades).sort(), keysBefore, 're-grading must not duplicate results');
  console.log('re-grade idempotent:', keysBefore.length, 'grades before and after');

  // 8) The mistake review walks only the missed/uncertain questions with the explanation.
  const missed = regraded.questions.filter(q => ['wrong', 'partial', 'needs_review'].includes(regraded.state.grades[q.id]?.verdict));
  const correct = regraded.questions.filter(q => regraded.state.grades[q.id]?.verdict === 'correct');
  assert.ok(missed.length >= 1, 'there must be at least one missed question to review');
  await page.locator('[data-exam-review-mistakes]').click();
  await page.getByText('MISTAKE REVIEW').waitFor({ timeout: 15_000 });
  let seen = 0;
  for (;;) {
    const prompt = await page.locator('.exam-question-card .lesson-card-head h2').innerText();
    assert.ok(missed.some(q => q.prompt === prompt), 'the review must only walk missed questions, saw: ' + prompt);
    assert.ok(!correct.some(q => q.prompt === prompt), 'a correct question must never appear in the review');
    assert.ok(await page.locator('.exam-review-answer.reference').count() >= 1, 'each reviewed question shows what a good answer looks like');
    seen++;
    await page.screenshot({ path: path.join(shots, `04-review-${seen}.png`) });
    const next = page.locator('[data-exam-review-next]');
    if (await next.count() === 0) { await page.locator('[data-exam-review-done]').click(); break; }
    await next.click();
  }
  assert.equal(seen, missed.length, 'the review must walk every missed question exactly once: ' + seen + ' vs ' + missed.length);
  await page.screenshot({ path: path.join(shots, '05-review-done.png') });
  console.log('mistake review walked', seen, 'missed questions');

  // 9) A missed topic can be sent into a conversation through the normal send path.
  await page.locator('[data-exam-review-mistakes]').click();
  await page.getByText('MISTAKE REVIEW').waitFor({ timeout: 15_000 });
  const firstMissedPrompt = await page.locator('.exam-question-card .lesson-card-head h2').innerText();
  await page.locator('[data-exam-ask]').click();
  // The exam view closes and the message lands in the current conversation.
  await page.locator('.shell').waitFor({ timeout: 15_000 });
  await page.waitForFunction(p => Array.from(document.querySelectorAll('.user-bubble')).some(n => n.textContent.includes(p)), firstMissedPrompt, { timeout: 30_000 });
  console.log('missed topic sent into the conversation');
  await page.screenshot({ path: path.join(shots, '06-sent-to-conversation.png') });
  // The sent message must be persisted in exactly one conversation; stop the task it started.
  const chats = await page.evaluate(() => window.schoolwork.listChats());
  const target = chats.find(x => (x.messages || []).some(m => m.content?.includes(firstMissedPrompt)));
  assert.ok(target, 'the sent message must live in one of the conversations');
  await page.evaluate(id => window.schoolwork.cancel(id), target.id).catch(() => {});
  await page.waitForTimeout(3_000);

  assert.equal(errors.length, 0, 'no renderer errors: ' + errors.join(' | '));
  console.log('EXAM-PREP-LIVE: ALL CHECKS PASSED');
} finally {
  await app?.close().catch(() => {});
}
