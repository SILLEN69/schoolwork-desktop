import { beforeEach, afterEach, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkspaceFile } from './projectRun';

let root: string;
let workspace: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'schoolwork-workbench-run-'));
  workspace = path.join(root, 'project');
  await fs.mkdir(workspace, { recursive: true });
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it('refuses files outside the workspace, directories and unsupported types', async () => {
  await fs.writeFile(path.join(root, 'outside-secret.js'), 'console.log("secret");\n');
  await fs.mkdir(path.join(workspace, 'src'));
  await fs.writeFile(path.join(workspace, 'notes.txt'), 'text');
  await expect(runWorkspaceFile(workspace, '../outside-secret.js')).rejects.toThrow('outside the selected workspace');
  await expect(runWorkspaceFile(workspace, path.join(root, 'outside-secret.js'))).rejects.toThrow('outside the selected workspace');
  await expect(runWorkspaceFile(workspace, 'src')).rejects.toThrow('Not a file.');
  await expect(runWorkspaceFile(workspace, 'notes.txt')).rejects.toThrow('can not be run');
});

it('runs a node file in the workspace and captures stdout, stderr and the exit code', async () => {
  const events: Array<{ stream: 'stdout' | 'stderr'; data: string }> = [];
  await fs.writeFile(
    path.join(workspace, 'hello.mjs'),
    'console.log("hello from hello.mjs");\nconsole.error("a warning on stderr");\nprocess.exitCode = 3;\n',
  );
  const run = await runWorkspaceFile(workspace, 'hello.mjs', {
    onOutput: (stream, data) => events.push({ stream, data }),
  });
  expect(run.command).toBe('node hello.mjs');
  expect(run.interpreter).toBe('node');
  const result = await run.promise;
  expect(result.exitCode).toBe(3);
  expect(result.stdout).toContain('hello from hello.mjs');
  expect(result.stderr).toContain('a warning on stderr');
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
  expect(result.truncated).toBe(false);
  expect(result.timedOut).toBe(false);
  expect(result.stopped).toBe(false);
  // Live events carried the same content, stream-separated.
  expect(events.filter(e => e.stream === 'stdout').map(e => e.data).join('')).toContain('hello from hello.mjs');
  expect(events.filter(e => e.stream === 'stderr').map(e => e.data).join('')).toContain('a warning on stderr');
});

it('bounds runaway output to the head and tail', async () => {
  await fs.writeFile(
    path.join(workspace, 'chatty.mjs'),
    'process.stdout.write("A".repeat(300_000));\nprocess.stdout.write("\\nEND-MARKER\\n");\n',
  );
  const result = await (await runWorkspaceFile(workspace, 'chatty.mjs')).promise;
  expect(result.truncated).toBe(true);
  expect(result.stdout.startsWith('A')).toBe(true);
  expect(result.stdout.endsWith('END-MARKER\n')).toBe(true);
  expect(result.stdout.length).toBeLessThan(300_000);
  expect(result.stdout).toContain('bytes omitted');
  expect(result.exitCode).toBe(0);
});

it('kills the process tree when stopped, and reports stop separately from exit', async () => {
  await fs.writeFile(
    path.join(workspace, 'slow.mjs'),
    'console.log("starting...");\nsetInterval(() => console.log("tick"), 250);\n',
  );
  const run = await runWorkspaceFile(workspace, 'slow.mjs');
  await new Promise(r => setTimeout(r, 700));
  run.stop();
  const started = Date.now();
  const result = await run.promise;
  expect(Date.now() - started).toBeLessThan(10_000);
  expect(result.stopped).toBe(true);
  expect(result.timedOut).toBe(false);
  expect(result.stdout).toContain('starting...');
});

it('enforces the hard timeout and kills the run', async () => {
  await fs.writeFile(path.join(workspace, 'hang.mjs'), 'setTimeout(() => {}, 30_000);\n');
  const run = await runWorkspaceFile(workspace, 'hang.mjs', { timeoutMs: 700 });
  const result = await run.promise;
  expect(result.timedOut).toBe(true);
  expect(result.stopped).toBe(false);
  expect(result.durationMs).toBeLessThan(15_000);
});

it('runs python when installed, otherwise reports a clear missing-interpreter error', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  await fs.writeFile(path.join(workspace, 'probe.py'), 'print("py works")\n');
  let hasPython = true;
  try {
    await promisify(execFile)(process.platform === 'win32' ? 'where' : 'which', ['python'], { windowsHide: true });
  } catch {
    hasPython = false;
  }
  const run = await runWorkspaceFile(workspace, 'probe.py');
  if (hasPython) {
    const result = await run.promise;
    expect(result.stdout).toContain('py works');
    expect(result.exitCode).toBe(0);
  } else {
    await expect(run.promise).rejects.toThrow('No python interpreter was found');
  }
});
