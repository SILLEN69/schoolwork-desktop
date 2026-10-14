/** YeetCast codes identify a receiver through its official signed-in join flow.
 * Receiver pages and VDO view streams are read-only. Never treat a PIN as an ID. */
export const yeetCastOrigin = 'https://yeet.ssis.nu';
export type YeetCastSenders = { name: string; sending: boolean }[];
export type YeetCastState = { receiverUri: string; active: boolean; connections: boolean; senders: YeetCastSenders };
export type BoardStatus = {
  configured: boolean; receiverUrl: string; active: boolean; connections: boolean;
  senders: YeetCastSenders; viewUrl: string | null; windowOpen: boolean; lastChecked: number; error?: string; diagnosticsAvailable?: boolean;
};
export function projectorCode(raw: string): string | null {
  const value = raw.trim().replace(/[\s-]/g, '');
  return /^\d{6}$/.test(value) ? value : null;
}
/** Retain existing saved links; new users enter a code instead. */
export function normalizeReceiverUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error('Enter the six-digit code shown on the projector.'); }
  if (url.origin !== yeetCastOrigin || url.username || url.password || !/^\/receiver\/[1-9]\d*\/?$/.test(url.pathname))
    throw new Error('Use the six-digit projector code or a YeetCast receiver link.');
  return yeetCastOrigin + url.pathname.replace(/\/$/, '');
}
function decodeHtml(value: string) {
  return value.replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&quot;': '"', '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>' };
    if (named[entity]) return named[entity];
    const number = entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
}
function unwrap(value: any, depth = 0): any {
  if (depth > 12) throw new Error('Invalid projector state.');
  if (Array.isArray(value) && value.length === 2 && typeof value[1]?.s === 'string') return unwrap(value[0], depth + 1);
  if (Array.isArray(value)) return value.map(item => unwrap(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrap(item, depth + 1)]));
  return value;
}
/** Permit view streams only, never a sender/push URL or executable protocol. */
export function readOnlyViewUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '';
  try {
    const url = new URL(decodeHtml(raw));
    if (url.protocol !== 'https:' || url.username || url.password || url.searchParams.has('push') || url.searchParams.has('room') || url.searchParams.has('director')) return '';
    if (!/^[a-z\d_-]+(?:,[a-z\d_-]+)*$/i.test(url.searchParams.get('view') || '')) return '';
    return url.toString();
  } catch { return ''; }
}
/** Parse actual Livewire attributes, JSON scripts and nested collection tuples. */
export function parseReceiverPage(html: string): YeetCastState | null {
  if (html.length > 2_000_000) return null;
  const candidates = [...html.matchAll(/<script\b[^>]*data-wire:snapshot[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  for (const match of html.matchAll(/\bwire:snapshot\s*=\s*(["'])([\s\S]*?)\1/g)) {
    const decoded = decodeHtml(match[2]);
    candidates.push(decoded);
    try { candidates.push(decodeURIComponent(decoded)); } catch { /* Plain JSON. */ }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate); const snapshot = parsed.snapshot ?? parsed;
      const data = unwrap(snapshot.data);
      if (!data || (snapshot.memo?.name !== 'receiver-screen' && typeof data.receiverUri !== 'string')) continue;
      const senders: YeetCastSenders = Array.isArray(data.senders) ? data.senders
        .filter((s: any) => s && typeof s.name === 'string')
        .map((s: any) => ({ name: s.name.slice(0, 200), sending: s.sending === true })) : [];
      const receiverUri = readOnlyViewUrl(data.receiverUri);
      if (data.active === true && !receiverUri) return null;
      return { receiverUri, active: data.active === true, connections: data.connections === true || senders.some(s => s.sending), senders };
    } catch { /* Another component or malformed snapshot. */ }
  }
  const iframe = /<iframe\b[^>]*\bsrc\s*=\s*(["'])([\s\S]*?)\1/i.exec(html);
  const receiverUri = iframe ? readOnlyViewUrl(iframe[2]) : '';
  return receiverUri ? { receiverUri, active: true, connections: true, senders: [] } : null;
}
export function viewId(raw: string): string {
  try { return new URL(raw).searchParams.get('view') || ''; } catch { return ''; }
}
