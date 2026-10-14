import { BrowserWindow } from 'electron';
import crypto from 'node:crypto';
import type { ProjectorTrace } from './projectorDiagnostics';
import { yeetCastOrigin } from '../src/yeetcast';

/** Trusted, fixed code executed only on the school's YeetCast origin. It uses
 * normal server-validated Livewire actions; no identity or locked fields change. */
export function projectorJoinScript(code: string): string {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit projector code.');
  return ` (async () => {
    const cast = window.Livewire?.getByName?.('cast')?.[0];
    if (!cast) return {phase:'loading'};
    if (cast.$get('suspended')) return {phase:'error',message:'Your YeetCast account cannot connect. Contact the school.'};
    if (!cast.$get('nameSet') || (cast.$get('isGuest') && !cast.$get('guestCodeSet'))) return {phase:'signin'};
    if (!window.__schoolworkProjectorJoin && (Number(cast.$get('senderId')) > 0 || Number(cast.$get('receiverId')) > 0)) {
      await cast.$call('deleteSender'); window.location.reload(); return {phase:'loading'};
    }
    if (!window.__schoolworkProjectorJoin) {
      window.__schoolworkProjectorJoin = {phase:'joining'};
      try {
        await cast.$set('code', ${JSON.stringify(code.split(''))}, false);
        await cast.$call('checkCode');
        const id = Number(cast.$get('receiverId'));
        if (!Number.isSafeInteger(id) || id <= 0) {
          const form = document.getElementById('connectForm');
          const error = form?.querySelector('p.text-red-600, ul.text-red-600, [role="alert"]')?.textContent?.trim();
          window.__schoolworkProjectorJoin = {phase:'error',message:error || 'That code is invalid or expired. Enter the code currently shown on the projector.'};
        } else {
          // Resolve through the official join action, then remove OUR temporary
          // sender. Never load its push stream or touch another participant.
          await cast.$call('deleteSender');
          window.__schoolworkProjectorJoin = {phase:'resolved',id};
        }
      } catch {
        window.__schoolworkProjectorJoin = {phase:'error',message:'Could not connect to YeetCast. Check the connection and try the current code again.'};
      }
    }
    return window.__schoolworkProjectorJoin;
  })()`;
}
export class ProjectorConnector {
  private cancelPending: (() => void) | null = null;
  constructor(private trace: ProjectorTrace = ()=>{}) {}
  cancel(): void { this.cancelPending?.(); }
  async resolve(code: string): Promise<string> {
    if (this.cancelPending) throw new Error('A projector connection is already in progress.');
    const script = projectorJoinScript(code);
    const attemptId=crypto.randomUUID(),started=Date.now();
    const log:ProjectorTrace=(event,details)=>this.trace(event,{...details,attemptId});
    log('connect.start',{outcome:'started'});
    const win = new BrowserWindow({ width: 700, height: 720, show: false,
      title: 'SchoolWork · Sign in to YeetCast', autoHideMenuBar: true,
      webPreferences: { partition: 'persist:schoolwork-projector-signin', contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    // The join action normally renders a sender iframe. Never allow it to load,
    // and never give the connection window microphone/camera/screen permission.
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    win.webContents.session.setPermissionCheckHandler(() => false);
    win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
    win.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: details.resourceType === 'subFrame' && !details.url.startsWith('https://accounts.google.com/') }));
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const allowed = (raw: string) => {
      try { return ['https://yeet.ssis.nu', 'https://accounts.google.com'].includes(new URL(raw).origin); } catch { return false; }
    };
    const navigate=(event: {preventDefault():void},url:string)=>{
      const permitted=allowed(url);if(!permitted)event.preventDefault();
      log('connect.navigation',{outcome:permitted?'started':'blocked',target:url.startsWith(yeetCastOrigin+'/')?'school':url.startsWith('https://accounts.google.com/')?'google':'other'});
    };
    win.webContents.on('will-navigate',navigate);
    win.webContents.on('will-redirect',navigate);
    return new Promise<string>((resolve, reject) => {
      let finished = false, checking = false, ready = false, execution: Promise<unknown> | null = null,lastPhase='';
      const finish = (url?: string, error?: string, reason='user_cancel') => {
        if (finished) return; finished = true; clearInterval(timer); clearTimeout(deadline);
        log('connect.finish',{outcome:url?'succeeded':reason==='deadline'?'timed_out':error?'failed':'cancelled',reason,durationMs:Date.now()-started});
        const complete = () => {
          this.cancelPending = null;
          if (!win.isDestroyed()) win.destroy();
          if (url) resolve(url); else reject(new Error(error || 'Projector connection cancelled.'));
        };
        if (url || win.isDestroyed()) {complete();return;}
        win.hide();
        // Let a submitted join finish its own deletion before tearing down its
        // page. Retry deletion after a failed join; bound cleanup when offline.
        let cleanupTimer: ReturnType<typeof setTimeout>;
        const cleanup = async () => {
          await execution?.catch(()=>{});
          if (!win.isDestroyed() && win.webContents.getURL().startsWith(yeetCastOrigin+'/')) {
            await win.webContents.executeJavaScript(`(async()=>{const cast=window.Livewire?.getByName?.('cast')?.[0];if(Number(cast?.$get('senderId'))>0)await cast.$call('deleteSender');})()`);
            log('connect.cleanup',{outcome:'succeeded'});
          }
        };
        void Promise.race([cleanup().catch(()=>{log('connect.cleanup',{outcome:'failed',reason:'cleanup_failed'});}),new Promise<void>(done=>{cleanupTimer=setTimeout(()=>{log('connect.cleanup',{outcome:'timed_out',reason:'cleanup_timeout'});done();},8000);})]).finally(()=>{clearTimeout(cleanupTimer);complete();});
      };
      const tick = async () => {
        if (checking || finished || !ready || win.isDestroyed()) return;
        if (!win.webContents.getURL().startsWith(yeetCastOrigin+'/')) return;
        checking = true;
        try {
          execution = win.webContents.executeJavaScript(script);
          const state: any = await execution;
          if (finished) return;
          if(state?.phase!==lastPhase){lastPhase=String(state?.phase);log('connect.phase',{phase:lastPhase});}
          if (state?.phase === 'signin') { if (!win.isVisible()) win.show(); }
          else if (state?.phase === 'resolved' && Number.isSafeInteger(state.id) && state.id > 0) {log('connect.cleanup',{outcome:'succeeded'});finish(yeetCastOrigin + '/receiver/' + state.id);}
          else if (state?.phase === 'error') finish(undefined, String(state.message).slice(0, 400),'lookup_rejected');
        } catch { if(!finished&&lastPhase!=='navigation_context'){lastPhase='navigation_context';log('connect.execution',{outcome:'failed',reason:'navigation_context'});} }
        finally { checking = false; }
      };
      const timer = setInterval(() => void tick(), 500);
      const deadline = setTimeout(() => finish(undefined, 'Connection timed out. Sign in again and enter the current projector code.','deadline'), 180_000);
      this.cancelPending = () => finish();
      win.on('closed', () => finish(undefined,undefined,'window_closed'));
      win.webContents.on('did-finish-load', () => { ready = true; log('connect.load',{outcome:'loaded'});void tick(); });
      win.webContents.on('render-process-gone',()=>finish(undefined,'The school sign-in window stopped. Try connecting again.','invalid_state'));
      win.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
        if (mainFrame && code !== -3) {log('connect.load',{outcome:'failed',reason:'network',netError:code});finish(undefined, 'Could not load YeetCast. Check your connection and try again.','network');}
      });
      void win.loadURL(yeetCastOrigin + '/').catch(() => finish(undefined, 'Could not reach YeetCast. Try again when you are online.','network'));
    });
  }
}
