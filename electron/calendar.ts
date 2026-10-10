import http from 'node:http';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Metadata } from './lessons';
import { nextDate, validDate, type CalendarStatus } from '../src/lesson';
const scope = 'https://www.googleapis.com/auth/calendar.events';
const clientSchema = z.object({ clientId: z.string().trim().regex(/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/, 'Use a Google OAuth Desktop app client ID.'),
  clientSecret: z.string().trim().min(1).max(512), calendarId: z.string().trim().min(1).max(240).default('primary') });
export type CalendarInput = { clientId: string; clientSecret: string; calendarId?: string };
export class GoogleCalendar {
  private server?: http.Server;
  private timer?: ReturnType<typeof setTimeout>;
  private connecting = false;
  private generation = 0;
  private access?: { token: string; until: number };
  private tokenRequest?: Promise<string>;
  private lastError?: string;
  constructor(private db: Metadata, private encrypt: (value: string) => string, private decrypt: (value: string) => string,
    private open: (url: string) => Promise<void>, private fetcher: typeof fetch = fetch) {}
  status(): CalendarStatus & { error?: string } {
    return { configured: Boolean(this.db.getMetadata('google:client-id') && this.db.getMetadata('google:client-secret')),
      connected: Boolean(this.db.getMetadata('google:refresh')), connecting: this.connecting,
      calendarId: this.db.getMetadata('google:calendar-id') || 'primary', error: this.lastError };
  }
  configure(raw: CalendarInput) {
    const data = clientSchema.parse(raw); this.stop(); this.generation++;
    this.db.setMetadata('google:client-id', data.clientId); this.db.setMetadata('google:client-secret', this.encrypt(data.clientSecret));
    this.db.setMetadata('google:calendar-id', data.calendarId); this.db.setMetadata('google:refresh', '');
    this.access = undefined; this.lastError = undefined; return this.status();
  }
  stop() { this.server?.close(); this.server = undefined; if (this.timer) clearTimeout(this.timer); this.timer = undefined; this.connecting = false; }
  async disconnect() {
    const encrypted = this.db.getMetadata('google:refresh'); this.stop(); this.generation++;
    this.db.setMetadata('google:refresh', ''); this.access = undefined; this.lastError = undefined;
    if (encrypted) {
      try { await this.fetcher('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: this.decrypt(encrypted) }), signal: AbortSignal.timeout(8000) }); } catch { /* Local removal always succeeds. */ }
    }
    return this.status();
  }
  async connect() {
    if (!this.status().configured) throw new Error('Configure a Google OAuth Desktop app client first.');
    if (this.connecting) return this.status();
    const generation = ++this.generation;
    const state = crypto.randomBytes(32).toString('hex'), verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    this.lastError = undefined; this.connecting = true;
    let redirect = '', handling = false;
    this.server = http.createServer(async (request, response) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname !== '/oauth/callback' || url.searchParams.get('state') !== state) { response.writeHead(400); response.end('Invalid OAuth callback.'); return; }
      if (generation !== this.generation) { response.writeHead(400); response.end('This connection attempt expired.'); return; }
      if (handling) { response.writeHead(409); response.end('This callback is already being handled.'); return; }
      handling = true;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.setHeader('Cache-Control', 'no-store');
      try {
        if (url.searchParams.get('error')) throw new Error('Google sign-in was declined.');
        const code = url.searchParams.get('code'); if (!code) throw new Error('Google did not return an authorisation code.');
        const tokens = await this.exchange({ code, redirect_uri: redirect, code_verifier: verifier, grant_type: 'authorization_code' });
        if (generation !== this.generation || !this.connecting) throw new Error('Connection attempt expired. Please reconnect.');
        if (!tokens.refresh_token) throw new Error('Google did not grant offline access. Reconnect and allow Calendar access.');
        this.db.setMetadata('google:refresh', this.encrypt(tokens.refresh_token));
        this.access = { token: tokens.access_token, until: Date.now() + (tokens.expires_in - 60) * 1000 };
        response.end('Google Calendar connected to SchoolWork. You can close this window.');
      } catch (error) { this.lastError = error instanceof Error ? error.message : 'Google connection failed.'; response.writeHead(400); response.end('Connection failed. Return to SchoolWork for details.'); }
      finally { this.stop(); }
    });
    try {
      await new Promise<void>((resolve, reject) => { this.server!.once('error', reject); this.server!.listen(0, '127.0.0.1', resolve); });
      const address = this.server.address(); if (!address || typeof address === 'string') throw new Error('Could not start Google sign-in callback.');
      redirect = `http://127.0.0.1:${address.port}/oauth/callback`;
      const params = new URLSearchParams({ client_id: this.db.getMetadata('google:client-id')!, redirect_uri: redirect, response_type: 'code', scope,
        state, code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' });
      this.timer = setTimeout(() => { this.lastError = 'Google sign-in timed out. Try connecting again.'; this.stop(); }, 180_000); this.timer.unref();
      await this.open('https://accounts.google.com/o/oauth2/v2/auth?' + params); return this.status();
    } catch (error) { this.stop(); throw error; }
  }
  private async exchange(params: Record<string, string>) {
    const generation = this.generation;
    const response = await this.fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, client_id: this.db.getMetadata('google:client-id')!, client_secret: this.decrypt(this.db.getMetadata('google:client-secret')!) }), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) { if (response.status === 400 && params.grant_type === 'refresh_token' && generation === this.generation) { this.db.setMetadata('google:refresh', ''); this.access = undefined; }
      throw new Error(`Google authorisation failed (HTTP ${response.status}). Reconnect your account.`); }
    const tokens = z.object({ access_token: z.string().min(1), expires_in: z.number().positive(), refresh_token: z.string().optional(), scope: z.string().optional() }).parse(await response.json());
    if (tokens.scope && !tokens.scope.split(' ').includes(scope)) throw new Error('Google Calendar permission was not granted.');
    return tokens;
  }
  private async token(): Promise<string> {
    if (this.access && this.access.until > Date.now()) return this.access.token;
    if (this.tokenRequest) return this.tokenRequest;
    const refresh = this.db.getMetadata('google:refresh'); if (!refresh) throw new Error('Connect Google Calendar first.');
    const generation = this.generation;
    this.tokenRequest = this.exchange({ refresh_token: this.decrypt(refresh), grant_type: 'refresh_token' }).then(tokens => {
      if (generation !== this.generation) throw new Error('Google account changed. Try again.');
      this.access = { token: tokens.access_token, until: Date.now() + (tokens.expires_in - 60) * 1000 }; return tokens.access_token;
    }).finally(() => { this.tokenRequest = undefined; });
    return this.tokenRequest;
  }
  async add(input: { sessionId: string; taskId: string; title: string; date: string; details: string }) {
    if (!validDate(input.date)) throw new Error('Choose a valid assignment date.');
    const id = 'sw' + crypto.createHash('sha256').update(input.sessionId + ':' + input.taskId).digest('hex');
    const base = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(this.status().calendarId) + '/events';
    const event = { id, summary: input.title, description: input.details, start: { date: input.date }, end: { date: nextDate(input.date) } };
    const generation = this.generation;
    const request = async (retry = true): Promise<Response> => {
      const response = await this.fetcher(base, { method: 'POST', headers: { Authorization: 'Bearer ' + await this.token(), 'Content-Type': 'application/json' }, body: JSON.stringify(event), signal: AbortSignal.timeout(20_000) });
      if (response.status === 401 && retry) { this.access = undefined; return request(false); } return response;
    };
    let response = await request();
    if (generation !== this.generation) throw new Error('Google account changed during the request. Reconnect and retry.');
    if (response.status === 409) response = await this.fetcher(base + '/' + id, { headers: { Authorization: 'Bearer ' + await this.token() }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Google Calendar could not save the assignment (HTTP ${response.status}).`);
    const saved = z.object({ id: z.string(), htmlLink: z.string().optional() }).parse(await response.json());
    if (saved.id !== id) throw new Error('Google returned an unexpected event identifier.');
    return saved;
  }
}
