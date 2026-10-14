import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import type { SchoolWorkStore } from './storage';
import { parseReceiverPage, normalizeReceiverUrl, projectorCode, displayedProjectorCode, readOnlyViewUrl, type BoardStatus, type YeetCastState } from '../src/yeetcast';
import { ProjectorConnector } from './projectorConnect';
import type { ProjectorTrace } from './projectorDiagnostics';

/** View-only board viewer for the school's YeetCast projector pages
 *  (yeet.ssis.nu). The projector page is public; we read it, extract the
 *  read-only vdo.ninja "view" URL of the active cast and show it in a
 *  small floating window. Code lookup uses the school's normal join action and
 *  immediately deletes its own temporary sender before opening a view stream. */



const BOARD_WIDTH = 1024;
const BOARD_HEIGHT = 576;
const POLL_MS = 10_000;

export class Board {
  private win: BrowserWindow | null = null;
  private state: YeetCastState | null = null;
  private currentView = '';
  private mediaView = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private refreshing: Promise<void> | null = null;
  private lastError: string | undefined;
  private lastChecked = 0;
  private generation = 0;
  private connector: ProjectorConnector;
  private refreshController: AbortController | null = null;
  private refreshGeneration = -1;
  private monitorGeneration = 0;
  constructor(
    private store: SchoolWorkStore,
    private root: string,
    private fetcher: typeof fetch = fetch,
    private codeResolver?: (code: string) => Promise<string>,
    private trace: ProjectorTrace = ()=>{},
    private diagnosticsAvailable = false,
  ) {this.connector=new ProjectorConnector(trace);}

  get receiverUrl(): string {
    const saved = this.store.getMetadata('board:receiverUrl');
    if (!saved) return '';
    try { return normalizeReceiverUrl(saved); } catch { return ''; }
  }

  async configure(raw: string): Promise<string> {
    const generation = ++this.generation;
    this.refreshController?.abort();
    this.trace('board.configure',{outcome:'started'});
    const code = projectorCode(raw);
    let url:string;
    try {
      let remembered = '';
      if (code && this.receiverUrl) {
        const controller = new AbortController(); this.refreshController = controller;
        try {
          const response = await this.fetcher(this.receiverUrl, {redirect:'error', headers:{Accept:'text/html'},
            signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});
          if (response.ok && displayedProjectorCode(await response.text()) === code) remembered = this.receiverUrl;
        } catch { /* A hidden code or an unavailable saved receiver uses normal authorization. */ }
        finally { if(this.refreshController===controller)this.refreshController=null; }
        if(generation!==this.generation)throw new Error('Projector connection cancelled.');
      }
      url=normalizeReceiverUrl(remembered || (code?await (this.codeResolver?this.codeResolver(code):this.connector.resolve(code)):raw));
    }
    catch(error){this.trace('board.configure',{outcome:'failed',reason:code?'lookup_rejected':'invalid_input'});throw error;}
    if (generation !== this.generation) throw new Error('Projector connection cancelled.');
    this.closeWindow();
    this.store.setMetadata('board:receiverUrl', url);
    this.state = null;
    this.currentView = '';
    this.lastError = undefined;
    this.lastChecked = 0;
    this.trace('board.configure',{outcome:'succeeded'});
    return url;
  }
  cancelConnect(): boolean { this.generation++;this.refreshController?.abort();this.connector.cancel();this.lastChecked=0;return true; }
  disconnect(): boolean {
    this.trace('board.disconnect',{outcome:'succeeded'});
    this.cancelConnect(); this.closeWindow(); this.store.setMetadata('board:receiverUrl', '');
    this.state = null; this.currentView = ''; this.lastError = undefined; this.lastChecked = 0; return true;
  }

  status(): BoardStatus {
    return {
      configured: Boolean(this.receiverUrl),
      receiverUrl: this.receiverUrl,
      active: this.state?.active === true || Boolean(this.mediaView && this.mediaView===this.currentView && this.win && !this.win.isDestroyed()),
      connections: this.state?.connections === true,
      senders: this.state?.senders || [],
      viewUrl: this.currentView || null,
      windowOpen: Boolean(this.win && !this.win.isDestroyed() && this.win.isVisible()),
      lastChecked: this.lastChecked,
      error: this.lastError,
      diagnosticsAvailable:this.diagnosticsAvailable,
    };
  }

  /** Read the projector page once. Cheap enough to run on demand and on a
   *  slow poll while the board window is open. */
  async refresh(force=false): Promise<BoardStatus> {
    const url = this.receiverUrl;
    if (!url) return this.status();
    // Short TTL so the UI poll and the window poll share one fetch.
    if (!force&&this.lastChecked && Date.now() - this.lastChecked < 8_000) return this.status();
    if (this.refreshing&&this.refreshGeneration===this.generation) { await this.refreshing; if (url !== this.receiverUrl) return this.refresh(force); return this.status(); }
    const generation = this.generation;
    const controller=new AbortController();this.refreshController=controller;this.refreshGeneration=generation;
    const started=Date.now();
    const operation = (async () => {
      try {
        const response = await this.fetcher(url, {
          headers: { Accept: 'text/html' },
          redirect: 'error',
          signal: AbortSignal.any([controller.signal,AbortSignal.timeout(15_000)]),
        });
        this.trace('board.refresh',{httpStatus:response.status,durationMs:Date.now()-started});
        if (!response.ok) throw new Error(response.status === 404 ? 'This projector is no longer available. Connect using its current code.' : `Could not check the projector (HTTP ${response.status}). Try again.`);
        const html = await response.text();
        if (generation !== this.generation) return;
        const parsed = parseReceiverPage(html);
        this.trace('board.refresh',{outcome:parsed?'succeeded':'failed',...(parsed?{active:parsed.active,connections:parsed.connections,senderCount:parsed.senderCount??parsed.senders.length}:{reason:'parse_failed'})});
        this.lastError = parsed ? undefined : 'Could not read this projector. Connect using the current code shown on its screen.';
        if (parsed) this.adopt(parsed);
        else this.adopt({receiverUri:'',active:false,connections:false,senders:[]});
      } catch (error) {
        if (generation !== this.generation) return;
        this.trace('board.refresh',{outcome:'failed',reason:'network',durationMs:Date.now()-started});
        this.lastError = error instanceof Error && error.message.includes('projector') ? error.message : 'Could not reach the projector. Check your connection and try again.';
        this.adopt({receiverUri:'',active:false,connections:false,senders:[]});
      } finally {
        if (generation === this.generation) this.lastChecked = Date.now();
      }
    })();
    this.refreshing=operation;
    try {
      await operation;
    } finally {
      if(this.refreshing===operation)this.refreshing=null;
      if(this.refreshController===controller)this.refreshController=null;
    }
    return this.status();
  }

  private adopt(parsed: YeetCastState) {
    const nextView=parsed.active||parsed.connections ? parsed.receiverUri : '';
    const changed = this.currentView !== nextView;
    this.state = parsed;
    this.currentView = nextView;
    if(changed)this.mediaView='';
    if (changed && this.win && !this.win.isDestroyed() && this.win.webContents.getURL() !== this.currentView) {
      void this.win.webContents.loadURL(this.currentView || 'about:blank').catch(() => {});
    }
  }

  /** Open the floating board window on the active cast's read-only view. */
  async open(background=false, monitor=this.monitorGeneration): Promise<BoardStatus> {
    const generation=this.generation;
    const status = (await this.refresh()) as BoardStatus;
    if(background&&monitor!==this.monitorGeneration)throw new Error('Board monitoring paused.');
    if(generation!==this.generation)throw new Error('Projector connection changed. Open the selected board again.');
    if (status.error || !status.viewUrl) {
      throw new Error(
        status.error || (status.configured
          ? 'No cast is running on that projector right now. Try again when someone starts presenting.'
          : 'Enter the six-digit code shown on the projector.'),
      );
    }
    if (!this.win || this.win.isDestroyed()) {
      this.win = new BrowserWindow({
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        title: 'Tavlan',
        show: false,
        resizable: true,
        alwaysOnTop: true,
        fullscreenable: false,
        backgroundColor: '#000000',
        webPreferences: { partition: 'schoolwork-board-view', contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling:false },
      });
      this.win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      this.win.webContents.session.setPermissionCheckHandler(() => false);
      this.win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
      this.win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
      this.win.webContents.on('will-navigate', (event, url) => { if (!readOnlyViewUrl(url)) event.preventDefault(); });
      this.win.webContents.on('will-redirect',(event,url)=>{if(!readOnlyViewUrl(url))event.preventDefault();});
      this.win.webContents.on('did-fail-load',(_event,code,_description,_url,mainFrame)=>{if(mainFrame&&code!==-3)this.trace('board.view',{outcome:'failed',reason:'stream_load',netError:code});});
      this.win.setMenuBarVisibility(false);
      this.win.on('closed', () => {
        this.win = null;
        this.mediaView = '';
        this.stopPolling();
      });
    }
    const viewer=this.win;
    if (viewer.webContents.getURL() !== status.viewUrl) {
      this.trace('board.view',{outcome:'started'});
      try { await viewer.webContents.loadURL(status.viewUrl); }
      catch { if(this.win===viewer)this.closeWindow();this.trace('board.view',{outcome:'failed',reason:'stream_load'});throw new Error('Could not open the board stream. Check your connection and try again.'); }
    }
    if(generation!==this.generation||this.win!==viewer||viewer.isDestroyed()||status.viewUrl!==this.currentView)throw new Error('Projector connection changed. Open the selected board again.');
    if(!background){viewer.show();viewer.focus();}
    this.trace('board.view',{outcome:'opened'});
    this.startPolling();
    return this.status();
  }

  hide(): boolean {
    if (this.win && !this.win.isDestroyed()) this.win.hide();
    this.trace('board.view',{outcome:'hidden'});
    return this.status().windowOpen;
  }
  stopMonitoring(): void {
    this.monitorGeneration++;
    if(this.win && !this.win.isDestroyed() && !this.win.isVisible()) this.closeWindow();
  }

  close(): void {
    this.cancelConnect(); this.closeWindow();
  }
  private closeWindow(): void {
    this.stopPolling();
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
    this.mediaView='';
  }

  private startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => {
      void this.refresh().catch(() => {});
    }, POLL_MS);
    this.timer.unref?.();
  }

  private stopPolling() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Capture the board window to a JPEG under the board root. Returns the
   *  file path, or null when no board window is visible. */
  async capture(background=false, captured?: (at:number)=>void): Promise<string | null> {
    const monitor=this.monitorGeneration;
    if(background)await this.open(true,monitor);
    if(background&&monitor!==this.monitorGeneration)return null;
    await this.refresh(true);
    if (!this.currentView || !this.win || this.win.isDestroyed() || (!background && (!this.win.isVisible() || this.win.isMinimized()))) return null;
    if (this.win.webContents.getURL() !== this.currentView) return null;
    const viewer=this.win,generation=this.generation,view=this.currentView;
    const media=await viewer.webContents.executeJavaScript(`(()=>{const videos=[...document.querySelectorAll('video')];const ready=videos.find(v=>v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0);return {videoCount:videos.length,readyState:ready?.readyState||0};})()`);
    if(media?.readyState<2||!media?.videoCount){this.trace('board.capture',{outcome:'not_ready',reason:'no_video_frame',videoCount:Number(media?.videoCount)||0,readyState:Number(media?.readyState)||0});throw new Error('The board video is still connecting. Wait for the picture in the board window, then capture again.');}
    if(generation!==this.generation||this.win!==viewer||view!==this.currentView||viewer.isDestroyed())return null;
    this.mediaView=view;
    const at=Date.now();
    const image = await viewer.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    if(generation!==this.generation||this.win!==viewer||view!==this.currentView||viewer.isDestroyed()||(!background&&!viewer.isVisible())||(background&&monitor!==this.monitorGeneration)){this.trace('board.capture',{outcome:'stale',reason:'selection_changed'});return null;}
    if (image.isEmpty()) {this.trace('board.capture',{outcome:'failed',reason:'empty_image'});return null;}
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const file = path.join(this.root, 'board-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.jpg');
    await fs.writeFile(file, image.toJPEG(78), { mode: 0o600 });
    if(generation!==this.generation||view!==this.currentView){await fs.unlink(file).catch(()=>{});return null;}
    this.trace('board.capture',{outcome:'succeeded'});
    captured?.(at);
    return file;
  }

}
