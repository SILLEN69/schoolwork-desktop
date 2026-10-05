import { it, expect } from 'vitest';
import { VerificationGate } from './verification';
it('requires a successful check after the latest code edit', () => {
  const gate = new VerificationGate();
  gate.observe('write_file', { path: 'index.html' }, { ok: true });
  gate.observe('open_browser', {}, { ok: true }); expect(gate.needed).toBe(true);
  gate.observe('run_powershell', { command: 'npm test' }, { ok: false, data: { exitCode: 1 } }); expect(gate.needed).toBe(true);
  gate.observe('run_powershell', { command: 'npm test' }, { ok: true, data: { exitCode: 0 } }); expect(gate.needed).toBe(false);
  gate.observe('patch_file', { path: 'app.js' }, { ok: true }); expect(gate.needed).toBe(true);
});
