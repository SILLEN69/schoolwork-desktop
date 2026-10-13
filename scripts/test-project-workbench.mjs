// Real Electron app, isolated profile: the Project Workbench must show a confined
// file tree (build artifacts and dot folders hidden) with expand/collapse and a
// filter box, open .ts with syntax highlighting and .md rendered, show clear
// binary and >1 MB states, remember recent files for the session, refresh the
// tree when the workspace changes on disk, and refuse every path that escapes
// the selected workspace (traversal, absolute paths).
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const data = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-workbench-'));
const shots = path.resolve('work/workbench-verification');
await fs.mkdir(shots, { recursive: true });
let app;
const results = [];
function pass(text) { results.push(text); console.log('PASS:', text); }
async function launch() {
  return electron.launch({
    executablePath: process.platform === 'win32' ? path.resolve('node_modules/electron/dist/electron.exe') : path.resolve('node_modules/electron/dist/electron'),
    args: [path.resolve('scripts/test-project-workbench-app.cjs'), '--user-data-dir=' + data, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env: { ...process.env, SCHOOLWORK_WORKBENCH_TEST_DATA: data },
    timeout: 30_000,
  });
}
try {
  app = await launch();
  app.process().stderr.on('data', chunk => { void fs.appendFile(path.join(shots, 'electron-stderr.log'), chunk); });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => Boolean(window.schoolwork));
  // Enter the Project view from the sidebar.
  await page.getByRole('button', { name: 'Project' }).click();
  await page.locator('.workbench').waitFor();
  await page.locator('.wb-tree').getByText('README.md', { exact: true }).waitFor();
  pass('sidebar entry opens the Project view over the selected workspace');
  // Build artifacts and dot folders must be hidden from the tree.
  const treeText = await page.locator('.wb-tree').innerText();
  for (const hidden of ['node_modules', '.git', 'dist', 'release']) {
    assert(!treeText.includes(hidden), hidden + ' must be hidden but is: ' + treeText);
  }
  assert(treeText.includes('src') && treeText.includes('data') && treeText.includes('package.json'));
  pass('tree lists project folders/files and hides node_modules, .git, dist and release');
  // Top-level folders are open by default; open a TypeScript file with highlighting.
  await page.locator('.wb-tree button[data-file="src/app.ts"]').waitFor();
  await page.locator('.wb-tree button[data-file="src/app.ts"]').click();
  await page.locator('.wb-code code .hljs-keyword').first().waitFor({ timeout: 10_000 });
  const codeText = await page.locator('.wb-code code').innerText();
  assert(codeText.includes('export const answer') && codeText.includes('function greet'));
  assert.equal(await page.locator('.wb-lang').textContent(), 'typescript');
  assert.match(await page.locator('.wb-size').textContent(), /\d+(\.\d+)? (B|KB|MB)/);
  await page.screenshot({ path: path.join(shots, 'workbench-ts.png') });
  pass('opening a .ts file shows syntax-highlighted code with language and size in the preview bar');
  // Open the root README: Markdown must be rendered, not shown raw.
  await page.locator('.wb-tree button[data-file="README.md"]').click();
  await page.locator('.wb-md h1', { hasText: 'Sample project' }).waitFor();
  assert((await page.locator('.wb-md strong', { hasText: 'bold' }).count()) > 0, 'bold text must render');
  assert((await page.locator('.wb-md .code-block').count()) > 0, 'fenced code must render as a code block');
  const mdText = await page.locator('.wb-md').innerText();
  assert(!mdText.startsWith('# Sample'), 'raw markdown must not be shown for .md files');
  await page.screenshot({ path: path.join(shots, 'workbench-md.png') });
  pass('opening README.md renders headings, bold and fenced code through the existing markdown stack');
  // Binary file: a clear unsupported state, no content.
  await page.locator('.wb-tree button[data-file="data/plot.png"]').waitFor();
  await page.locator('.wb-tree button[data-file="data/plot.png"]').click();
  await page.locator('.wb-state h2', { hasText: 'Binary file' }).waitFor();
  assert.equal(await page.locator('.wb-code').count(), 0, 'binary files must not render code');
  pass('binary files show a clear binary/unsupported state instead of content');
  // Oversized file: a notice instead of loading.
  await page.locator('.wb-tree button[data-file="data/big.log"]').click();
  await page.locator('.wb-state h2', { hasText: 'File too large to preview' }).waitFor();
  const largeText = await page.locator('.wb-state').innerText();
  assert(largeText.includes('1 MB'), 'notice must mention the 1 MB limit: ' + largeText);
  pass('files above 1 MB show a size notice instead of loading');
  // Path confinement: traversal and absolute paths must never escape the workspace.
  const outside = path.join(data, 'outside-secret.txt');
  for (const attempt of ['../../outside-secret.txt', '..\\..\\outside-secret.txt', outside]) {
    const err = await page.evaluate(async p => {
      try { await window.schoolwork.projectRead({ path: p }); return null; }
      catch (e) { return e instanceof Error ? e.message : String(e); }
    }, attempt);
    assert(err && /outside the selected workspace/i.test(err), 'traversal must be rejected: ' + attempt + ' -> ' + err);
  }
  pass('projectRead rejects ../../ traversal and absolute paths outside the workspace');
  // Filter box narrows the visible files.
  await page.locator('.wb-search input').fill('lib');
  await page.waitForTimeout(150);
  const filtered = await page.locator('.wb-tree').innerText();
  assert(filtered.includes('lib.ts'), 'lib.ts must survive the filter');
  assert(!filtered.includes('README.md') && !filtered.includes('package.json'), 'unrelated files must be hidden: ' + filtered);
  await page.locator('.wb-search input').fill('');
  await page.locator('.wb-tree').getByText('README.md', { exact: true }).waitFor();
  pass('the filter box narrows the tree to matching files and restores it when cleared');
  // Collapse src and confirm its children hide.
  await page.locator('.wb-tree button[data-dir="src"]').click();
  assert.equal(await page.locator('.wb-tree button[data-file="src/app.ts"]').count(), 0, 'collapsing must hide children');
  await page.locator('.wb-tree button[data-dir="src"]').click();
  await page.locator('.wb-tree button[data-file="src/app.ts"]').waitFor();
  pass('folders expand and collapse their children');
  // Recent files: remembered after closing the preview, reopenable by click.
  await page.locator('.wb-tree button[data-file="package.json"]').click();
  await page.locator('.wb-preview-bar .wb-preview-path', { hasText: 'package.json' }).waitFor();
  const recentText = await page.locator('.wb-recent-block').innerText();
  assert(recentText.includes('package.json') && recentText.includes('README.md') && recentText.includes('app.ts'), 'recent list: ' + recentText);
  await page.locator('.wb-close').click();
  await page.locator('.wb-idle').waitFor();
  const recentRows = page.locator('.wb-recent-block .wb-row');
  assert((await recentRows.count()) >= 3);
  await recentRows.filter({ hasText: 'app.ts' }).first().click();
  await page.locator('.wb-code code .hljs-keyword').first().waitFor();
  pass('recent files are remembered for the session, survive closing the preview and reopen on click');
  // The tree refreshes when a file appears in the workspace on disk.
  await fs.writeFile(path.join(data, 'workspace', 'fresh.ts'), 'export const fresh = true;\n');
  await page.locator('.wb-tree button[data-file="fresh.ts"]').waitFor({ timeout: 10_000 });
  pass('the tree auto-refreshes when a new file appears in the workspace (fs.watch, debounced)');
  // Phase 2 — run guards: outside-workspace paths, directories and unsupported types are refused.
  for (const [attempt, pattern] of [
    ['../outside-run.js', /outside the selected workspace/],
    ['src', /Not a file/],
    ['README.md', /can not be run/],
  ]) {
    const err = await page.evaluate(async p => {
      try { await window.schoolwork.projectRun({ path: p }); return null; }
      catch (e) { return e instanceof Error ? e.message : String(e); }
    }, attempt);
    assert(err && pattern.test(err), 'run guard for ' + attempt + ' -> ' + err);
  }
  pass('run guards: outside-workspace paths, directories and unsupported types are refused');
  // Run the small node script: output streams into the console and the exit code is reported.
  await page.locator('.wb-tree button[data-file="hello.mjs"]').waitFor();
  await page.locator('.wb-tree button[data-file="hello.mjs"]').click();
  await page.locator('.wb-preview-bar .wb-preview-path', { hasText: 'hello.mjs' }).waitFor();
  const runBtn = page.getByRole('button', { name: 'Run this file' });
  await runBtn.waitFor();
  await runBtn.click();
  await page.locator('.wb-run').waitFor();
  await page.locator('.wb-run-state', { hasText: 'Exit code 3' }).waitFor({ timeout: 30_000 });
  const runOutput = await page.locator('.wb-run-body').innerText();
  assert(runOutput.includes('hello from hello.mjs'), 'stdout must be shown: ' + runOutput);
  assert(runOutput.includes('a warning on stderr'), 'stderr must be shown: ' + runOutput);
  await page.screenshot({ path: path.join(shots, 'workbench-run.png') });
  pass('running a .mjs file shows streamed stdout/stderr and the exit code in the output console');
  // A second run must be refused while one is active, and Stop cancels the run.
  await page.locator('.wb-tree button[data-file="slow.mjs"]').click();
  await page.locator('.wb-preview-bar .wb-preview-path', { hasText: 'slow.mjs' }).waitFor();
  await page.getByRole('button', { name: 'Run this file' }).click();
  await page.locator('.wb-run-state', { hasText: 'Running…' }).waitFor({ timeout: 10_000 });
  const busyErr = await page.evaluate(async () => {
    try { await window.schoolwork.projectRun({ path: 'hello.mjs' }); return null; }
    catch (e) { return e instanceof Error ? e.message : String(e); }
  });
  assert(busyErr && /already running/i.test(busyErr), 'double run must be refused: ' + busyErr);
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.locator('.wb-run-state', { hasText: 'Stopped' }).waitFor({ timeout: 15_000 });
  const slowOutput = await page.locator('.wb-run-body').innerText();
  assert(slowOutput.includes('starting slow work'), 'the slow script must have printed before the stop: ' + slowOutput);
  await page.screenshot({ path: path.join(shots, 'workbench-run-stopped.png') });
  pass('stop cancels a running file, and a second run is refused while one is active');
  // Back returns to the normal app shell.
  await page.locator('.wb-back').click();
  await page.locator('.shell').waitFor();
  pass('back returns to the main app shell');
  assert.equal(await app.evaluate(() => global.__workbenchTest.externalRequests.length), 0, 'no network traffic may leave the workbench view');
  assert(errors.length === 0, 'renderer page errors: ' + errors.join(' | '));
  pass('no renderer errors and no external requests while using the workbench');
} catch (e) {
  console.error('FAIL:', e && e.message);
  try { await page.screenshot({ path: path.join(shots, 'workbench-failure.png') }); } catch {}
  console.error(results.map(r => '  ' + r).join('\n'));
  process.exitCode = 1;
} finally {
  if (app) await app.close().catch(() => {});
}
console.log('WORKBENCH CHECKS PASSED: ' + results.length);
