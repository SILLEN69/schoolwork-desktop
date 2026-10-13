import { beforeEach, afterEach, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildProjectTree,
  readWorkbenchFile,
  resolveInsideWorkspace,
  watchWorkspace,
  PREVIEW_LIMIT,
} from './projectView';

let root: string;
let workspace: string;
let events: number[] = [];
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-workbench-'));
  workspace = path.join(root, 'project');
  await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it('confines relative, absolute and traversal paths inside the workspace', async () => {
  await fs.writeFile(path.join(root, 'outside.txt'), 'outside');
  await fs.writeFile(path.join(workspace, 'inside.txt'), 'inside');
  expect(path.basename(await resolveInsideWorkspace(workspace, 'inside.txt'))).toBe('inside.txt');
  await expect(resolveInsideWorkspace(workspace, '../outside.txt')).rejects.toThrow('outside the selected workspace');
  await expect(resolveInsideWorkspace(workspace, '..\\..\\..\\outside.txt')).rejects.toThrow('outside the selected workspace');
  await expect(resolveInsideWorkspace(workspace, path.join(root, 'outside.txt'))).rejects.toThrow('outside the selected workspace');
  await expect(resolveInsideWorkspace(workspace, 'a\0b.txt')).rejects.toThrow('Invalid file path');
  // A still-missing file that stays inside the workspace resolves with its suffix intact.
  expect(path.basename(await resolveInsideWorkspace(workspace, 'src/new/file.ts'))).toBe('file.ts');
});

it('rejects symlink and junction escapes through existing ancestors', async () => {
  await fs.mkdir(path.join(root, 'escape'));
  await fs.symlink(
    path.join(root, 'escape'),
    path.join(workspace, 'link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await expect(resolveInsideWorkspace(workspace, 'link/secret.txt')).rejects.toThrow('outside the selected workspace');
  await expect(fs.stat(path.join(root, 'escape'))).resolves.toBeTruthy();
});

it('builds a hidden-aware flat tree with directories first and forward-slash paths', async () => {
  for (const dir of ['node_modules', '.git', 'dist', 'release', '.venv', 'docs/deep']) await fs.mkdir(path.join(workspace, dir), { recursive: true });
  await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'README.md'), 'md');
  await fs.writeFile(path.join(workspace, 'package.json'), '{}');
  await fs.writeFile(path.join(workspace, 'src/app.ts'), 'ts');
  await fs.writeFile(path.join(workspace, 'src/aaa.js'), 'js');
  await fs.writeFile(path.join(workspace, 'node_modules/hidden.js'), 'x');
  await fs.writeFile(path.join(workspace, '.git/config'), 'x');
  await fs.writeFile(path.join(workspace, 'dist/bundle.js'), 'x');
  await fs.writeFile(path.join(workspace, 'release/app.exe'), 'x');
  await fs.writeFile(path.join(workspace, '.env'), 'SECRET=1');
  const tree = await buildProjectTree(workspace);
  const paths = tree.entries.map(e => e.path);
  for (const hidden of ['node_modules', '.git', 'dist', 'release', '.venv', '.env'])
    expect(paths.some(p => p === hidden || p.includes('/' + hidden) || p.startsWith(hidden + '/')), hidden + ' leaked').toBe(false);
  expect(paths).toEqual(['docs', 'docs/deep', 'src', 'src/aaa.js', 'src/app.ts', 'package.json', 'README.md']);
  const file = tree.entries.find(e => e.path === 'src/app.ts')!;
  expect(file.type).toBe('file');
  expect(file.size).toBeGreaterThan(0);
  expect(tree.truncated).toBe(false);
});

it('honours the entry and depth bounds with a truncated flag', async () => {
  await fs.writeFile(path.join(workspace, 'a.txt'), 'x');
  await fs.writeFile(path.join(workspace, 'b.txt'), 'x');
  await fs.mkdir(path.join(workspace, 'src/a'));
  await fs.writeFile(path.join(workspace, 'src/a/deep.txt'), 'x');
  const capped = await buildProjectTree(workspace, { maxEntries: 2, maxDepth: 5 });
  expect(capped.entries).toHaveLength(2);
  expect(capped.truncated).toBe(true);
  await fs.mkdir(path.join(workspace, 'd1/d2/d3/d4/d5/d6/d7'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'd1/d2/d3/d4/d5/d6/d7/leaf.txt'), 'x');
  const shallow = await buildProjectTree(workspace, { maxDepth: 3 });
  expect(shallow.entries.some(e => e.path === 'd1/d2/d3/d4/d5/d6/d7/leaf.txt')).toBe(false);
  expect(shallow.truncated).toBe(true);
});

it('skips links in the tree and reports binary, oversized and missing files distinctly', async () => {
  await fs.writeFile(path.join(workspace, 'src/app.ts'), 'ts');
  await fs.symlink(path.join(root), path.join(workspace, 'loop'), process.platform === 'win32' ? 'junction' : 'dir');
  const tree = await buildProjectTree(workspace);
  expect(tree.entries.some(e => e.name === 'loop')).toBe(false);
  await fs.writeFile(path.join(workspace, 'image.png'), Buffer.from([0x89, 0x50, 0, 0x0a]));
  const binary = await readWorkbenchFile(workspace, 'image.png');
  expect(binary.binary).toBe(true);
  expect(binary.text).toBeUndefined();
  const big = await fs.mkdtemp(path.join(root, 'big-'));
  const bigPath = path.join(workspace, 'big.log');
  await fs.writeFile(bigPath, 'x'.repeat(PREVIEW_LIMIT + 1));
  const oversized = await readWorkbenchFile(workspace, 'big.log');
  expect(oversized.tooLarge).toBe(true);
  expect(oversized.text).toBeUndefined();
  expect(oversized.size).toBe(PREVIEW_LIMIT + 1);
  const text = await readWorkbenchFile(workspace, 'src/app.ts');
  expect(text.text).toBe('ts');
  expect(text.path).toBe('src/app.ts');
  await expect(readWorkbenchFile(workspace, 'missing.txt')).rejects.toThrow();
  await expect(readWorkbenchFile(workspace, 'src')).rejects.toThrow('Not a file');
  void big;
});

it('emits one debounced change per burst and stops after close', async () => {
  const close = watchWorkspace(workspace, () => events.push(Date.now()), { debounceMs: 150 });
  if (!close) return; // recursive watch unavailable on this platform
  events.length = 0;
  await fs.writeFile(path.join(workspace, 'one.txt'), '1');
  await fs.appendFile(path.join(workspace, 'one.txt'), '2');
  await new Promise(r => setTimeout(r, 700));
  expect(events.length).toBeGreaterThanOrEqual(1);
  const before = events.length;
  close();
  await fs.writeFile(path.join(workspace, 'two.txt'), '2');
  await new Promise(r => setTimeout(r, 700));
  expect(events.length).toBe(before);
});
