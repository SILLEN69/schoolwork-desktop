// Isolated real Electron app and IPC for the Lesson Follower (offline phase).
// Never uses a personal profile and never sends a real credential anywhere.
const { app, safeStorage, shell, dialog } = require('electron');
app.getVersion = () => require('../package.json').version;
const fs = require('node:fs'), path = require('node:path');
const data = process.env.SCHOOLWORK_FOLLOWER_TEST_DATA;
if (!data || !path.isAbsolute(data)) throw new Error('Use an isolated test directory.');
app.setPath('userData', data);
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
global.__followerTest = { dialogTitles: [], cancelledDialog: false, explainRequests: [] };
// The test cannot drive the native OS file dialog; resolve it to a fixture file.
dialog.showOpenDialog = (win, opts) => {
  global.__followerTest.dialogTitles.push(opts && opts.title ? opts.title : '');
  if (global.__followerTest.cancelledDialog) return Promise.resolve({ canceled: true, filePaths: [] });
  return Promise.resolve({ canceled: false, filePaths: [path.join(data, 'fixture-lesson.md')] });
};
shell.openExternal = async () => { throw new Error('Unexpected browser launch in isolated follower test'); };
app.whenReady().then(() => {
  // Linux CI has no OS keyring; this isolated fixture contains no real credential anyway.
  if (process.platform === 'linux') safeStorage.setUsePlainTextEncryption(true);
  fs.mkdirSync(path.join(data, 'workspace'), { recursive: true });
  // No TeachGPT key in this phase: the follower must work fully offline.
  fs.writeFileSync(path.join(data, 'schoolwork-settings.json'), JSON.stringify({ model: 'Qwen3.8-27B', workspace: path.join(data, 'workspace'), language: 'en', capabilities: { allApps: false, launchApps: false, viewScreen: false, controlScreen: false, allowedApps: [] } }));
  fs.writeFileSync(path.join(data, 'fixture-lesson.md'), '# Osmosis basics\n\nWater moves across a membrane from a dilute solution to a concentrated one. **Osmosis** keeps plant cells turgid and animal cells balanced. The membrane must be **selectively permeable** for osmosis to happen.\n\n## Tonic solutions\n\nA hypertonic solution pulls water out of a cell and makes it shrink. A hypotonic solution pushes water in and can make a cell burst. In an isotonic solution the water balance stays stable.\n');
  global.fetch = async (url, init) => {
    const s = String(url);
    if (s.endsWith('/chat/completions')) {
      const request = JSON.parse(init.body);
      global.__followerTest.explainRequests.push(request);
      const latest = request.messages.filter(m => m.role === 'user').at(-1);
      return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Fixture explanation for: ' + (typeof latest.content === 'string' ? latest.content.slice(0, 120) : 'lesson context received') }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    }
    throw new Error('Unexpected external request in isolated follower test: ' + s);
  };
  require('../dist-electron/main.js');
});
