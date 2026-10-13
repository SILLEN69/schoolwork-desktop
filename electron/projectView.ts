import fs from 'node:fs/promises';
import { watch as watchSync } from 'node:fs';
import path from 'node:path';

/** Directories the workbench never shows: dependencies, version control, build output and tool caches. */
export const hiddenDirectories = new Set([
  'node_modules',
  '.git',
  'dist',
  'release',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.venv',
  'venv',
  '__pycache__',
  '.cache',
  '.idea',
  '.vscode',
]);

export type WorkbenchEntry = { name: string; path: string; type: 'dir' | 'file'; size: number };
export type WorkbenchTree = { workspace: string; entries: WorkbenchEntry[]; truncated: boolean };
export type WorkbenchFile = {
  path: string;
  name: string;
  size: number;
  text?: string;
  binary?: boolean;
  tooLarge?: boolean;
};

export const PREVIEW_LIMIT = 1_000_000;
const MAX_ENTRIES = 4000;
const MAX_DEPTH = 12;
const BINARY_SAMPLE_BYTES = 8192;

const within = (root: string, target: string) => {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
};

/**
 * Confine a user-supplied path to the workspace. Canonicalizes existing ancestors so
 * symlink/junction escapes are caught before the final within-root check.
 */
export async function resolveInsideWorkspace(workspace: string, input: string): Promise<string> {
  if (typeof input !== 'string' || !input.trim() || input.length > 4096)
    throw new Error('Invalid file path.');
  if (input.includes('\0') || (process.platform === 'win32' && /:/.test(input.replace(/^[A-Za-z]:/, ''))))
    throw new Error('Invalid file path.');
  const root = await fs.realpath(workspace);
  const target = path.resolve(root, input);
  let ancestor = target;
  const suffix: string[] = [];
  while (true) {
    try {
      ancestor = await fs.realpath(ancestor);
      break;
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw e;
      suffix.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
  const resolved = path.join(ancestor, ...suffix);
  if (!within(root, resolved)) throw new Error('Path is outside the selected workspace.');
  return resolved;
}

/**
 * Flat, depth-bounded file tree of the workspace (forward-slash relative paths,
 * directories before files, case-insensitive name order). Dependencies, build
 * artifacts, dot folders and links are hidden.
 */
export async function buildProjectTree(
  workspace: string,
  options: { maxEntries?: number; maxDepth?: number; signal?: AbortSignal } = {},
): Promise<WorkbenchTree> {
  const signal = options.signal;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const root = await fs.realpath(workspace);
  const entries: WorkbenchEntry[] = [];
  let truncated = false;
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const visit = async (dir: string, depth: number) => {
    signal?.throwIfAborted();
    if (depth > maxDepth) {
      truncated = true;
      return;
    }
    let handle;
    try {
      handle = await fs.opendir(dir);
    } catch {
      return;
    }
    const names: Array<{ name: string; isDir: boolean; isLink: boolean }> = [];
    for await (const entry of handle)
      names.push({ name: entry.name, isDir: entry.isDirectory(), isLink: entry.isSymbolicLink() });
    names.sort(
      (a, b) =>
        Number(b.isDir) - Number(a.isDir) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
    for (const item of names) {
      signal?.throwIfAborted();
      if (hiddenDirectories.has(item.name) || item.name.startsWith('.') || item.isLink) continue;
      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }
      const full = path.join(dir, item.name);
      if (item.isDir) {
        entries.push({ name: item.name, path: rel(full), type: 'dir', size: 0 });
        await visit(full, depth + 1);
      } else {
        let size = 0;
        try {
          size = (await fs.stat(full)).size;
        } catch {
          /* removed between readdir and stat */
        }
        entries.push({ name: item.name, path: rel(full), type: 'file', size });
      }
    }
  };
  await visit(root, 1);
  return { workspace: root, entries, truncated };
}

const isBinarySample = (buffer: Buffer) => buffer.includes(0);

/**
 * Read a workspace file for preview. Files over PREVIEW_LIMIT are not loaded;
 * a NUL byte in the first 8 KB marks the file binary. Both are reported, never
 * thrown, so the view can show a clear state.
 */
export async function readWorkbenchFile(workspace: string, input: string): Promise<WorkbenchFile> {
  const root = await fs.realpath(workspace);
  const target = await resolveInsideWorkspace(workspace, input);
  const stat = await fs.stat(target);
  if (!stat.isFile()) throw new Error('Not a file.');
  const base: WorkbenchFile = {
    path: path.relative(root, target).split(path.sep).join('/'),
    name: path.basename(target),
    size: stat.size,
  };
  if (stat.size > PREVIEW_LIMIT) return { ...base, tooLarge: true };
  const handle = await fs.open(target, 'r');
  try {
    const sample = Buffer.alloc(Math.min(BINARY_SAMPLE_BYTES, stat.size));
    await handle.read(sample, 0, sample.length, 0);
    if (isBinarySample(sample)) return { ...base, binary: true };
  } finally {
    await handle.close();
  }
  return { ...base, text: await fs.readFile(target, 'utf8') };
}

/**
 * Debounced recursive watcher on the workspace. Returns a close function, or
 * null where recursive fs.watch is unavailable (the view then offers manual refresh).
 */
export function watchWorkspace(
  workspace: string,
  onChange: (workspace: string) => void,
  options: { debounceMs?: number } = {},
): (() => void) | null {
  const debounceMs = options.debounceMs ?? 500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watcher: ReturnType<typeof watchSync> | undefined;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    watcher?.close();
  };
  try {
    watcher = watchSync(workspace, { recursive: true }, () => {
      if (closed || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        try {
          onChange(workspace);
        } catch {
          /* listener errors must not kill the main process */
        }
      }, debounceMs);
    });
  } catch {
    return null;
  }
  watcher.on('error', close);
  return close;
}
