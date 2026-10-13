// Live end-to-end verification: the real built app on the isolated dev profile,
// with the real TeachGPT key entered through the Settings UI (never written by
// this script). The key file path arrives only via SCHOOLWORK_FOLLOWER_KEY_FILE.
// Phase 2: also verifies live model self-check questions, live verdicts, the
// persisted gap report and the "Review weak segments" jump after a restart.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const keyFile = process.env.SCHOOLWORK_FOLLOWER_KEY_FILE;
if (!keyFile || !path.isAbsolute(keyFile)) throw new Error('Set SCHOOLWORK_FOLLOWER_KEY_FILE to an absolute key-file path.');
const key = fs.readFileSync(keyFile, 'utf8').trim();
if (!key) throw new Error('The key file is empty.');
const profile = path.resolve('work/dev-profile');
fs.mkdirSync(profile, { recursive: true });
const shots = path.resolve('work/follower-verification');
fs.mkdirSync(shots, { recursive: true });
const settingsFile = path.join(profile, 'schoolwork-settings.json');
if (!fs.existsSync(settingsFile)) {
  fs.writeFileSync(settingsFile, JSON.stringify({ model: 'Qwen3.8-27B', workspace: path.resolve('work/dev-workspace'), language: 'en', capabilities: { allApps: false, launchApps: false, viewScreen: false, controlScreen: false, allowedApps: [] } }));
}
const lesson = fs.readFileSync(path.resolve('work/dev-workspace/lesson-photosynthesis.md'), 'utf8');

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

  // 2) Import the sample lesson; the live model must structure it (4-10 titled segments, 2-5 concepts each).
  await page.getByRole('button', { name: 'Lesson Follower' }).click();
  await page.locator('.lesson-shell').waitFor();
  // A previous lesson in the profile is auto-selected; force the import view.
  await page.getByRole('button', { name: /Import a lesson|Importera en lektion/ }).click();
  await page.locator('.follow-textarea').fill(lesson);
  await page.getByRole('button', { name: 'Import and start following' }).click();
  console.log('live model structuring in flight...');
  await page.locator('.lesson-card.follow-segment').waitFor({ timeout: 300_000 });
  const imported = (await page.evaluate(() => window.schoolwork.followList())).find(l => l.title === 'Fotosyntes');
  assert.ok(imported, 'imported lesson must be listed with its title');
  assert.equal(imported.follow.structured, 'model', 'a live key must produce model-structured segments');
  assert.ok(imported.follow.segments.length >= 4 && imported.follow.segments.length <= 10, '4-10 segments: ' + imported.follow.segments.length);
  assert.ok(imported.follow.segments.every(s => s.concepts.length >= 2 && s.concepts.length <= 5), '2-5 concepts per segment');
  await page.getByText('Structured with Qwen3.8-27B').waitFor();
  assert.equal(await page.getByText(/Offline structure: parts follow/).count(), 0, 'no offline banner with a live key');
  console.log('lesson structured live:', imported.follow.segments.length, 'segments');
  await page.screenshot({ path: path.join(shots, 'live-segment-1.png') });

  // 3) Live "Explain more" through the real Work send path.
  await page.getByRole('button', { name: 'Explain more' }).click();
  await page.locator('.follower-reply').first().waitFor({ timeout: 300_000 });
  await page.getByRole('button', { name: 'Open in Work' }).waitFor({ timeout: 300_000 });
  const after = await page.evaluate(id => window.schoolwork.followGet(id), imported.id);
  assert.ok(after.follow.explainChatId, 'the explain chat id must be persisted on the lesson');
  const chat = await page.evaluate(id => window.schoolwork.getChat(id), after.follow.explainChatId);
  assert.equal(chat.task.state, 'completed', 'the explain task must complete');
  console.log('live explain answered via Work task', after.follow.explainChatId);
  await page.screenshot({ path: path.join(shots, 'live-explain.png') });

  // 4) Leave the reading position at segment 3.
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('.follower-jump button[aria-current="true"]', { hasText: '2' }).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('.follower-jump button[aria-current="true"]', { hasText: '3' }).waitFor({ timeout: 30_000 });
  const final = await page.evaluate(id => window.schoolwork.followGet(id), imported.id);
  assert.equal(final.follow.current, 2, 'position must be left at segment 3');
  await page.screenshot({ path: path.join(shots, 'live-segment-3.png') });

  // 5) Phase 2, live: the model must generate 1-3 self-check questions for this segment.
  await page.getByRole('button', { name: 'Check myself' }).click();
  await page.locator('.follow-checkpoint .follow-answer textarea').first().waitFor({ timeout: 180_000 });
  let live = await page.evaluate(id => window.schoolwork.followGet(id), imported.id);
  const liveSeg = live.follow.segments[2];
  assert.equal(liveSeg.source, 'model', 'a live key must produce model-generated self-check questions');
  const liveQuestions = liveSeg.questions.map(q => q.text);
  assert.ok(liveQuestions.length >= 1 && liveQuestions.length <= 3, '1-3 questions: ' + JSON.stringify(liveQuestions));
  assert.ok(liveQuestions.every(q => q.length >= 6 && q.length <= 240), 'question lengths within contract');
  const OFFLINE_BANK = [
    'List two key concepts from this part from memory and give each a one-sentence explanation.',
    'Explain the main idea of this part in your own words.',
    'Which example, number, or formula in this part matters most? Why?',
    'Summarise this part in two or three sentences, as if explaining it to a classmate.',
    'Notera två viktiga begrepp ur det här avsnittet ur minnet och ge varje en kort förklaring.',
    'Förklara det huvudsakliga innehållet i det här avsnittet med egna ord.',
    'Vilket exempel, tal eller formel i avsnittet är viktigast? Varför?',
    'Sammanfatta avsnittet på två till tre meningar, som om du förklarade det för en klasskamrat.',
  ];
  assert.ok(liveQuestions.some(q => !OFFLINE_BANK.includes(q)), 'at least one question must come from the model, not the offline bank');
  console.log('live self-check questions:', liveQuestions.length);
  await page.screenshot({ path: path.join(shots, 'live-questions.png') });

  // 6) Plain-text answers are graded live: every question gets a verdict and feedback.
  for (let i = 0; i < liveSeg.questions.length; i++) {
    const concept = liveSeg.concepts[i % liveSeg.concepts.length] || 'the process';
    await page.locator('.follow-checkpoint .follow-answer textarea').nth(i).fill(`The part explains how ${concept} works in the process, with the concrete steps that make it happen.`);
  }
  await page.getByRole('button', { name: 'Save my answers' }).click();
  await page.locator('.follow-checkpoint .follow-verdict').first().waitFor({ timeout: 180_000 });
  live = await page.evaluate(id => window.schoolwork.followGet(id), imported.id);
  const graded = live.follow.segments[2];
  assert.equal(graded.status, 'answered');
  assert.ok(graded.questions.every(q => (q.verdict === 'pass' || q.verdict === 'review') && typeof q.feedback === 'string'), 'live verdicts: ' + JSON.stringify(graded.questions.map(q => q.verdict)));
  console.log('live verdicts:', graded.questions.map(q => q.verdict).join(', '));
  await page.screenshot({ path: path.join(shots, 'live-answers.png') });

  // 7) Skip segment 2, then finish from the last segment: the gap report must flag it.
  await page.getByRole('button', { name: 'Previous' }).click();
  await page.locator('.follower-jump button[aria-current="true"]', { hasText: '2' }).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Skip this part' }).click();
  const total = (await page.evaluate(id => window.schoolwork.followGet(id), imported.id)).follow.segments.length;
  await page.locator('.follower-jump button').nth(total - 1).click();
  await page.getByRole('button', { name: 'Finish & get my gap report' }).click();
  await page.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor({ timeout: 30_000 });
  live = await page.evaluate(id => window.schoolwork.followGet(id), imported.id);
  assert.ok(live.follow.report, 'the report must be persisted at finish');
  assert.ok(live.follow.report.reviewSegmentIds.includes(live.follow.segments[1].id), 'the skipped segment must be flagged for review');
  console.log('live gap report:', JSON.stringify(live.follow.report));
  await page.screenshot({ path: path.join(shots, 'live-gap-report.png') });

  // 8) Restart: the report is shown again and "Review weak segments" jumps to the first flagged part.
  await app.close();
  app = await electron.launch({
    executablePath: process.platform === 'win32' ? path.resolve('node_modules/electron/dist/electron.exe') : path.resolve('node_modules/electron/dist/electron'),
    args: ['.', '--user-data-dir=' + profile, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    timeout: 60_000,
  });
  const page2 = await app.firstWindow();
  page2.setDefaultTimeout(60_000);
  page2.on('pageerror', e => errors.push(e.message));
  await page2.waitForFunction(() => Boolean(window.schoolwork), null, { timeout: 45_000 });
  await page2.waitForFunction(() => { const el = document.querySelector('.shell'); return el && !el.hasAttribute('inert'); }, null, { timeout: 30_000 });
  await page2.getByRole('button', { name: 'Lesson Follower' }).click();
  await page2.locator('.lesson-intro .lesson-eyebrow', { hasText: 'GAP REPORT' }).waitFor({ timeout: 30_000 });
  const reopened = (await page2.evaluate(() => window.schoolwork.followList())).find(l => l.id === imported.id);
  assert.ok(reopened.follow.report, 'the report must survive the restart');
  const firstFlagged = reopened.follow.segments.findIndex(s => s.id === reopened.follow.report.reviewSegmentIds[0]);
  await page2.getByRole('button', { name: 'Review weak segments' }).click();
  await page2.locator('.follower-jump button[aria-current="true"]', { hasText: String(firstFlagged + 1) }).waitFor({ timeout: 30_000 });
  assert.deepEqual(errors, []);
  await page2.screenshot({ path: path.join(shots, 'live-review-jump.png') });
  console.log(`LIVE-FOLLOWER-VERIFY PASS — ${total} live-structured segments, live explain, live self-check questions and verdicts, gap report persisted and reopened with the review jump to segment ${firstFlagged + 1}.`);
} catch (error) {
  console.error('LIVE_FOLLOWER_FAILURE', error);
  if (app) {
    const page = await app.firstWindow().catch(() => null);
    await page?.screenshot({ path: path.join(shots, 'live-failure.png') }).catch(() => {});
    console.log('SAVED_SESSION_DIAGNOSTIC', await page?.evaluate(() => window.schoolwork.followList()).catch(() => []));
  }
  throw error;
} finally {
  if (app) { app.process().kill(); await app.close().catch(() => {}); }
}
