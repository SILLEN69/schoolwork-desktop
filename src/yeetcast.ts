/** Pure helpers for the YeetCast (yeet.ssis.nu) board viewer.
 *  The projector page is public: it embeds a read-only vdo.ninja
 *  "view" URL in the ReceiverScreen Livewire component state. We only
 *  ever read that page and open the view URL — no casting, no
 *  connections are created on the YeetCast server. */

export type YeetCastSenders = { name: string; sending: boolean }[];
export type YeetCastState = {
  receiverUri: string;
  active: boolean;
  connections: boolean;
  senders: YeetCastSenders;
};

/** What the board viewer reports to the UI. */
export type BoardStatus = {
  configured: boolean;
  receiverUrl: string;
  active: boolean;
  connections: boolean;
  senders: YeetCastSenders;
  viewUrl: string | null;
  windowOpen: boolean;
  lastChecked: number;
  error?: string;
};

/** Accepts a full projector URL or bare text and returns a normalized http(s) URL. */
export function normalizeReceiverUrl(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error('Enter the projector page URL, for example https://yeet.ssis.nu/receiver/abc123.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('That does not look like a URL. Use the projector page address, for example https://yeet.ssis.nu/receiver/abc123.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Use an http or https projector page URL.');
  return url.toString().replace(/\/$/, '');
}

/** Extracts the live-cast state from a YeetCast receiver page.
 *  Livewire v3 stores the component state in a
 *  `<script type="text/json" data-wire:snapshot>` tag; v2 used a
 *  URL-encoded `wire:snapshot` attribute. Returns null when the page
 *  does not look like a YeetCast receiver page. */
export function parseReceiverPage(html: string): YeetCastState | null {
  const candidates: string[] = [];
  const scriptRe = /<script[^>]*data-wire:snapshot[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) candidates.push(match[1]);
  if (!candidates.length) {
    const attrRe = /wire:snapshot="([^"]+)"/i;
    match = attrRe.exec(html);
    if (match) {
      try {
        candidates.push(decodeURIComponent(match[1]));
      } catch {
        candidates.push(match[1]);
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const json = JSON.parse(candidate);
      const data = json?.snapshot?.data ?? json?.data;
      if (!data || typeof data !== 'object') continue;
      if (typeof data.receiverUri !== 'string' || !data.receiverUri) continue;
      const senders: YeetCastSenders = Array.isArray(data.senders)
        ? data.senders.map((s: any) => ({ name: String(s?.name || 'Sender'), sending: s?.sending === true }))
        : [];
      return {
        receiverUri: data.receiverUri,
        active: data.active === true,
        connections: data.connections === true || senders.some((s) => s.sending),
        senders,
      };
    } catch {
      // Not JSON or the wrong component: keep looking.
    }
  }
  // Last resort: a vdo.ninja view URL rendered somewhere in the markup.
  const direct =
    html.match(/https?:\/\/[^"'\\\s]+vdo\.ninja[^"'\\\s]*?view=[0-9a-fA-F,]+[^"'\\\s]*/) ||
    html.match(/https?:\/\/[^"'\\\s]+\/\?cleanoutput[^"'\\\s]*/);
  if (direct)
    return { receiverUri: direct[0].replace(/&amp;/g, '&'), active: true, connections: true, senders: [] };
  return null;
}

/** The part of a vdo.ninja view URL that identifies the viewed senders. */
export function viewId(url: string): string {
  const match = /view=([^&]+)/.exec(url);
  return match ? match[1] : '';
}
