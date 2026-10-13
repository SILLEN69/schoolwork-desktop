import { z } from 'zod';

const origin = 'https://teachgpt.ssis.nu';
export const liveSpeechModel = z.enum(['kb-whisper-large', 'faster-whisper-large-v3']);
const iceServerSchema = z.object({
  urls: z.union([z.string().max(1024), z.array(z.string().max(1024)).max(8)]),
  username: z.string().max(1024).optional(), credential: z.string().max(4096).optional(),
}).refine(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).every(url => /^turns?:|^stuns?:/.test(url)));
export type LiveConfiguration = { model: string; iceServers: z.infer<typeof iceServerSchema>[] };
type Bootstrap = LiveConfiguration & { csrf: string };
function decodeHtml(value: string) {
  return value.replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&quot;': '"', '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>' };
    if (named[entity]) return named[entity];
    const number = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
}
function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(["\x27])([\\s\\S]*?)\\1', 'i'));
  return match ? decodeHtml(match[2]) : '';
}
function unwrap(value: any, depth = 0): any {
  if (depth > 12) throw new Error('TeachGPT returned an invalid live configuration.');
  if (Array.isArray(value) && value.length === 2 && value[1]?.s) return unwrap(value[0], depth + 1);
  if (Array.isArray(value)) return value.map(item => unwrap(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrap(item, depth + 1)]));
  return value;
}
/** Read JSON data, never execute Alpine expressions or remote page scripts. */
export function parseLiveBootstrap(html: string, modelGroup: string): Bootstrap {
  if (html.length > 2_000_000) throw new Error('TeachGPT returned an oversized live configuration.');
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].find(match => attribute(match[0], 'name') === 'csrf-token');
  const csrf = meta ? attribute(meta[0], 'content') : '';
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(csrf)) throw new Error('TeachGPT did not return a live session token. Check your API key.');
  for (const match of html.matchAll(/\bwire:snapshot\s*=\s*(["'])([\s\S]*?)\1/g)) {
    let snapshot: any;
    try { snapshot = JSON.parse(decodeHtml(match[2])); } catch { continue; }
    if (snapshot?.memo?.name !== 'live-transcriptions') continue;
    if (snapshot.data?.enabled !== true) throw new Error('TeachGPT live transcription is currently unavailable for this account.');
    const models = unwrap(snapshot.data.speachesModels);
    const model = z.string().min(1).max(255).safeParse(models?.[modelGroup]);
    if (!model.success) throw new Error('TeachGPT does not offer this speech model for live transcription.');
    const iceServers = z.array(iceServerSchema).max(8).parse(unwrap(snapshot.data.iceServers) || []);
    return { csrf, model: model.data, iceServers };
  }
  throw new Error('TeachGPT did not return its live transcription configuration. Check your account access.');
}

type Context = { controller: AbortController; credential: string; modelGroup: string; cookies: Map<string, string>; bootstrap?: Bootstrap; createdAt: number };
/** The existing web relay also accepts Sanctum API tokens. Keep its short-lived
 * CSRF cookie pair in this process; no browser login or password is required. */
export class TeachGptLiveTranscription {
  private contexts = new Map<string, Context>();
  constructor(private key: () => string, private fetcher: typeof fetch = fetch) {}
  private headers(context: Context, accept: string) {
    return { Authorization: 'Bearer ' + context.credential, Accept: accept,
      ...(context.cookies.size ? { Cookie: [...context.cookies].map(([name, value]) => name + '=' + value).join('; ') } : {}) };
  }
  private rememberCookies(context: Context, response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0], at = pair.indexOf('=');
      if (at > 0 && pair.length < 16_384 && context.cookies.size < 16) context.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
  }
  private async bootstrap(context: Context) {
    const response = await this.fetcher(origin + '/audio', { headers: this.headers(context, 'text/html'),
      redirect: 'error', signal: AbortSignal.any([context.controller.signal, AbortSignal.timeout(20_000)]) });
    this.rememberCookies(context, response);
    if (!response.ok) throw new Error(`TeachGPT refused live configuration (HTTP ${response.status}). Check your API key and account access.`);
    context.bootstrap = parseLiveBootstrap(await response.text(), context.modelGroup);
    return context.bootstrap;
  }
  async prepare(id: string, modelGroup: string): Promise<LiveConfiguration> {
    liveSpeechModel.parse(modelGroup);
    this.cancel(id);
    const credential = this.key();
    if (!credential) throw new Error('Configure your TeachGPT API key in Settings first.');
    for (const [oldId, context] of this.contexts) if (Date.now() - context.createdAt > 120_000) this.cancel(oldId);
    if (this.contexts.size >= 4) throw new Error('Too many live transcription connections are starting. Stop and retry.');
    const context: Context = { controller: new AbortController(), credential, modelGroup, cookies: new Map(), createdAt: Date.now() };
    this.contexts.set(id, context);
    try {
      const { model, iceServers } = await this.bootstrap(context);
      context.controller.signal.throwIfAborted();
      return { model, iceServers };
    } catch (error) { this.cancel(id); throw error; }
  }
  async signal(id: string, sdp: string): Promise<string> {
    const context = this.contexts.get(id);
    if (!context?.bootstrap) throw new Error('The live transcription connection was stopped. Start recording again.');
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const bootstrap = context.bootstrap!;
        const response = await this.fetcher(origin + '/audio/live/signal?model=' + encodeURIComponent(bootstrap.model), {
          method: 'POST', headers: { ...this.headers(context, 'application/json'), 'Content-Type': 'application/sdp',
            'X-CSRF-TOKEN': bootstrap.csrf, Origin: origin }, body: sdp, redirect: 'error',
          signal: AbortSignal.any([context.controller.signal, AbortSignal.timeout(60_000)]),
        });
        this.rememberCookies(context, response);
        if (response.status === 419 && attempt === 0) { await this.bootstrap(context); continue; }
        if (!response.ok) throw new Error(`TeachGPT live transcription could not connect (HTTP ${response.status}). Recorded audio remains available for standard transcription.`);
        const answer = await response.text();
        if (answer.length > 100_000 || !answer.startsWith('v=0') || !/\nm=audio\s/.test(answer)) throw new Error('TeachGPT returned an invalid live SDP answer. Standard transcription continues.');
        context.controller.signal.throwIfAborted();
        return answer;
      }
      throw new Error('TeachGPT live session expired. Start recording again.');
    } finally { this.cancel(id); }
  }
  cancel(id: string) {
    const context = this.contexts.get(id);
    if (context) { context.controller.abort(); context.cookies.clear(); context.credential = ''; this.contexts.delete(id); }
  }
  stop() { for (const id of this.contexts.keys()) this.cancel(id); }
}
