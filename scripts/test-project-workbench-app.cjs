// Isolated real Electron app and IPC for the Project Workbench. No inference is
// involved in this view, so all external requests are refused. Never uses a
// personal profile and never sends a real credential anywhere.
const { app, safeStorage, shell, dialog } = require('electron');
app.getVersion = () => require('../package.json').version;
const fs = require('node:fs'), path = require('node:path');
const data = process.env.SCHOOLWORK_WORKBENCH_TEST_DATA;
if (!data || !path.isAbsolute(data)) throw new Error('Use an isolated test directory.');
app.setPath('userData', data);
global.__workbenchTest = { externalRequests: [] };
// No file dialogs may be driven in this test; cancel any that appear.
dialog.showOpenDialog = () => Promise.resolve({ canceled: true, filePaths: [] });
shell.openExternal = async () => { throw new Error('Unexpected browser launch in isolated workbench test'); };
app.whenReady().then(() => {
  // Linux CI has no OS keyring; this isolated fixture contains no real credential anyway.
  if (process.platform === 'linux') safeStorage.setUsePlainTextEncryption(true);
  const workspace = path.join(data, 'workspace');
  for (const dir of ['src', 'docs', 'data', 'node_modules/fake-pkg', '.git', 'dist', 'release']) {
    fs.mkdirSync(path.join(workspace, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(workspace, 'src', 'app.ts'),
    "import { greet } from './lib';\n\nexport const answer: number = 42;\n\nfunction greet(name: string): string {\n  return `Hello ${name}!`;\n}\n\ngreet('world');\n");
  fs.writeFileSync(path.join(workspace, 'src', 'lib.ts'), 'export const add = (a: number, b: number): number => a + b;\n');
  fs.writeFileSync(path.join(workspace, 'hello.mjs'),
    'console.log("hello from hello.mjs");\nconsole.error("a warning on stderr");\nprocess.exitCode = 3;\n');
  fs.writeFileSync(path.join(workspace, 'slow.mjs'),
    'console.log("starting slow work");\nsetInterval(() => console.log("still running"), 250);\n');
  fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ name: 'sample', version: '1.0.0', scripts: { test: 'echo ok' } }, null, 2));
  fs.writeFileSync(path.join(workspace, 'README.md'), '# Sample project\n\nThis is **bold** text with a [link](https://example.com).\n\n```ts\nconst x = 1;\n```\n\n## Notes\n\n- one\n- two\n');
  fs.writeFileSync(path.join(workspace, 'docs', 'guide.md'), '# Guide\n\nStep **one**.\n');
  fs.writeFileSync(path.join(workspace, 'data', 'plot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01]));
  fs.writeFileSync(path.join(workspace, 'data', 'big.log'), 'line of log\n'.repeat(120000));
  fs.writeFileSync(path.join(workspace, 'node_modules', 'fake-pkg', 'index.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(workspace, '.git', 'config'), '[core]\n');
  fs.writeFileSync(path.join(workspace, 'dist', 'bundle.js'), '/* built */\n');
  fs.writeFileSync(path.join(workspace, 'release', 'app.exe'), 'x');
  fs.writeFileSync(path.join(data, 'outside-secret.txt'), 'must never be readable');
  fs.writeFileSync(path.join(data, 'outside-run.js'), 'console.log("must never be run");\n');
  fs.writeFileSync(path.join(data, 'schoolwork-settings.json'), JSON.stringify({
    model: 'Qwen3.8-27B',
    workspace,
    language: 'en',
    capabilities: { allApps: false, launchApps: false, viewScreen: false, controlScreen: false, allowedApps: [] },
  }));
  global.fetch = async (url) => {
    global.__workbenchTest.externalRequests.push(String(url));
    throw new Error('Unexpected external request in isolated workbench test: ' + url);
  };
  require('../dist-electron/main.js');
});
