import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import type { SchoolWorkStore } from './storage';
import { parseReceiverPage, normalizeReceiverUrl, projectorCode, readOnlyViewUrl, type BoardStatus, type YeetCastState } from '../src/yeetcast';
import { ProjectorConnector } from './projectorConnect';

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
  private timer: ReturnType<typeof setInterval> | null = null;
  private refreshing: Promise<void> | null = null;
  private lastError: string | undefined;
  private lastChecked = 0;
  private generation = 0;
  private connector = new ProjectorConnector();
  constructor(
    private store: SchoolWorkStore,
    private root: string,
    private fetcher: typeof fetch = fetch,
    private codeResolver: (code: string) => Promise<string> = code => this.connector.resolve(code),
  ) {}

  get receiverUrl(): string {
    const saved = this.store.getMetadata('board:receiverUrl');
    if (!saved) return '';
    try { return normalizeReceiverUrl(saved); } catch { return ''; }
  }

  async configure(raw: string): Promise<string> {
    const generation = ++this.generation;
    const code = projectorCode(raw);
    const url = normalizeReceiverUrl(code ? await this.codeResolver(code) : raw);
    if (generation !== this.generation) throw new Error('Projector connection cancelled.');
    this.closeWindow();
    this.store.setMetadata('board:receiverUrl', url);
    this.state = null;
    this.currentView = '';
    this.lastError = undefined;
    this.lastChecked = 0;
    return url;
  }
  cancelConnect(): boolean { this.generation++; this.connector.cancel(); return true; }
  disconnect(): boolean {
    this.cancelConnect(); this.closeWindow(); this.store.setMetadata('board:receiverUrl', '');
    this.state = null; this.currentView = ''; this.lastError = undefined; this.lastChecked = 0; return true;
  }

  status(): BoardStatus {
    return {
      configured: Boolean(this.receiverUrl),
      receiverUrl: this.receiverUrl,
      active: this.state?.active === true,
      connections: this.state?.connections === true,
      senders: this.state?.senders || [],
      viewUrl: this.state?.active ? this.state.receiverUri || null : null,
      windowOpen: Boolean(this.win && !this.win.isDestroyed() && this.win.isVisible()),
      lastChecked: this.lastChecked,
      error: this.lastError,
    };
  }

  /** Read the projector page once. Cheap enough to run on demand and on a
   *  slow poll while the board window is open. */
  async refresh(): Promise<BoardStatus> {
    const url = this.receiverUrl;
    if (!url) return this.status();
    // Short TTL so the UI poll and the window poll share one fetch.
    if (this.lastChecked && Date.now() - this.lastChecked < 8_000) return this.status();
    if (this.refreshing) { await this.refreshing; if (url !== this.receiverUrl) return this.refresh(); return this.status(); }
    const generation = this.generation;
    this.refreshing = (async () => {
      try {
        const response = await this.fetcher(url, {
          headers: { Accept: 'text/html' },
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(response.status === 404 ? 'This projector is no longer available. Connect using its current code.' : `Could not check the projector (HTTP ${response.status}). Try again.`);
        const html = await response.text();
        if (generation !== this.generation) return;
        const parsed = parseReceiverPage(html);
        this.lastError = parsed ? undefined : 'Could not read this projector. Connect using the current code shown on its screen.';
        if (parsed) this.adopt(parsed);
        else this.adopt({receiverUri:'',active:false,connections:false,senders:[]});
      } catch (error) {
        if (generation !== this.generation) return;
        this.lastError = error instanceof Error && error.message.includes('projector') ? error.message : 'Could not reach the projector. Check your connection and try again.';
        this.adopt({receiverUri:'',active:false,connections:false,senders:[]});
      } finally {
        if (generation === this.generation) this.lastChecked = Date.now();
      }
    })();
    try {
      await this.refreshing;
    } finally {
      this.refreshing = null;
    }
    return this.status();
  }

  private adopt(parsed: YeetCastState) {
    const changed = this.currentView !== parsed.receiverUri;
    this.state = parsed;
    this.currentView = parsed.active ? parsed.receiverUri : '';
    if ((changed || !parsed.active) && this.win && !this.win.isDestroyed() && this.win.webContents.getURL() !== this.currentView) {
      void this.win.webContents.loadURL(this.currentView || 'about:blank').catch(() => {});
    }
  }

  /** Open the floating board window on the active cast's read-only view. */
  async open(): Promise<BoardStatus> {
    const status = (await this.refresh()) as BoardStatus;
    if (status.error || !status.active || !status.viewUrl) {
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
        resizable: true,
        alwaysOnTop: true,
        fullscreenable: false,
        backgroundColor: '#000000',
        webPreferences: { partition: 'schoolwork-board-view', contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      this.win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      this.win.webContents.session.setPermissionCheckHandler(() => false);
      this.win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
      this.win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
      this.win.webContents.on('will-navigate', (event, url) => { if (!readOnlyViewUrl(url)) event.preventDefault(); });
      this.win.setMenuBarVisibility(false);
      this.win.on('closed', () => {
        this.win = null;
        this.stopPolling();
      });
    }
    if (this.win.webContents.getURL() !== status.viewUrl) {
      try { await this.win.webContents.loadURL(status.viewUrl); }
      catch { this.closeWindow(); throw new Error('Could not open the board stream. Check your connection and try again.'); }
    }
    this.win.show();
    this.win.focus();
    this.startPolling();
    return this.status();
  }

  hide(): boolean {
    if (this.win && !this.win.isDestroyed()) this.win.hide();
    return this.status().windowOpen;
  }

  close(): void {
    this.cancelConnect(); this.closeWindow();
  }
  private closeWindow(): void {
    this.stopPolling();
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
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
  async capture(): Promise<string | null> {
    if (!this.state?.active || !this.win || this.win.isDestroyed() || !this.win.isVisible() || this.win.isMinimized()) return null;
    if (this.win.webContents.getURL() !== this.currentView) return null;
    const image = await this.win.webContents.capturePage();
    if (image.isEmpty()) return null;
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const file = path.join(this.root, 'board-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.jpg');
    await fs.writeFile(file, image.toJPEG(78), { mode: 0o600 });
    return file;
  }

}
