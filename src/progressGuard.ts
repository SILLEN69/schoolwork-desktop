const observations = new Set(['list_windows','list_displays','list_apps','capture_screen','inspect_window','prepare_desktop']);
const effects = new Set(['click','type_text','key_press','scroll','move_window','launch_app','open_browser','write_file','patch_file','edit_file','memory_save']);
export function isDesktopAutomationCommand(tool: string, args: Record<string, any>) {
  if (!['run_powershell','run_process'].includes(tool)) return false;
  return /SendKeys|SendInput|SetForegroundWindow|SetWindowPos|keybd_event|mouse_event|System\.Windows\.Automation/i.test(String(args.command || '') + ' ' + JSON.stringify(args.args || []));
}
export function capabilityInstructions(names: string[], inputEnabled: boolean) {
  return 'Registered tool schemas (execution still obeys access and user Stop): ' + names.join(', ') + '. ' + (inputEnabled
    ? 'Mouse and keyboard tools ARE available: prepare_desktop, click, type_text, key_press and scroll. Prepare the selected window once, then inspect the fresh view returned after each input. Do not take redundant screenshots or use PowerShell input workarounds. When desktop work is finished, release_screen_control gives up input for this task only.'
    : 'Mouse/keyboard/focus/move execution is OFF for this task because the user stopped it, screen access was revoked, or you released input. Say "screen input is off for this task", not "I do not have a keyboard tool". Do not bypass this with PowerShell/SendKeys or try to re-enable it. Finish the parts you can, then explain the limitation.');
}
/** A success of an unrelated read does not erase a repeated failure. No input/text/pixels stored. */
export class ProgressGuard {
  private failures = new Map<string, number>();
  private observations = 0;
  private lastFrame = '';
  private unchangedFrames = 0;
  observe(tool: string, args: Record<string, any>, outcome: {ok:boolean;summary?:string;data?:any}) {
    const subject = String(outcome.data?.windowId || outcome.data?.window?.windowId || args.windowId || args.displayId || args.path || '');
    const kind = outcome.data?.code || (/focus|foreground/i.test(outcome.summary || '') ? 'focus' : /off screen|bounds/i.test(outcome.summary || '') ? 'bounds' : 'failure');
    const key = tool + ':' + subject + ':' + kind;
    if (!outcome.ok) {
      const count = (this.failures.get(key) || 0) + 1; this.failures.set(key,count);
      if (count >= 3) return {stop:true,text:'yo, I hit the same '+tool+' problem 3 times. I’m stopping that loop; progress is saved. Fix the window/access issue before retrying.'};
      if (count === 2) return {stop:false,text:'Repeated '+tool+' failure. Do not retry this observation/approach again. Use a different available observation or finish with an honest limitation.'};
    } else {
      for(const k of this.failures.keys()) if(k.startsWith(tool+':'+subject+':')) this.failures.delete(k);
      if(effects.has(tool)) { this.observations=0; this.unchangedFrames=0; this.lastFrame=''; }
      if(observations.has(tool)) this.observations++;
      if((tool==='capture_screen' || tool==='prepare_desktop') && outcome.data?.frameDigest) {
        const frame=subject+':'+outcome.data.frameDigest;
        this.unchangedFrames=frame===this.lastFrame ? this.unchangedFrames+1 : 1; this.lastFrame=frame;
        if(this.unchangedFrames>=4) return {stop:true,text:'yo, the screen hasn’t changed across 4 captures and no action made progress. I stopped the screenshot loop; check the saved result before retrying.'};
      }
    }
    if(this.observations>=12) return {stop:true,text:'yo, I’ve inspected the desktop 12 times without moving the task forward. I stopped the observation loop; progress is saved, but I haven’t verified completion.'};
    if(this.observations===6 || this.unchangedFrames===2) return {stop:false,text:'You are repeating desktop observations without progress. Take one available useful action, verify a concrete result once, or finish with the actual limitation. Do not keep taking screenshots.'};
    return undefined;
  }
}
