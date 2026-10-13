import { it, expect, vi } from 'vitest';
import { TeachGptLiveTranscription, parseLiveBootstrap } from './liveTranscription';

const csrf = 'synthetic-csrf-token-0123456789';
const html = (enabled = true) => `<meta content="${csrf}" name="csrf-token"><div wire:snapshot='${JSON.stringify({
  memo: { name: 'live-transcriptions' }, data: { enabled,
    speachesModels: [{ 'kb-whisper-large': 'KBLab/kb-whisper-large' }, { s: 'arr' }],
    iceServers: [[[{ urls: [['stun:school.example:3478'], { s: 'arr' }] }, { s: 'arr' }], [{ urls: [['turn:school.example:3478'], { s: 'arr' }], username: 'temporary', credential: 'temporary' }, { s: 'arr' }]], { s: 'arr' }],
  },
})}'></div>`;
const answer = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
const page = () => new Response(html(), { headers: { 'Set-Cookie': 'school_session=test-cookie; HttpOnly; Secure; Path=/' } });

it('resolves the real ASR id and relay configuration from JSON without running page scripts', () => {
  const result = parseLiveBootstrap(html(), 'kb-whisper-large');
  expect(result.model).toBe('KBLab/kb-whisper-large');
  expect(result.iceServers).toHaveLength(2);
  expect(result.csrf).toBe(csrf);
  expect(() => parseLiveBootstrap(html(false), 'kb-whisper-large')).toThrow(/currently unavailable/);
  expect(() => parseLiveBootstrap(html(), 'unavailable')).toThrow(/does not offer/);
});

it('uses the existing token-authenticated relay with its paired cookie and CSRF, never the rejected proxy route', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return calls.length === 1 ? page() : new Response(answer);
  }) as typeof fetch;
  const client = new TeachGptLiveTranscription(() => 'synthetic-api-key', fetcher);
  expect(await client.prepare('test', 'kb-whisper-large')).toEqual({ model: 'KBLab/kb-whisper-large', iceServers: parseLiveBootstrap(html(), 'kb-whisper-large').iceServers });
  expect(await client.signal('test', 'offer')).toBe(answer);
  expect(calls.map(call => call.url)).toEqual(['https://teachgpt.ssis.nu/audio', 'https://teachgpt.ssis.nu/audio/live/signal?model=KBLab%2Fkb-whisper-large']);
  expect(calls[1].init.headers).toMatchObject({ Authorization: 'Bearer synthetic-api-key', Cookie: 'school_session=test-cookie', 'X-CSRF-TOKEN': csrf, 'Content-Type': 'application/sdp' });
  await expect(client.signal('test', 'offer')).rejects.toThrow(/stopped/);
});

it('refreshes expired CSRF once and retries only the rejected signalling request', async () => {
  const calls: string[] = [];
  const fetcher = vi.fn(async (url: unknown) => {
    calls.push(String(url));
    return calls.length === 2 ? new Response('', { status: 419 }) : String(url).endsWith('/audio') ? page() : new Response(answer);
  }) as typeof fetch;
  const client = new TeachGptLiveTranscription(() => 'synthetic-api-key', fetcher);
  await client.prepare('test', 'kb-whisper-large');
  await expect(client.signal('test', 'offer')).resolves.toBe(answer);
  expect(calls).toHaveLength(4);
});

it('does not mislabel a permission denial as a missing API or expose response bodies', async () => {
  const fetcher = vi.fn(async (url: unknown) => String(url).endsWith('/audio') ? page() : new Response('sensitive server body', { status: 403 })) as typeof fetch;
  const client = new TeachGptLiveTranscription(() => 'synthetic-api-key', fetcher);
  await client.prepare('test', 'kb-whisper-large');
  await expect(client.signal('test', 'offer')).rejects.toThrow('TeachGPT live transcription could not connect (HTTP 403).');
  expect(() => parseLiveBootstrap('<script>arbitraryCode()</script>', 'kb-whisper-large')).toThrow(/session token/);
});

it('cancels pending bootstrap HTTP requests and cannot resurrect a stopped session', async () => {
  let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    entered(); init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
  })) as typeof fetch;
  const client = new TeachGptLiveTranscription(() => 'synthetic-api-key', fetcher);
  const request = client.prepare('test', 'kb-whisper-large');
  const checked = expect(request).rejects.toThrow();
  await ready; client.cancel('test'); await checked;
  await expect(client.signal('test', 'offer')).rejects.toThrow(/stopped/);
});
