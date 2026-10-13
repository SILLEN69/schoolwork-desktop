import { it, expect } from 'vitest';
import { decodeLiveEnvelopeData, feedLiveEnvelope, startLiveTranscription, type LiveEnvelope } from './liveTranscription';

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

it('decodes base64 envelope payloads', () => {
  expect(decodeLiveEnvelopeData(b64('hej världen'))).toBe('hej världen');
  expect(decodeLiveEnvelopeData(b64(JSON.stringify({ type: 'x' })))).toBe('{"type":"x"}');
});

it('passes full messages through as-is', () => {
  const buffers = new Map();
  const envelope: LiveEnvelope = { type: 'full_message', id: '1', data: b64('hello') };
  expect(feedLiveEnvelope(buffers, envelope)).toBe(b64('hello'));
});

it('reassembles partial fragments in order, even when they arrive shuffled', () => {
  const buffers = new Map();
  const total = 3, id = 'm-1';
  const parts = [b64('a'), b64('b'), b64('c')];
  expect(feedLiveEnvelope(buffers, { type: 'partial_message', id, total_fragments: total, fragment_index: 2, data: parts[2] })).toBeNull();
  expect(feedLiveEnvelope(buffers, { type: 'partial_message', id, total_fragments: total, fragment_index: 0, data: parts[0] })).toBeNull();
  expect(feedLiveEnvelope(buffers, { type: 'partial_message', id, total_fragments: total, fragment_index: 1, data: parts[1] })).toBe(parts.join(''));
  // The buffer is consumed once complete.
  expect(buffers.has(id)).toBe(false);
});

it('ignores envelopes that carry no payload', () => {
  const buffers = new Map();
  expect(feedLiveEnvelope(buffers, { type: 'unknown' })).toBeNull();
  expect(feedLiveEnvelope(buffers, { type: 'full_message' })).toBeNull();
});

it('reports unsupported when WebRTC is unavailable', async () => {
  const errors: string[] = [];
  const session = startLiveTranscription({
    stream: {} as MediaStream,
    signal: async () => '',
    model: 'kb-whisper-large',
    onError: code => { errors.push(code); },
  });
  expect(errors).toContain('unsupported');
  await expect(session.stop()).resolves.toBeUndefined();
});
