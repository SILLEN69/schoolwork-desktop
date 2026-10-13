import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import type { SchoolWorkStore } from './storage';
import { parseReceiverPage, normalizeReceiverUrl, type BoardStatus, type YeetCastState } from '../src/yeetcast';

/** View-only board viewer for the school's YeetCast projector pages
 *  (yeet.ssis.nu). The projector page is public; we read it, extract the
 *  read-only vdo.ninja "view" URL of the active cast and show it in a
 *  small floating window. We never create senders or connections, so the
 *  cast is not disturbed. */



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
  constructor(
    private store: SchoolWorkStore,
    private root: string,
    private fetcher: typeof fetch = fetch,
  ) {}

  get receiverUrl(): string {
    return this.store.getMetadata('board:receiverUrl') || '';
  }

  configure(raw: string): string {
    const url = normalizeReceiverUrl(raw);
    this.store.setMetadata('board:receiverUrl', url);
    this.state = null;
    this.currentView = '';
    return url;
  }

  status(): BoardStatus {
    return {
      configured: Boolean(this.receiverUrl),
      receiverUrl: this.receiverUrl,
      active: this.state?.active === true,
      connections: this.state?.connections === true,
      senders: this.state?.senders || [],
      viewUrl: this.state?.receiverUri || null,
      windowOpen: Boolean(this.win && !this.win.isDestroyed()),
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
    if (this.refreshing) {
      await this.refreshing;
      return this.status();
    }
    this.refreshing = (async () => {
      try {
        const response = await this.fetcher(url, {
          headers: { Accept: 'text/html' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`The projector page answered HTTP ${response.status}.`);
        const html = await response.text();
        const parsed = parseReceiverPage(html);
        this.lastError = parsed ? undefined : 'The page does not look like a YeetCast projector page. Check the URL.';
        if (parsed) this.adopt(parsed);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Could not reach the projector page.';
      } finally {
        this.lastChecked = Date.now();
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
    this.currentView = parsed.receiverUri;
    if (changed && this.win && !this.win.isDestroyed() && this.win.webContents.getURL() !== parsed.receiverUri) {
      void this.win.webContents.loadURL(parsed.receiverUri).catch(() => {});
    }
  }

  /** Open the floating board window on the active cast's read-only view. */
  async open(): Promise<BoardStatus> {
    const status = (await this.refresh()) as BoardStatus;
    if (!status.viewUrl) {
      throw new Error(
        status.configured
          ? 'No cast is running on that projector right now. Try again when someone starts presenting.'
          : 'Set the projector page URL first, for example https://yeet.ssis.nu/receiver/abc123.',
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
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      this.win.setMenuBarVisibility(false);
      this.win.on('closed', () => {
        this.win = null;
        this.stopPolling();
      });
    }
    if (this.win.webContents.getURL() !== status.viewUrl) await this.win.webContents.loadURL(status.viewUrl).catch(() => {});
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
    if (!this.win || this.win.isDestroyed() || this.win.isMinimized()) return null;
    if (this.win.webContents.getURL() !== this.currentView) return null;
    const image = await this.win.webContents.capturePage();
    if (image.isEmpty()) return null;
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const file = path.join(this.root, 'board-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.jpg');
    await fs.writeFile(file, image.toJPEG(78), { mode: 0o600 });
    return file;
  }

}
