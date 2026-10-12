import { expect, it } from 'vitest';
import { ProgressGuard, capabilityInstructions, isDesktopAutomationCommand } from './progressGuard';
it('bounds repeated unchanged excerpts across unrelated reads and allows changed content and ranges',()=>{
 const g=new ProgressGuard();const file={path:'app.ts',sha256:'one',startLine:1,endLine:20,text:'excerpt'};
 expect(g.observe('read_file',{}, {ok:true,data:file})).toBeUndefined();
 g.observe('read_file',{}, {ok:true,data:file});
 expect(g.observe('read_files',{}, {ok:true,data:{files:[file]}})?.stop).toBe(false);
 g.observe('read_file',{}, {ok:true,data:{...file,path:'other.ts'}});
 for(let i=0;i<4;i++)g.observe('read_file',{}, {ok:true,data:file});
 expect(g.observe('read_file',{}, {ok:true,data:file})?.stop).toBe(true);
 expect(g.observe('read_file',{}, {ok:true,data:{...file,sha256:'two'}})).toBeUndefined();
 expect(g.observe('read_file',{}, {ok:true,data:{...file,startLine:21,endLine:40}})).toBeUndefined();
 g.observe('edit_file',{}, {ok:true});expect(g.observe('read_file',{}, {ok:true,data:file})).toBeUndefined();
});
it('stops repeating a passing check and resets after a new edit',()=>{
 const g=new ProgressGuard(),args={executable:'node',args:['app.check.js'],purpose:'test'},result={ok:true,data:{exitCode:0}};
 expect(g.observe('run_process',args,result)).toBeUndefined();expect(g.observe('run_process',args,result)?.stop).toBe(false);g.observe('run_process',args,result);expect(g.observe('run_process',args,result)?.stop).toBe(true);
 g.observe('edit_file',{path:'app.js'},{ok:true});expect(g.observe('run_process',args,result)).toBeUndefined();
});
it('distinguishes expired observations from covering windows on the same target',()=>{
  const g=new ProgressGuard();
  g.observe('click',{}, {ok:false,data:{code:'FOCUS_REQUIRED',windowId:'1'}});
  g.observe('click',{}, {ok:false,data:{code:'FOCUS_REQUIRED',windowId:'1'}});
  expect(g.observe('click',{}, {ok:false,data:{code:'WINDOW_COVERED',windowId:'1'}})).toBeUndefined();
});
it('keeps repeated focus failures across unrelated successful reads', () => {
  const g=new ProgressGuard();
  const failure={ok:false,summary:'Window focus changed'};
  expect(g.observe('capture_screen',{windowId:'1'},failure)).toBeUndefined();
  g.observe('read_file',{path:'note.md'},{ok:true});
  expect(g.observe('capture_screen',{windowId:'1'},failure)?.stop).toBe(false);
  g.observe('run_powershell',{command:'Get-Date'},{ok:true});
  expect(g.observe('capture_screen',{windowId:'1'},failure)?.stop).toBe(true);
});
it('bounds repeated captures even when calls/frames change', () => {
  const g=new ProgressGuard();
  for(let i=0;i<11;i++) expect(g.observe('capture_screen',{windowId:'1'},{ok:true,data:{frameDigest:String(i)}})?.stop).not.toBe(true);
  expect(g.observe('list_windows',{}, {ok:true})?.stop).toBe(true);
});
it('bounds unchanged frames but a genuine input resets the observation streak', () => {
  const g=new ProgressGuard();
  const capture=()=>g.observe('capture_screen',{windowId:'1'},{ok:true,data:{frameDigest:'same'}});
  capture(); expect(capture()?.stop).toBe(false);
  g.observe('click',{}, {ok:true});
  expect(capture()).toBeUndefined();capture();capture();expect(capture()?.stop).toBe(true);
});
it('clears only a recovered target failure, not another target', () => {
  const g=new ProgressGuard();
  for(const windowId of ['1','1'])g.observe('capture_screen',{windowId},{ok:false});
  g.observe('capture_screen',{windowId:'2'},{ok:true});
  expect(g.observe('capture_screen',{windowId:'1'},{ok:false})?.stop).toBe(true);
});
it('states the actual input status and spots common shell GUI workarounds', () => {
  expect(capabilityInstructions(['click','type_text','release_screen_control'],true)).toContain('ARE available');
  expect(capabilityInstructions(['click'],false)).toContain('OFF for this task');
  expect(isDesktopAutomationCommand('run_powershell',{command:'[System.Windows.Forms.SendKeys]::SendWait("x")'})).toBe(true);
  expect(isDesktopAutomationCommand('run_process',{args:['-Command','SetForegroundWindow']})).toBe(true);
  expect(isDesktopAutomationCommand('run_powershell',{command:'npm test'})).toBe(false);
});
