import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { z } from 'zod';
import { resolveFile, type FileContext } from './projectTools';

const common = { cwd: z.string().max(4096).optional(), timeoutMs: z.number().int().min(1000).max(600000).default(120000) };
type Session = { owner: string; child: ChildProcess; output: string; exitCode: number | null; running: boolean; cwd: string };
const sessions = new Map<string, Session>();
function killTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === 'win32') { const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); killer.on('error', () => child.kill()); }
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
}
export function stopOwnedProcesses(owner?: string) { for (const session of sessions.values()) if ((!owner || session.owner === owner) && session.running) killTree(session.child); }
export const processInputs = {
  run_process: z.object({ ...common, executable: z.string().min(1).max(4096), args: z.array(z.string().max(12000)).max(100).default([]), purpose: z.enum(['inspect', 'build', 'test', 'lint', 'other']).default('other') }),
  run_powershell: z.object({ ...common, command: z.string().min(1).max(12000) }),
  start_process: z.object({ cwd: common.cwd, executable: z.string().min(1).max(4096), args: z.array(z.string().max(12000)).max(100).default([]) }),
  read_process: z.object({ sessionId: z.string().uuid() }),
  stop_process: z.object({ sessionId: z.string().uuid() }),
};
export const processToolSchemas = Object.entries(processInputs).map(([name, schema]) => ({ type: 'function', function: { name, description: name === 'start_process' ? 'Start a background development server and return a sessionId. Use read_process to inspect output, check_preview to verify readiness, and stop_process when no longer needed. Max 4 live sessions per conversation. node uses the bundled Electron Node runtime.' : name === 'read_process' ? 'Read bounded output and exit status from a server started in this conversation.' : name === 'stop_process' ? 'Stop an app-owned server and its child processes by sessionId.' : name === 'run_process' ? 'Run an executable directly with a separate argument array, no shell quoting. Prefer for node, python, git and test runners. Select build/test/lint purpose for an actual verification command, never for echo or a version check. Streams terminal output. On Windows use run_powershell for npm.cmd scripts.' : 'Run PowerShell commands with an optional working directory and streamed output. Uses command mode, no temporary .ps1 file or execution-policy change. Commands run with Windows user permissions, not a sandbox.', parameters: z.toJSONSchema(schema) } }));
export async function executeProcess(name: keyof typeof processInputs, raw: unknown, ctx: FileContext & { owner?: string }, progress: (text: string) => void) {
  if (name === 'read_process' || name === 'stop_process') {
    const { sessionId } = processInputs[name].parse(raw); const session = sessions.get(sessionId);
    if (!session || session.owner !== ctx.owner) throw new Error('Process session does not belong to this conversation or was lost after restart. Inspect recorded PID before starting another server.');
    if (name === 'stop_process' && session.running) { killTree(session.child); await new Promise<void>(resolve => { const timer = setTimeout(resolve, 4000); session.child.once('close', () => { clearTimeout(timer); resolve(); }); }); }
    return { ok: name === 'read_process' || !session.running, summary: session.running ? 'Process is running.' : 'Process has exited.', data: { sessionId, pid: session.child.pid, cwd: session.cwd, running: session.running, exitCode: session.exitCode, stdout: session.output } };
  }
  const args: any = processInputs[name].parse(raw); const cwd = await resolveFile(ctx, args.cwd || '.');
  ctx.signal.throwIfAborted();
  const bundledNode = args.executable === 'node' && !!process.versions.electron;
  const executable = name === 'run_powershell' ? 'powershell.exe' : bundledNode ? process.execPath : args.executable;
  const argv = name === 'run_powershell' ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; try { & { ${args.command}\n }; if ($LASTEXITCODE -ne $null) { exit $LASTEXITCODE } } catch { [Console]::Error.WriteLine($_); exit 1 }`] : args.args;
  const env = Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','PATH','PATHEXT','APPDATA','LOCALAPPDATA','HOME','LANG'].filter(k => process.env[k]).map(k => [k, process.env[k]! ]));
  if (bundledNode) env.ELECTRON_RUN_AS_NODE = '1';
  if (name === 'start_process') {
    if (!ctx.owner) throw new Error('Background processes require a conversation owner.');
    if ([...sessions.values()].filter(s => s.owner === ctx.owner && s.running).length >= 4) throw new Error('Stop an existing background process before starting another.');
    const sessionId = crypto.randomUUID();
    const child = spawn(executable, argv, { cwd, env, shell: false, windowsHide: true, detached: process.platform !== 'win32' });
    child.stdin.end(); // These tools supply no interactive input; signal EOF to commands such as PowerShell.
    const session: Session = { owner: ctx.owner, child, cwd, output: '', exitCode: null, running: true }; sessions.set(sessionId, session);
    const capture = (data: Buffer) => { session.output = (session.output + data.toString()).slice(-30000); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    child.on('close', code => { session.running = false; session.exitCode = code; });
    child.on('error', error => { session.running = false; session.output += error.message; });
    const cancel = () => killTree(child); ctx.signal.addEventListener('abort', cancel, { once: true });
    try { await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); ctx.signal.throwIfAborted(); }
    catch (e) { killTree(child); throw e; }
    finally { ctx.signal.removeEventListener('abort', cancel); }
    return { ok: true, summary: 'Background process started. Read its output and verify the URL before claiming readiness.', data: { sessionId, pid: child.pid, cwd } };
  }
  return new Promise<any>((resolve, reject) => {
    const child = spawn(executable, argv, { cwd, env, shell: false, windowsHide: true, detached: process.platform !== 'win32' });
    child.stdin.end(); // These tools supply no interactive input; signal EOF to commands such as PowerShell.
    let stdout = '', stderr = '', timedOut = false, cancelled = false, last = 0;
    const kill = () => {
      killTree(child);
    };
    const cancel = () => { cancelled = true; kill(); };
    const timer = setTimeout(() => { timedOut = true; kill(); }, args.timeoutMs);
    ctx.signal.addEventListener('abort', cancel, { once: true });
    if (ctx.signal.aborted) cancel();
    const cleanup = () => { clearTimeout(timer); ctx.signal.removeEventListener('abort', cancel); };
    const notify = () => { if (Date.now() - last > 500) { last = Date.now(); progress((stdout + '\n' + stderr).slice(-6000)); } };
    child.stdout.on('data', data => { stdout = (stdout + data.toString()).slice(-30000); notify(); });
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-20000); notify(); });
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', exitCode => { cleanup(); if (cancelled) { reject(new Error('Command cancelled.')); return; } resolve({ ok: exitCode === 0 && !timedOut, summary: timedOut ? 'Command timed out.' : `Process exited ${exitCode}.`, data: { cwd, exitCode, timedOut, stdout, stderr, purpose: args.purpose || 'other' } }); });
  });
}
