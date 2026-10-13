import { it, expect, vi } from 'vitest';
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

it('does not count duplicate fragments as completed speech', () => {
  const buffers = new Map();
  const fragment = { type: 'partial_message', id: 'dup', total_fragments: 2, fragment_index: 0, data: 'first' };
  expect(feedLiveEnvelope(buffers, fragment)).toBeNull();
  expect(feedLiveEnvelope(buffers, fragment)).toBeNull();
  expect(feedLiveEnvelope(buffers, { ...fragment, fragment_index: 1, data: 'second' })).toBe('firstsecond');
  expect(feedLiveEnvelope(buffers, { ...fragment, total_fragments: 999 })).toBeNull();
});

it('a rejected live relay closes WebRTC but leaves the recorder microphone running', async () => {
  const track = { stop: vi.fn() }, close = vi.fn(), cancel = vi.fn();
  const channel = { close: vi.fn(), send: vi.fn() };
  class Peer {
    iceGatheringState = 'complete';
    localDescription = { sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };
    addTrack = vi.fn(); createDataChannel = () => channel;
    createOffer = async () => this.localDescription;
    setLocalDescription = async () => {};
    close = close;
  }
  vi.stubGlobal('window', { RTCPeerConnection: Peer }); vi.stubGlobal('RTCPeerConnection', Peer);
  try {
    const errors: string[] = [];
    const session = startLiveTranscription({ stream: { getAudioTracks: () => [track] } as unknown as MediaStream,
      model: 'kb-whisper-large', prepare: async () => ({ model: 'KBLab/kb-whisper-large', iceServers: [] }),
      signal: async () => { throw new Error('Relay unavailable'); }, onError: code => errors.push(code), onStop: cancel });
    await vi.waitFor(() => expect(errors).toEqual(['signal']));
    expect(close).toHaveBeenCalledTimes(1); expect(track.stop).not.toHaveBeenCalled();
    await session.stop(); expect(cancel).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});

it('stopping while live configuration loads cannot create a late connection', async () => {
  const Peer = vi.fn(), cancel = vi.fn();
  vi.stubGlobal('window', { RTCPeerConnection: Peer }); vi.stubGlobal('RTCPeerConnection', Peer);
  try {
    let finish!: (value: {model:string;iceServers:RTCIceServer[]}) => void;
    const prepared = new Promise<{model:string;iceServers:RTCIceServer[]}>(resolve => { finish = resolve; });
    const signal = vi.fn();
    const session = startLiveTranscription({ stream: {} as MediaStream, model: 'kb-whisper-large', prepare: () => prepared, signal, onStop: cancel });
    await session.stop(); finish({ model: 'KBLab/kb-whisper-large', iceServers: [] });
    await Promise.resolve(); expect(Peer).not.toHaveBeenCalled(); expect(signal).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); }
});
