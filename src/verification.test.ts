import { it, expect } from 'vitest';
import { VerificationGate, isCodeArtifact } from './verification';
it('does not require code tests for a saved memory, email draft or document', () => {
  const gate=new VerificationGate();
  for(const path of ['schoolwork-notes/user-profile.md','C:\\vault\\MEMORY.md','draft.eml','report.docx','notes.txt']) {
    expect(isCodeArtifact(path)).toBe(false);
    gate.observe('write_file',{path},{ok:true});
    gate.observe('edit_file',{path},{ok:true});
    expect(gate.needed).toBe(false);
  }
  gate.observe('memory_save',{}, {ok:true}); expect(gate.needed).toBe(false);
  for(const path of ['package.json','package-lock.json','tsconfig.json','app.tsx','app.csproj','pyproject.toml']) expect(isCodeArtifact(path)).toBe(true);
});
it('requires a successful check after the latest code edit', () => {
  const gate = new VerificationGate();
  gate.observe('write_file', { path: 'index.html' }, { ok: true });
  gate.observe('open_browser', {}, { ok: true }); expect(gate.needed).toBe(true);
  gate.observe('run_powershell', { command: 'npm test' }, { ok: false, data: { exitCode: 1 } }); expect(gate.needed).toBe(true);
  gate.observe('run_powershell', { command: 'npm test' }, { ok: true, data: { exitCode: 0 } }); expect(gate.needed).toBe(false);
  gate.observe('patch_file', { path: 'app.js' }, { ok: true }); expect(gate.needed).toBe(true);
});
it('does not mistake echoed test words for a verification or miss multi-edits', () => {
  const gate = new VerificationGate();
  gate.observe('edit_file', { path: 'package.json' }, { ok: true });
  gate.observe('run_powershell', { command: 'echo test' }, { ok: true, data: { exitCode: 0 } }); expect(gate.needed).toBe(true);
  gate.observe('run_process', { executable: 'node', args: ['--test', 'app.test.cjs'] }, { ok: true, data: { exitCode: 0 } }); expect(gate.needed).toBe(false);
});
