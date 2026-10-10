import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

export type FileContext = { workspace: string; access: 'workspace' | 'full-user'; signal: AbortSignal };
const file = z.string().min(1).max(4096);
const range = z.object({ path: file, startLine: z.number().int().positive().optional(), endLine: z.number().int().positive().optional() });
const page = { path: file.optional(), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(200).default(100) };
export const projectInputs = {
  list_files: z.object(page),
  find_files: z.object({ ...page, query: z.string().max(200).default(''), includeHidden: z.boolean().default(false) }),
  project_map: z.object({ path: file.optional(), offset: z.number().int().min(0).default(0) }),
  read_file: range,
  read_files: z.object({ files: z.array(range).min(1).max(6) }),
  search_text: z.object({ ...page, query: z.string().min(1).max(500), includeHidden: z.boolean().default(false) }),
  write_file: z.object({ path: file, content: z.string().max(2_000_000), expectedHash: z.string().length(64).optional() }),
  patch_file: z.object({ path: file, search: z.string().min(1).max(500_000), replacement: z.string().max(500_000), expectedHash: z.string().length(64).optional() }),
  edit_file: z.object({ path: file, expectedHash: z.string().length(64), edits: z.array(z.object({ search: z.string().min(1).max(100_000), replacement: z.string().max(100_000) })).min(1).max(30) }),
};
const descriptions: Record<string, string> = {
  list_files: 'List a directory with pagination. Paths may be absolute when full-user file access is enabled.',
  find_files: 'Find file paths recursively by case-insensitive substring. Skips dependencies, builds, secrets and symlinks. Use offset for the next page.',
  project_map: 'Start coding here: bounded project file map, detected manifests, npm scripts and dependency names. Use offset to continue large maps.',
  read_file: 'Read at most 300 lines and 16000 characters; returns line numbers and a SHA-256 hash for safe editing.',
  read_files: 'Read up to six bounded file excerpts in one action. Prefer this to repeated shell reads.',
  search_text: 'Search literal text recursively with file and line references, pagination and explicit scan limits.',
  write_file: 'Create a file or replace it with a versioned backup. For existing files expectedHash from read_file is required.',
  patch_file: 'Replace one exact unique text match with a versioned backup. Prefer edit_file for multiple changes.',
  edit_file: 'Apply multiple exact unique replacements to one file atomically. Requires the last read SHA-256 hash; stale edits are rejected without writing.',
};
export const projectToolSchemas = Object.entries(projectInputs).map(([name, schema]) => ({ type: 'function', function: { name, description: descriptions[name], parameters: z.toJSONSchema(schema) } }));
const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.venv', 'venv', '__pycache__']);
const secretFile = (p: string) => /^(\.env(?:\..*)?|schoolwork-settings\.json|id_rsa|id_ed25519)$/i.test(path.basename(p)) || /\.(pem|pfx|key)$/i.test(p);
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const within = (root: string, target: string) => { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };

/** Canonicalize existing ancestors before any mkdir/write. Individual external paths work only in full-user mode. */
export async function resolveFile(ctx: FileContext, input: string) {
  ctx.signal.throwIfAborted();
  if (input.includes('\0') || (process.platform === 'win32' && /:/.test(input.replace(/^[A-Za-z]:/, '')))) throw new Error('Invalid file path.');
  const target = path.resolve(ctx.workspace, input);
  let ancestor = target; const suffix: string[] = [];
  while (true) {
    try { ancestor = await fs.realpath(ancestor); break; }
    catch (e: any) { if (e.code !== 'ENOENT') throw e; const parent = path.dirname(ancestor); if (parent === ancestor) throw e; suffix.unshift(path.basename(ancestor)); ancestor = parent; }
  }
  const resolved = path.join(ancestor, ...suffix);
  if (ctx.access !== 'full-user' && !within(await fs.realpath(ctx.workspace), resolved)) throw new Error('Path is outside the selected workspace. Enable Full user access in Settings for other folders.');
  if (secretFile(target) || secretFile(resolved)) throw new Error('Credential files are not included in agent context.');
  return resolved;
}

async function read(ctx: FileContext, input: z.infer<typeof range>, maxChars = 16000) {
  const target = await resolveFile(ctx, input.path);
  if ((await fs.stat(target)).size > 4_000_000) throw new Error('File exceeds 4 MB text limit. Use a dedicated parser or a command for large data.');
  const text = await fs.readFile(target, 'utf8');
  if (text.includes('\0')) throw new Error('Binary file: use a suitable parser.');
  const lines = text.split(/\r?\n/); const start = input.startLine || 1;
  if (input.endLine && input.endLine < start) throw new Error('endLine must be at or after startLine.');
  const end = Math.min(lines.length, input.endLine || start + 299, start + 299);
  const excerpt = lines.slice(start - 1, end).map((line, i) => `${start + i}: ${line}`).join('\n');
  const clipped = excerpt.length > maxChars;
  return { path: target, sha256: hash(text), totalLines: lines.length, startLine: start, endLine: end, text: excerpt.slice(0, maxChars), truncated: clipped || end < lines.length, nextLine: clipped ? start : end < lines.length ? end + 1 : null, hint: clipped ? 'Request a smaller line range; a very long line may need a dedicated parser.' : undefined };
}

async function scan(ctx: FileContext, root: string, hidden: boolean, visit: (p: string) => Promise<boolean>) {
  const queue = [root]; let scanned = 0, skipped = 0; const started = Date.now();
  while (queue.length) {
    ctx.signal.throwIfAborted();
    const dir = queue.shift()!;
    let directory;
    try { directory = await fs.opendir(dir); } catch { skipped++; continue; }
    for await (const entry of directory) {
      ctx.signal.throwIfAborted();
      if (++scanned > 20000 || Date.now() - started > 10000) return { scanned, skipped, scanLimited: true };
      if (ignored.has(entry.name) || entry.name.includes('.schoolwork.') || secretFile(entry.name) || (!hidden && entry.name.startsWith('.'))) continue;
      if (entry.isSymbolicLink()) { skipped++; continue; }
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) queue.push(p);
      else if (entry.isFile() && await visit(p)) return { scanned, skipped, scanLimited: false };
    }
  }
  return { scanned, skipped, scanLimited: false };
}

async function replace(ctx: FileContext, target: string, before: string | null, after: string) {
  ctx.signal.throwIfAborted();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const backup = before === null ? null : `${target}.schoolwork.bak.${Date.now()}.${crypto.randomUUID()}`;
  if (backup) await fs.copyFile(target, backup, fs.constants.COPYFILE_EXCL);
  const temp = `${target}.schoolwork.tmp.${crypto.randomUUID()}`;
  try {
    await fs.writeFile(temp, after, 'utf8');
    ctx.signal.throwIfAborted();
    let current: string | null = null;
    try { current = await fs.readFile(target, 'utf8'); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    if (current !== before) throw new Error('File changed during editing. Read it again before applying the change.');
    await fs.rename(temp, target);
  } finally { await fs.rm(temp, { force: true }); }
  return { path: target, sha256: hash(after), backup, beforeLines: before?.split('\n').length || 0, afterLines: after.split('\n').length };
}

export async function executeProjectTool(name: keyof typeof projectInputs, raw: unknown, ctx: FileContext): Promise<any> {
  const args: any = projectInputs[name].parse(raw);
  if (name === 'read_file') return read(ctx, args);
  if (name === 'read_files') { const files = []; for (const input of args.files) { try { files.push(await read(ctx, input, Math.floor(24000 / args.files.length))); } catch (e) { ctx.signal.throwIfAborted(); files.push({ path: input.path, error: String(e) }); } } return { files }; }
  const target = await resolveFile(ctx, args.path || '.');
  if (name === 'list_files') { const entries = (await fs.readdir(target, { withFileTypes: true })).filter(e => !secretFile(e.name)).sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name)); return { path: target, total: entries.length, entries: entries.slice(args.offset, args.offset + args.limit).map(e => ({ name: e.name, path: path.join(target, e.name), type: e.isSymbolicLink() ? 'link' : e.isDirectory() ? 'directory' : 'file' })), nextOffset: args.offset + args.limit < entries.length ? args.offset + args.limit : null }; }
  if (['write_file', 'patch_file', 'edit_file'].includes(name)) {
    let before: string | null = null;
    try { if ((await fs.stat(target)).size > 4_000_000) throw new Error('File is too large for text editing.'); before = await fs.readFile(target, 'utf8'); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    if (before?.includes('\0')) throw new Error('Cannot edit binary files.');
    if (before !== null && name === 'write_file' && !args.expectedHash) throw new Error('Existing file: read_file first, then provide expectedHash or use a targeted patch.');
    if (args.expectedHash && (before === null || hash(before) !== args.expectedHash)) throw new Error('Stale file hash: read the current file and rebase your edits. Nothing was written.');
    let after = args.content;
    if (name !== 'write_file') {
      if (before === null) throw new Error('File does not exist.');
      after = before;
      for (const edit of name === 'patch_file' ? [args] : args.edits) {
        const at = after.indexOf(edit.search);
        if (at < 0 || after.indexOf(edit.search, at + 1) >= 0) throw new Error(`Each edit must match exactly once (${at<0?'no match':'multiple matches'} for this edit). No changes were written. Read the current range, copy exact text including real newlines, then retry one targeted edit.`);
        after = after.slice(0, at) + edit.replacement + after.slice(at + edit.search.length);
      }
    }
    return replace(ctx, target, before, after);
  }
  const matches: any[] = []; let count = 0; const limit = name === 'project_map' ? 120 : args.limit; const offset = args.offset || 0;
  const scanResult = await scan(ctx, target, args.includeHidden || false, async p => {
    const relative = path.relative(target, p);
    if (name === 'search_text') {
      if ((await fs.stat(p)).size > 1_000_000) return false;
      let text: string; try { text = await fs.readFile(p, 'utf8'); } catch { return false; }
      if (text.includes('\0')) return false;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) if (lines[i].toLowerCase().includes(args.query.toLowerCase())) {
        if (count++ >= offset) matches.push({ path: relative, line: i + 1, text: lines[i].slice(0, 350) });
        if (matches.length > limit) return true;
      }
    } else if (name === 'project_map' || relative.toLowerCase().includes(args.query.toLowerCase())) { if (count++ >= offset) matches.push(relative); }
    return matches.length > limit;
  });
  const hasMore = matches.length > limit;
  const output: any = { root: target, matches: matches.slice(0, limit), nextOffset: hasMore ? offset + limit : null, ...scanResult, excluded: 'Dependency/build directories, credential files and directory links. Narrow path if scanLimited is true.' };
  if (name === 'project_map') {
    output.manifests = [];
    for (const name of ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'AGENTS.md', 'agents.md']) {
      try {
        const manifest = await read(ctx, { path: path.join(target, name), endLine: 80 }, 5000);
        if (name === 'package.json') { const pkg = JSON.parse(await fs.readFile(path.join(target, name), 'utf8')); output.manifests.push({ path: name, scripts: pkg.scripts || {}, dependencies: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).slice(0, 60) }); }
        else output.manifests.push(manifest);
      } catch { /* Missing manifests are normal. */ }
    }
  }
  return output;
}
