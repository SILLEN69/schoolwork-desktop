import { it, expect } from 'vitest';
import { executeProcess, stopOwnedProcesses } from './processTools';
const context = () => ({ workspace: process.cwd(), access: 'workspace' as const, signal: new AbortController().signal });
it('passes arguments without shell interpretation and streams real output', async () => {
  const output: string[] = [];
  const r = await executeProcess('run_process', { executable: process.execPath, args: ['-e', 'console.log(process.argv[1])', 'spaces & symbols $value'] }, context(), text => output.push(text));
  expect(r.ok).toBe(true); expect(r.data.stdout).toContain('spaces & symbols $value'); expect(output.length).toBeGreaterThan(0);
});
it('returns nonzero exits and kills cancelled processes', async () => {
  const r = await executeProcess('run_process', { executable: process.execPath, args: ['-e', 'process.exit(7)'] }, context(), () => {});
  expect(r.ok).toBe(false); expect(r.data.exitCode).toBe(7);
  const control = new AbortController();
  const running = executeProcess('run_process', { executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] }, { ...context(), signal: control.signal }, () => {});
  setTimeout(() => control.abort(), 250);
  await expect(running).rejects.toThrow('cancelled');
});
it.skipIf(process.platform !== 'win32')('runs PowerShell without a script file and fails on command errors', async () => {
  const r = await executeProcess('run_powershell', { command: "Write-Output 'hello'" }, context(), () => {}); expect(r.ok).toBe(true); expect(r.data.stdout).toContain('hello');
  const bad = await executeProcess('run_powershell', { command: "throw 'seeded failure'" }, context(), () => {}); expect(bad.ok).toBe(false); expect(bad.data.stderr).toContain('seeded failure');
}, 30_000); // Two PowerShell starts can exceed Vitest's 5s default on hosted Windows runners.
it('owns background processes, returns their output and stops them', async () => {
  const ctx = { ...context(), owner: 'test-conversation' };
  try {
    const started = await executeProcess('start_process', { executable: process.execPath, args: ['-e', "console.log('ready');setInterval(()=>{},1000)"] }, ctx, () => {});
    const sessionId = started.data.sessionId;
    await expect(executeProcess('read_process', { sessionId }, { ...ctx, owner: 'other' }, () => {})).rejects.toThrow('belong');
    await new Promise(resolve => setTimeout(resolve, 150));
    const read = await executeProcess('read_process', { sessionId }, ctx, () => {}); expect(read.data.stdout).toContain('ready'); expect(read.data.running).toBe(true);
    const stopped = await executeProcess('stop_process', { sessionId }, ctx, () => {}); expect(stopped.data.running).toBe(false);
  } finally { stopOwnedProcesses(ctx.owner); }
});
