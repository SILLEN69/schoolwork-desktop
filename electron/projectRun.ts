import { randomUUID } from 'node:crypto';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  appendRunOutputStream,
  createRunOutputStream,
  interpreterForName,
  runCommandLabel,
  runOutputStreamText,
  trimUtf8Boundary,
  type RunInterpreter,
  type RunOutputPiece,
  type WorkbenchRunResult,
} from '../src/workbench';
import { resolveInsideWorkspace } from './projectView';

const pexecFile = promisify(execFile);

export type WorkbenchRun = {
  runId: string;
  command: string;
  interpreter: string;
  promise: Promise<WorkbenchRunResult>;
  stop: () => void;
};

export type RunOptions = {
  runId?: string;
  timeoutMs?: number;
  onOutput?: (stream: 'stdout' | 'stderr', data: string) => void;
};

/** Find an executable on PATH, or null when it is not installed. */
async function findProgram(program: string): Promise<string | null> {
  const isWin = process.platform === 'win32';
  if (isWin && (program === 'cmd.exe' || program === 'powershell.exe')) return program;
  try {
    const { stdout } = await pexecFile(isWin ? 'where' : 'which', [program], { windowsHide: true });
    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!isWin) return lines[0] || null;
    // Prefer real executables: .cmd/.bat shims (e.g. launcher stubs) can not be
    // spawned directly on Windows.
    return lines.find(l => l.toLowerCase().endsWith('.exe')) || null;
  } catch {
    return null;
  }
}

/**
 * Run one workspace file with its sensible interpreter (node, python, the
 * system shell). The file is confined to the workspace, the child runs with
 * the workspace as cwd under a hard timeout, output is bounded per stream,
 * and stop() kills the whole process tree. No arbitrary command surface:
 * only the fixed interpreter invocation for the opened file.
 */
export async function runWorkspaceFile(
  workspace: string,
  inputPath: string,
  options: RunOptions = {},
): Promise<WorkbenchRun> {
  const root = await fs.realpath(workspace);
  const target = await resolveInsideWorkspace(workspace, inputPath);
  const stat = await fs.stat(target);
  if (!stat.isFile()) throw new Error('Not a file.');
  const name = path.basename(target);
  const interp: RunInterpreter | null = interpreterForName(name);
  if (!interp)
    throw new Error('This file type can not be run. Supported: .js, .mjs, .cjs, .py, .sh, .bat, .cmd and .ps1.');
  const rel = path.relative(root, target).split(path.sep).join('/');
  const command = runCommandLabel(name, rel);
  const program = await findProgram(interp.program);
  if (!program) throw new Error(`No ${interp.label} interpreter was found on this computer, so ${rel} can not be run.`);
  const runId = options.runId || randomUUID();
  const startedAt = Date.now();
  const stdoutStream = createRunOutputStream();
  const stderrStream = createRunOutputStream();
  const outDecoder = new TextDecoder('utf-8');
  const errDecoder = new TextDecoder('utf-8');
  const emit = (stream: 'stdout' | 'stderr', pieces: RunOutputPiece[]) => {
    if (!options.onOutput) return;
    // Complete chunks keep the streaming decoder's state; fragments are
    // boundary-trimmed before a stateless decode so cut edges stay clean.
    const decoder = stream === 'stdout' ? outDecoder : errDecoder;
    for (const piece of pieces) {
      if (!piece.data.length) continue;
      const text = piece.complete
        ? decoder.decode(piece.data, { stream: true })
        : trimUtf8Boundary(piece.data).toString('utf8');
      if (text) options.onOutput(stream, text);
    }
  };
  const child: ChildProcess = spawn(program, interp.fileArgs(rel), {
    cwd: root,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let settled = false;
  let stopped = false;
  let timedOut = false;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const killTree = () => {
    const pid = child.pid;
    if (!pid) return;
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
      killer.on('error', () => {});
      killer.unref();
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        try { child.kill('SIGTERM'); } catch { /* already gone */ }
      }
      killTimer = setTimeout(() => {
        try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
      }, 2000);
      killTimer.unref();
    }
  };
  const stop = () => {
    if (settled || stopped) return;
    stopped = true;
    killTree();
  };
  const timeout = setTimeout(() => {
    if (settled) return;
    timedOut = true;
    killTree();
  }, Math.min(Math.max(options.timeoutMs ?? 120_000, 1), 600_000));
  timeout.unref();
  child.stdout?.on('data', (chunk: Buffer) => {
    emit('stdout', appendRunOutputStream(stdoutStream, chunk).pieces);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    emit('stderr', appendRunOutputStream(stderrStream, chunk).pieces);
  });
  let startResolve: (result: WorkbenchRunResult) => void;
  let startReject: (message: string) => void;
  const promise = new Promise<WorkbenchRunResult>((resolve, reject) => {
    startResolve = resolve;
    startReject = (message) => reject(new Error(message));
  });
  child.once('error', (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (killTimer) clearTimeout(killTimer);
    startReject(error instanceof Error ? error.message : String(error));
  });
  child.once('close', (code, signal) => {
    void signal;
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (killTimer) clearTimeout(killTimer);
    outDecoder.decode();
    errDecoder.decode();
    startResolve({
      runId,
      command,
      interpreter: interp.label,
      exitCode: typeof code === 'number' ? code : null,
      stdout: runOutputStreamText(stdoutStream),
      stderr: runOutputStreamText(stderrStream),
      durationMs: Date.now() - startedAt,
      truncated: stdoutStream.truncated || stderrStream.truncated,
      timedOut,
      stopped,
    });
  });
  return { runId, command, interpreter: interp.label, promise, stop };
}
