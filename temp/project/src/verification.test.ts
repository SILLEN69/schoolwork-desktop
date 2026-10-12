import { it, expect } from 'vitest';
import { VerificationGate, isCodeArtifact, isVerificationCommand } from './verification';
it('invalidates an earlier passing check when a later real check fails, without requiring unrelated inspection work to become a coding task',()=>{
 const gate=new VerificationGate(),args={command:'npm run lint'};
 gate.observe('run_powershell',args,{ok:false,data:{exitCode:1}});expect(gate.needed).toBe(false);
 gate.observe('edit_file',{path:'app.js'},{ok:true});
 gate.observe('run_powershell',args,{ok:true,data:{exitCode:0}});expect(gate.needed).toBe(false);
 gate.observe('run_powershell',args,{ok:false,data:{exitCode:1}});expect(gate.needed).toBe(true);
 gate.observe('run_powershell',args,{ok:true,data:{exitCode:0}});expect(gate.needed).toBe(false);
 gate.observe('run_powershell',args,{ok:false,data:{exitCode:null,timedOut:true}});expect(gate.needed).toBe(true);
});
it('recognizes the saved successful PowerShell directory-prefixed lint check', () => {
  const gate = new VerificationGate();
  gate.observe('edit_file', {path:'Composition.tsx'}, {ok:true});
  const args = {command:'Set-Location "C:\\workspace\\remotion-startup"; npm run lint 2>&1'};
  gate.observe('run_powershell', args, {ok:true,data:{exitCode:0}});
  expect(gate.needed).toBe(false);
  gate.observe('edit_file', {path:'Composition.tsx'}, {ok:true});
  gate.observe('run_powershell', args, {ok:false,data:{exitCode:1}});
  expect(gate.needed).toBe(true);
  gate.observe('run_powershell', args, {ok:true,data:{exitCode:0,timedOut:true}});
  expect(gate.needed).toBe(true);
});
it('accepts literal directory setup and invocation operators without accepting printed or nested claims', () => {
  for(const command of [
    "cd 'C:\\project with spaces'; npm.cmd run lint",
    "Set-Location -LiteralPath 'C:\\project';\nnode --check app.js",
    'npx.cmd tsc --noEmit',
    '& "C:\\Program Files\\nodejs\\npm.cmd" run build',
  ]) expect(isVerificationCommand('run_powershell',{command}),command).toBe(true);
  for(const command of [
    'Write-Output "npm run lint"',
    "Set-Location 'C:\\project'; echo npm run lint",
    "Set-Location 'C:\\project'; # npm run lint",
    "Set-Location 'C:\\project'; if ($false) { npm run lint }",
    "Get-Content file; npm run lint",
    'Set-Location "$(Write-Output npm)"; npm run lint',
  ]) expect(isVerificationCommand('run_powershell',{command}),command).toBe(false);
});
it('recognizes the real custom Node checks from today without accepting a printed claim',()=>{
 const gate=new VerificationGate();const check=(args:string[])=>{gate.observe('write_file',{path:'index.html'},{ok:true});gate.observe('run_process',{executable:'node',args,purpose:'test'},{ok:true,data:{exitCode:0}});return gate.needed;};
 expect(check(['C:\\Downloads\\_verify_whisper.js'])).toBe(false);expect(check(['whisper-test.check.mjs'])).toBe(false);
 expect(check(['-e','require("node:assert").ok(true)'])).toBe(false);expect(check(['-e','console.log("tests passed")'])).toBe(true);
 gate.observe('check_preview',{}, {ok:true,data:{expectationPassed:true,consoleErrors:[]}});expect(gate.needed).toBe(false);
});
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
