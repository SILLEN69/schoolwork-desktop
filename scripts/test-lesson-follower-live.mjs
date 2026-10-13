// Live end-to-end verification: the real built app on the isolated dev profile,
// with the real TeachGPT key entered through the Settings UI (never written by
// this script). The key file path arrives only via SCHOOLWORK_FOLLOWER_KEY_FILE.
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
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(shots, 'live-segment-3.png') });
  console.log(`LIVE-FOLLOWER-VERIFY PASS — ${imported.follow.segments.length} live-structured segments, live explain completed, position left at segment 3 of ${imported.follow.segments.length}.`);
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
