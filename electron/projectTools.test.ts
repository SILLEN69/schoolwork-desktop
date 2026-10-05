import { beforeEach, afterEach, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeProjectTool as tool, resolveFile, type FileContext } from './projectTools';
let root: string; let ctx: FileContext;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-tools-')); await fs.mkdir(path.join(root, 'project')); ctx = { workspace: path.join(root, 'project'), access: 'workspace', signal: new AbortController().signal }; });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
it('permits external files only with full-user access and still excludes credentials', async () => {
  await fs.writeFile(path.join(root, 'outside.txt'), 'outside');
  await expect(tool('read_file', { path: '../outside.txt' }, ctx)).rejects.toThrow('outside');
  expect((await tool('read_file', { path: '../outside.txt' }, { ...ctx, access: 'full-user' })).text).toContain('outside');
  await expect(resolveFile({ ...ctx, access: 'full-user' }, '../.env.local')).rejects.toThrow('Credential');
});
it('resolves a junction before creating any external directories', async () => {
  await fs.mkdir(path.join(root, 'outside'));
  await fs.symlink(path.join(root, 'outside'), path.join(ctx.workspace, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(tool('write_file', { path: 'link/new/a.txt', content: 'no' }, ctx)).rejects.toThrow('outside');
  await expect(fs.stat(path.join(root, 'outside/new'))).rejects.toThrow();
});
it('rejects stale hashes and failed multi-edits without partial changes', async () => {
  await tool('write_file', { path: 'a.ts', content: 'const a = 1;\nconst b = 2;' }, ctx);
  const read = await tool('read_file', { path: 'a.ts' }, ctx);
  await expect(tool('edit_file', { path: 'a.ts', expectedHash: read.sha256, edits: [{ search: 'a = 1', replacement: 'a = 3' }, { search: 'missing', replacement: 'oops' }] }, ctx)).rejects.toThrow('exactly once');
  expect((await tool('read_file', { path: 'a.ts' }, ctx)).sha256).toBe(read.sha256);
  const changed = await tool('edit_file', { path: 'a.ts', expectedHash: read.sha256, edits: [{ search: 'a = 1', replacement: 'a = 3' }, { search: 'b = 2', replacement: 'b = 4' }] }, ctx);
  expect(await fs.readFile(changed.backup, 'utf8')).toContain('a = 1');
  await expect(tool('write_file', { path: 'a.ts', expectedHash: read.sha256, content: 'stale' }, ctx)).rejects.toThrow('Stale');
  await expect(tool('write_file', { path: 'a.ts', content: 'overwrite' }, ctx)).rejects.toThrow('expectedHash');
});
it('paginates file discovery and text matches while skipping build output', async () => {
  for (const name of ['a.ts', 'b.ts', 'c.ts']) await tool('write_file', { path: name, content: 'needle\nneedle' }, ctx);
  await fs.mkdir(path.join(ctx.workspace, 'node_modules')); await fs.writeFile(path.join(ctx.workspace, 'node_modules/ignored.ts'), 'needle');
  const first = await tool('find_files', { query: '.ts', limit: 2 }, ctx);
  const second = await tool('find_files', { query: '.ts', limit: 2, offset: first.nextOffset }, ctx);
  expect(new Set([...first.matches, ...second.matches]).size).toBe(3);
  const result = await tool('search_text', { query: 'needle', limit: 4 }, ctx);
  expect(result.matches).toHaveLength(4); expect(result.nextOffset).toBe(4);
});
it('bounds reads, provides project scripts and handles cancellation', async () => {
  await tool('write_file', { path: 'large.ts', content: 'line\n'.repeat(1000) }, ctx);
  const r = await tool('read_file', { path: 'large.ts', startLine: 2, endLine: 999 }, ctx);
  expect(r.endLine).toBe(301); expect(r.nextLine).toBe(302);
  await tool('write_file', { path: 'package.json', content: JSON.stringify({ scripts: { test: 'vitest run' }, dependencies: { react: '19' } }) }, ctx);
  const map = await tool('project_map', {}, ctx); expect(map.manifests[0].scripts.test).toBe('vitest run');
  const aborted = AbortSignal.abort(); await expect(tool('find_files', {}, { ...ctx, signal: aborted })).rejects.toThrow();
});
