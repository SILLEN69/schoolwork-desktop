// Live end-to-end verification of Task Rescue in the real built app on the
// isolated dev profile, with live TeachGPT inference:
//  1) a running task is paused from the status box; the rescue panel appears
//     automatically with the ordered step timeline, the paused state, the
//     resume point and a working Resume (the existing control path);
//  2) while a second, long-running task is mid-tool, the app process tree is
//     hard-killed; after restart the conversation shows the honest interrupted
//     recovered state (recovery_required + stored error) built offline from
//     saved state only, with no running spinner, and Resume works;
//  3) the timeline is built offline from stored task_events (task:rescue IPC).
// Screenshots land in work/task-rescue-verification. The key is only ever
// saved in the isolated dev profile through the Settings UI, never written
// by this script.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const keyFile = process.env.SCHOOLWORK_RESCUE_KEY_FILE || 'C:/Users/elias/.config/opencode/teachgpt-api-key.txt';
const key = fs.readFileSync(keyFile, 'utf8').trim();
if (!key) throw new Error('The key file is empty: ' + keyFile);
const profile = path.resolve('work/dev-profile');
fs.mkdirSync(profile, { recursive: true });
const shots = path.resolve('work/task-rescue-verification');
fs.mkdirSync(shots, { recursive: true });
fs.writeFileSync(path.join(shots, 'live-electron-stderr.log'), '');

// A unique token keeps this run's conversation distinguishable from earlier runs.
const token = Date.now().toString(36).slice(-5);
const MARKER = 'story-outline-' + token + '.txt';
const STORY_TASK = 'In the workspace, first create ' + MARKER + ' with a five-bullet outline of a short story about a lighthouse. Then write the complete short story (about 150 words) to story.txt, following the outline.';
const SLEEP_TASK = 'Use the run_powershell tool to run exactly this command, with timeoutMs 360000: Start-Sleep -Seconds 300; Set-Content -Path rescue-live-proof.txt -Value done. Only after the command has fully finished, reply with one short confirmation sentence. Do not do anything else.';

const launch = () => electron.launch({
  executablePath: process.platform === 'win32' ? path.resolve('node_modules/electron/dist/electron.exe') : path.resolve('node_modules/electron/dist/electron'),
  args: ['.', '--user-data-dir=' + profile, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  timeout: 60_000,
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const pass = (text) => { results.push(text); console.log('PASS:', text); };

let app;
let leaveOpen = false;
try {
  app = await launch();
  const page = await app.firstWindow();
  app.process().stderr.on('data', (chunk) => fs.appendFileSync(path.join(shots, 'live-electron-stderr.log'), chunk));
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForFunction(() => Boolean(window.schoolwork), null, { timeout: 45_000 });
  await page.waitForFunction(() => { const el = document.querySelector('.shell'); return el && !el.hasAttribute('inert'); }, null, { timeout: 30_000 });

  // 0) Configure the key through the real Settings UI in this isolated profile only.
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
  // No task from an earlier run may still occupy a conversation.
  for (const c of await page.evaluate(() => window.schoolwork.listChats(true))) {
    await page.evaluate((id) => window.schoolwork.cancel(id), c.id).catch(() => {});
  }
  await sleep(2_000);
  pass('isolated dev profile configured (live inference available)');

  const pollTask = async (win, chatId, states, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      const full = await win.evaluate((id) => window.schoolwork.getChat(id), chatId);
      last = full.task || null;
      if (last && states.includes(last.state)) return last;
      await sleep(2_000);
    }
    throw new Error('task never reached ' + states.join('/') + ' (last: ' + JSON.stringify(last) + ')');
  };

  // 1) Start a real task in a fresh conversation (outline + short story).
  const knownChats = new Set((await page.evaluate(() => window.schoolwork.listChats(true))).map((c) => c.id));
  await page.locator('.new-chat').click();
  await page.waitForTimeout(600);
  await page.locator('textarea[aria-label="Message"], textarea[aria-label="Meddelande"]').fill(STORY_TASK);
  await page.locator('textarea[aria-label="Message"], textarea[aria-label="Meddelande"]').press('Enter');
  let chat = null;
  for (let i = 0; i < 60 && !chat; i++) {
    const candidates = await page.evaluate(() => window.schoolwork.listChats(true));
    chat = candidates.find((c) => (c.title || '').includes(MARKER) && !knownChats.has(c.id)) || null;
    if (!chat) await sleep(1_000);
  }
  assert.ok(chat, 'the new conversation never appeared');
  pass('new conversation started: ' + chat.id.slice(0, 8));
  const running = await pollTask(page, chat.id,['running'], 240_000);
  pass('task is running (live inference): ' + running.id.slice(0, 8));
  // Wait until at least one tool step COMPLETED so the timeline has finished work.
  const storyDeadline = Date.now() + 300_000;
  let storyData = null;
  while (Date.now() < storyDeadline) {
    storyData = await page.evaluate((id) => window.schoolwork.taskRescue(id), running.id);
    if (storyData.events.some((e) => e.type === 'tool-result')) break;
    await sleep(2_000);
  }
  assert.ok(storyData.events.some((e) => e.type === 'tool-result'), 'the task must complete at least one tool step before the pause');

  // 2) Pause from the status box; the rescue panel must appear on its own.
  await page.locator('.activity button.inline-btn', { hasText: 'Pause' }).click();
  await page.locator('.task-rescue[data-rescue-state="paused"]').waitFor({ timeout: 30_000 });
  await sleep(1_200);
  storyData = await page.evaluate((id) => window.schoolwork.taskRescue(id), running.id);
  assert.equal(storyData.task.state, 'paused', 'the task row must be paused');
  assert.ok(storyData.events.some((e) => e.type === 'paused'), 'a paused event must be stored');
  const panelText = await page.locator('.task-rescue').innerText();
  assert.match(panelText, /Paused — progress saved|Pausad — framsteg sparade/, 'the panel must show the paused state');
  assert.ok(await page.locator('.task-rescue .task-rescue-resume').count() === 1, 'a prominent Resume action must be offered');
  const resumeNote = await page.locator('.task-rescue .task-rescue-action small').innerText();
  assert.ok(resumeNote.trim().length >= 10, 'the panel must explain what will be redone');
  await page.screenshot({ path: path.join(shots, '01-paused-rescue.png') });
  pass('paused task: rescue panel auto-appears with step timeline, paused state and Resume');

  // 3) Resume from the panel; the task must run again through the existing control path.
  await page.locator('.task-rescue .task-rescue-resume').click();
  await pollTask(page, chat.id,['queued', 'running'], 20_000);
  await page.waitForTimeout(2_500);
  assert.equal(await page.locator('.error-box').count(), 0, 'a successful Resume must not surface an error box');
  pass('Resume from the panel re-queued the task through the existing control path, with no error box');

  // 4) The manual "What happened to this task?" affordance while running.
  await pollTask(page, chat.id,['running'], 240_000);
  await page.locator('.activity button.inline-btn', { hasText: /What happened to this task\?|Vad hände med uppgiften\?/ }).click();
  await page.waitForTimeout(1_000);
  const liveState = await page.locator('.task-rescue').getAttribute('data-rescue-state');
  assert.ok(['running', 'queued'].includes(liveState), 'live panel state must be honest: ' + liveState);
  assert.equal(await page.locator('.task-rescue .task-rescue-resume').count(), 0, 'no Resume is offered for a running task');
  await page.screenshot({ path: path.join(shots, '02-running-timeline.png') });
  pass('running task: the timeline is visible on demand and shows no Resume');

  // 5) Let the story task finish, then start a long-running task in the same
  // conversation: a 300-second PowerShell sleep keeps the tool mid-flight long
  // enough to close the app while it is really running.
  await pollTask(page, chat.id,['completed', 'cancelled'], 420_000);
  pass('story task completed, starting the long-running task');
  await page.locator('textarea[aria-label="Message"], textarea[aria-label="Meddelande"]').fill(SLEEP_TASK);
  await page.locator('textarea[aria-label="Message"], textarea[aria-label="Meddelande"]').press('Enter');
  await pollTask(page, chat.id,['running'], 300_000);
  const sleepDeadline = Date.now() + 180_000;
  let sleepData = null;
  while (Date.now() < sleepDeadline) {
    sleepData = await page.evaluate((id) => window.schoolwork.getChat(id), chat.id);
    const rescue = await page.evaluate((id) => window.schoolwork.taskRescue(id), sleepData.task.id);
    if (rescue.events.some((e) => e.type === 'tool-start' && e.payload?.tool === 'run_powershell')) break;
    await sleep(2_000);
  }
  assert.ok(sleepData.task.state === 'running', 'the long task must be running, got: ' + sleepData.task.state);
  await sleep(15_000);
  const stateAtKill = (await page.evaluate((id) => window.schoolwork.getChat(id), chat.id)).task.state;
  assert.equal(stateAtKill, 'running', 'the app must be closed while the task is still running, got: ' + stateAtKill);
  pass('long task is mid-tool (run_powershell sleep), hard-closing the app now');

  // 6) Hard-kill the whole app process tree mid-task (the student scenario).
  const pid = app.process().pid;
  execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(pid)]);
  await sleep(4_000);
  console.log('closed the dev app (killed electron tree pid ' + pid + ' mid-task)');
  app = null;

  // 7) Restart and reopen the conversation: honest interrupted state, offline.
  app = await launch();
  const page2 = await app.firstWindow();
  app.process().stderr.on('data', (chunk) => fs.appendFileSync(path.join(shots, 'live-electron-stderr.log'), chunk));
  page2.setDefaultTimeout(60_000);
  const errors2 = [];
  page2.on('pageerror', (e) => errors2.push(e.message));
  await page2.waitForFunction(() => Boolean(window.schoolwork), null, { timeout: 45_000 });
  await page2.waitForFunction(() => { const el = document.querySelector('.shell'); return el && !el.hasAttribute('inert'); }, null, { timeout: 30_000 });
  const recovered = await page2.evaluate((id) => window.schoolwork.getChat(id), chat.id);
  assert.equal(recovered.task.state, 'paused', 'restart must recover the running task to paused, got: ' + recovered.task.state);
  assert.match(recovered.task.error || '', /Application closed before task completion/i, 'the stored recovery error must be present');
  await page2.locator('.history-row', { hasText: MARKER }).first().click();
  await page2.locator('.task-rescue[data-rescue-state="interrupted"]').waitFor({ timeout: 30_000 });
  await sleep(1_200);
  assert.equal(await page2.locator('.activity').count(), 0, 'a recovered task must not show a running spinner/status box');
  const interruptedData = await page2.evaluate((id) => window.schoolwork.taskRescue(id), recovered.task.id);
  assert.ok(interruptedData.events.some((e) => e.type === 'recovery_required'), 'the recovery_required event must be stored and shown');
  const interruptedPanel = await page2.locator('.task-rescue').innerText();
  assert.match(interruptedPanel, /Interrupted — the app closed mid-task|Avbruten — appen stängdes under uppgiften/, 'the panel must say the task was interrupted');
  assert.match(interruptedPanel, /Application closed before task completion/i, 'the exact stored error must be visible');
  assert.equal(await page2.locator('.task-rescue .task-rescue-resume').count(), 1, 'Resume must be offered for the interrupted task');
  await page2.screenshot({ path: path.join(shots, '03-interrupted-after-restart.png') });
  pass('after restart: honest interrupted state + exact stored error + Resume, offline from saved state');

  // 8) Resume the interrupted task; it must run again through the same control path.
  await page2.locator('.task-rescue .task-rescue-resume').click();
  await pollTask(page2, chat.id, ['queued', 'running'], 20_000);
  await pollTask(page2, chat.id, ['running'], 240_000);
  await page2.waitForTimeout(2_500);
  assert.equal(await page2.locator('.error-box').count(), 0, 'resuming the interrupted task must not surface an error box');
  await page2.screenshot({ path: path.join(shots, '04-resumed-again.png') });
  pass('resuming the interrupted task works: it is running again, no error box');

  // 9) Stop the task, leaving the profile clean. With TASK_RESCUE_LEAVE_PAUSED=1
  // the resumed task is paused and the app is left open for an optional
  // follow-up desktop verification.
  if (process.env.TASK_RESCUE_LEAVE_PAUSED === '1') {
    await pollTask(page2, chat.id, ['running'], 240_000);
    await page2.locator('.activity button.inline-btn', { hasText: 'Pause' }).click();
    await page2.locator('.task-rescue[data-rescue-state="paused"]').waitFor({ timeout: 30_000 });
    leaveOpen = true;
    pass('left the task paused with the app open for desktop verification (chat ' + chat.id.slice(0, 8) + ', marker ' + MARKER + ')');
  } else {
    await page2.evaluate((id) => window.schoolwork.cancel(id), chat.id).catch(() => {});
    await pollTask(page2, chat.id, ['cancelled', 'completed'], 90_000);
    pass('stopped the resumed task, profile left clean');
  }

  assert.equal(errors.length + errors2.length, 0, 'no renderer errors: ' + errors.concat(errors2).join(' | '));
  console.log('TASK-RESCUE-LIVE: ALL CHECKS PASSED: ' + results.length);
} catch (e) {
  console.error('FAIL:', e && e.message);
  console.error(results.map((r) => '  ' + r).join('\n'));
  try { if (app) await app.firstWindow().then((p) => p.screenshot({ path: path.join(shots, '99-fail.png') })).catch(() => {}); } catch { /* best effort */ }
  process.exitCode = 1;
} finally {
  if (!leaveOpen) await app?.close().catch(() => {});
  else console.log('LEAVING APP OPEN pid ' + app.process().pid);
  await sleep(1_500);
}
