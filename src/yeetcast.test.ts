import { it, expect } from 'vitest';
import { normalizeReceiverUrl, parseReceiverPage, viewId } from './yeetcast';

it('normalizes projector page URLs', () => {
  expect(normalizeReceiverUrl('https://yeet.ssis.nu/receiver/abc123')).toBe('https://yeet.ssis.nu/receiver/abc123');
  expect(normalizeReceiverUrl('  https://yeet.ssis.nu/receiver/abc123/  ')).toBe('https://yeet.ssis.nu/receiver/abc123');
  expect(() => normalizeReceiverUrl('')).toThrow(/projector page URL/i);
  expect(() => normalizeReceiverUrl('not a url')).toThrow(/URL/i);
  expect(() => normalizeReceiverUrl('ftp://yeet.ssis.nu/receiver/x')).toThrow(/http/i);
});

const v3Page = (data: Record<string, unknown>) => `<!doctype html><html><body>
<script type="text/json" data-wire:snapshot>${JSON.stringify({ snapshot: { data } })}</script>
</body></html>`;

it('reads the live cast state from a Livewire v3 receiver page', () => {
  const state = parseReceiverPage(v3Page({
    receiverUri: 'https://vdo.ninja/?cleanoutput&view=0a1b2c,3d4e5f',
    active: true,
    connections: true,
    senders: [{ name: 'Lars', uuid: 'x', sending: true }, { name: 'Elin', uuid: 'y', sending: false }],
  }));
  expect(state).not.toBeNull();
  expect(state!.receiverUri).toBe('https://vdo.ninja/?cleanoutput&view=0a1b2c,3d4e5f');
  expect(state!.active).toBe(true);
  expect(state!.connections).toBe(true);
  expect(state!.senders).toEqual([{ name: 'Lars', sending: true }, { name: 'Elin', sending: false }]);
});

it('treats a page without a receiver URI as not a receiver page', () => {
  expect(parseReceiverPage(v3Page({ title: 'hello' }))).toBeNull();
  expect(parseReceiverPage('<html><body>Just a normal page.</body></html>')).toBeNull();
});

it('falls back to a vdo.ninja view URL rendered in the markup', () => {
  const html = '<html><body><iframe src="https://vdo.ninja/?cleanoutput&amp;view=0a1b2c"></iframe></body></html>';
  const state = parseReceiverPage(html);
  expect(state).not.toBeNull();
  expect(state!.active).toBe(true);
  expect(state!.receiverUri).toContain('view=0a1b2c');
});

it('extracts the viewed sender ids from a view URL', () => {
  expect(viewId('https://vdo.ninja/?cleanoutput&view=0a1b2c,3d4e5f&vb=12000')).toBe('0a1b2c,3d4e5f');
  expect(viewId('https://vdo.ninja/?cleanoutput')).toBe('');
});
