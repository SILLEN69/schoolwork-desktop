// Live end-to-end verification of Project Workbench phase 2 on the isolated
// dev profile with the real TeachGPT key: run a node file in the dev
// workspace and read its output, then send "Explain this" (whole file and a
// text selection) through the real conversation send path and verify the
// conversation receives the file context and the model answers.
// The key file path arrives only via SCHOOLWORK_WORKBENCH_KEY_FILE and is only
// ever saved in the isolated dev profile through the Settings UI.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const keyFile = process.env.SCHOOLWORK_WORKBENCH_KEY_FILE || 'C:/Users/elias/.config/opencode/teachgpt-api-key.txt';
const key = fs.readFileSync(keyFile, 'utf8').trim();
if (!key) throw new Error('The key file is empty: ' + keyFile);
const profile = path.resolve('work/dev-profile');
fs.mkdirSync(profile, { recursive: true });
const shots = path.resolve('work/workbench-live-verification');
fs.mkdirSync(shots, { recursive: true });

// The dev workspace is an isolated fixture; make sure the sample script exists.
const devWorkspace = 'work/sample-project';
const scriptPath = path.resolve(devWorkspace, 'hello.mjs');
fs.mkdirSync(devWorkspace, { recursive: true });
fs.writeFileSync(scriptPath,
  '// hello.mjs — a tiny greeting script for the SchoolWork sample project.\n' +
  "const greeting = 'hello from the sample project';\n" +
  'console.log(greeting);\n' +
  "console.error('remember to stretch your eyes');\n");

async function waitForTaskComplete(page, chatId, timeoutMs = 300_000) {
  const start = Date.now();
  for (;;) {
    const chat = await page.evaluate(id => window.schoolwork.getChat(id), chatId);
    const state = chat.task ? chat.task.state : 'missing';
    if (state === 'completed' || state === 'error' || state === 'cancelled') return chat;
    if (Date.now() - start > timeoutMs) throw new Error('task did not finish in time, state: ' + state);
    await page.waitForTimeout(2_000);
  }
}

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
  console.log('configured:', settings.configured, 'model:', settings.model);

  // 2) Enter the Project view (the dev profile workspace is work/sample-project).
  await page.locator('button.project-nav').first().click();
  await page.locator('.workbench').waitFor();
  await page.locator('.wb-tree button[data-file="hello.mjs"]').waitFor({ timeout: 15_000 });
  await page.locator('.wb-tree button[data-file="hello.mjs"]').click();
  await page.locator('.wb-preview-bar .wb-preview-path', { hasText: 'hello.mjs' }).waitFor();

  // 3) Run the node file in the dev workspace and read the output in the real window.
  await page.getByRole('button', { name: 'Run this file' }).click();
  await page.locator('.wb-run').waitFor();
  await page.locator('.wb-run-state', { hasText: 'Exit code 0' }).waitFor({ timeout: 60_000 });
  const runOutput = await page.locator('.wb-run-body').innerText();
  assert(runOutput.includes('hello from the sample project'), 'stdout missing: ' + runOutput);
  assert(runOutput.includes('remember to stretch your eyes'), 'stderr missing: ' + runOutput);
  console.log('live run ok:', JSON.stringify(runOutput.slice(0, 120)));
  await page.screenshot({ path: path.join(shots, 'live-run.png') });

  // 4) "Explain this" on the open file: the current conversation must receive the file context.
  const chatsBefore = (await page.evaluate(() => window.schoolwork.listChats())).map(c => c.id);
  await page.getByRole('button', { name: 'Explain this' }).click();
  await page.locator('.shell').waitFor({ timeout: 15_000 });
  const newest = (await page.evaluate(() => window.schoolwork.listChats(false)))[0];
  assert.ok(newest, 'a conversation must be current');
  const userMsgsBefore = chatsBefore.includes(newest.id)
    ? (await page.evaluate(id => window.schoolwork.getChat(id), newest.id)).messages.filter(m => m.role === 'user').length
    : 0;
  const chatAfterRun = await waitForTaskComplete(page, newest.id);
  assert.equal(chatAfterRun.task.state, 'completed', 'explain task state: ' + chatAfterRun.task.state);
  const userTexts = chatAfterRun.messages.filter(m => m.role === 'user').map(m => m.content);
  const explainMsg = userTexts[userTexts.length - 1 - userMsgsBefore] ?? userTexts[userTexts.length - 1];
  assert.ok(explainMsg && explainMsg.includes('hello.mjs'), 'user message must quote the file path: ' + String(explainMsg).slice(0, 200));
  assert.ok(explainMsg.includes("const greeting"), 'user message must quote the file content');
  assert.ok(explainMsg.includes('untrusted'), 'file content must be framed as untrusted data');
  const reply = chatAfterRun.messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n');
  assert.ok(reply.trim().length > 40, 'the model must answer the explanation');
  console.log('live explain (whole file) ok, reply length:', reply.trim().length);
  await page.screenshot({ path: path.join(shots, 'live-explain-file.png') });

  // 5) "Explain this" on a text selection inside the preview (the view remounts, reopen the file).
  await page.locator('button.project-nav').first().click();
  await page.locator('.workbench').waitFor();
  await page.locator('.wb-tree button[data-file="hello.mjs"]').click();
  await page.locator('.wb-preview-bar .wb-preview-path', { hasText: 'hello.mjs' }).waitFor();
  // highlight.js splits the line across spans, so target a token inside one text node.
  await page.evaluate(() => {
    const root = document.querySelector('.wb-code code');
    if (!root) throw new Error('code preview not found');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.data.indexOf('greeting');
      if (idx >= 0) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, Math.min(node.data.length, idx + 10));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }
    throw new Error('selection target not found in the preview');
  });
  await page.getByRole('button', { name: 'Explain selection' }).waitFor({ timeout: 10_000 });
  const chatsBeforeSel = (await page.evaluate(() => window.schoolwork.listChats())).map(c => c.id);
  await page.getByRole('button', { name: 'Explain selection' }).click();
  await page.locator('.shell').waitFor({ timeout: 15_000 });
  const newestSel = (await page.evaluate(() => window.schoolwork.listChats(false)))[0];
  const userMsgsBeforeSel = chatsBeforeSel.includes(newestSel.id)
    ? (await page.evaluate(id => window.schoolwork.getChat(id), newestSel.id)).messages.filter(m => m.role === 'user').length
    : 0;
  const chatAfterSel = await waitForTaskComplete(page, newestSel.id);
  assert.equal(chatAfterSel.task.state, 'completed', 'selection explain task state: ' + chatAfterSel.task.state);
  const selTexts = chatAfterSel.messages.filter(m => m.role === 'user').map(m => m.content);
  const selMsg = selTexts[selTexts.length - 1 - userMsgsBeforeSel] ?? selTexts[selTexts.length - 1];
  assert.ok(selMsg && selMsg.includes('hello.mjs'), 'selection message must quote the file path: ' + String(selMsg).slice(0, 200));
  assert.ok(/selection/i.test(selMsg), 'selection message must say it explains a selection');
  assert.ok(selMsg.includes('greeting'), 'selection message must quote the selected token');
  assert.ok(selMsg.length < 3000, 'a selection must not carry the whole file: ' + selMsg.length);
  console.log('live explain (selection) ok');
  await page.screenshot({ path: path.join(shots, 'live-explain-selection.png') });

  assert.equal(errors.length, 0, 'renderer page errors: ' + errors.join(' | '));
  console.log('LIVE WORKBENCH CHECKS PASSED');
} finally {
  if (app) await app.close().catch(() => {});
}
