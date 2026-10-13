// Live (real-time) transcription against the school's Speaches server
// ("OpenAI Realtime API compatible"). The microphone audio flows straight
// to the speech server over WebRTC; the only HTTP request is the one-shot
// SDP offer, which the caller relays (through the TeachGPT API key) and
// hands the SDP answer back through `signal`.
//
// Wire protocol (verified against teachgpt.ssis.nu's own client):
//   * data channel named "oai-events"
//   * we send plain OpenAI realtime event JSON (`session.update`)
//   * the server wraps every event in an envelope: a `full_message` whose
//     `data` holds the base64-encoded event, or several `partial_message`
//     fragments (ordered by `fragment_index`) that must be reassembled
//     before decoding
//   * finalized speech arrives as
//     `conversation.item.input_audio_transcription.completed` + `transcript`

export const LIVE_DATA_CHANNEL = 'oai-events';

// Mirrors the school client: server VAD with create_response disabled.
// prefix_padding_ms is required by the server's session model even though
// it is never applied; the server answers session.update with an
// informational "prefix_padding_ms is not supported" error that we ignore.
export const LIVE_TURN_DETECTION = {
  type: 'server_vad',
  threshold: 0.9,
  silence_duration_ms: 500,
  prefix_padding_ms: 0,
  create_response: false,
} as const;

export type LiveEnvelope = {
  type?: string;
  id?: string;
  data?: string;
  fragment_index?: number;
  total_fragments?: number;
};

export function decodeLiveEnvelopeData(encoded: string): string {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export type LiveFragmentBuffer = { total: number; received: number; parts: (string | undefined)[] };

/** Feeds one envelope into the fragment buffers; returns the reassembled
 *  base64 payload when a complete message is ready, else null. */
export function feedLiveEnvelope(
  buffers: Map<string, LiveFragmentBuffer>,
  envelope: LiveEnvelope,
): string | null {
  if (envelope.type === 'full_message') return envelope.data || null;
  if (envelope.type !== 'partial_message' || !envelope.id) return null;
  let buffer = buffers.get(envelope.id);
  if (!buffer) {
    buffer = { total: Number(envelope.total_fragments || 0), received: 0, parts: [] };
    buffers.set(envelope.id, buffer);
  }
  if (typeof envelope.fragment_index === 'number' && envelope.fragment_index >= 0 && envelope.fragment_index < 512) {
    buffer.parts[envelope.fragment_index] = envelope.data || '';
    buffer.received += 1;
  }
  if (buffer.total > 0 && buffer.received >= buffer.total) {
    buffers.delete(envelope.id);
    return buffer.parts.join('');
  }
  return null;
}

export type LiveSessionOptions = {
  /** The microphone stream (shares its audio track with the local recorder). */
  stream: MediaStream;
  /** Relay the SDP offer; resolve with the SDP answer text. */
  signal: (sdpOffer: string) => Promise<string>;
  /** The speech model id, e.g. "kb-whisper-large". */
  model: string;
  iceServers?: RTCIceServer[];
  onDelta?: (text: string) => void;
  onStatus?: (status: 'connecting' | 'live') => void;
  onError?: (code: string, message?: string) => void;
};

export type LiveSession = { stop: () => Promise<void> };

export function startLiveTranscription(options: LiveSessionOptions): LiveSession {
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let closed = false;
  let errorReported = false;
  const buffers = new Map<string, LiveFragmentBuffer>();
  const reportError = (code: string, message?: string) => {
    if (errorReported || closed) return;
    errorReported = true;
    options.onError?.(code, message);
  };

  const handleServerEvent = (raw: string) => {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message?.type === 'conversation.item.input_audio_transcription.completed' && message.transcript) {
      options.onDelta?.(String(message.transcript));
      return;
    }
    if (message?.type === 'error' || message?.error) {
      // The expected informational error from session.update; ignore it.
      if (String(message?.error?.message || '').includes('prefix_padding_ms')) return;
      reportError('service');
    }
  };

  const stop: LiveSession['stop'] = () => {
    if (closed) return Promise.resolve();
    closed = true;
    try {
      channel?.close();
    } catch {
      // The channel may already be closed.
    }
    peer?.getSenders().forEach((sender) => sender.track?.stop());
    // Do not stop the shared microphone tracks here; the lesson recorder
    // owns them and may keep recording for the file transcription pipeline.
    return new Promise((resolve) => {
      if (!peer || peer.connectionState === 'closed') {
        peer = null;
        resolve();
        return;
      }
      peer.onconnectionstatechange = () => {
        if (peer!.connectionState === 'closed') {
          peer = null;
          resolve();
        }
      };
      // Safety net: never hold the caller indefinitely.
      setTimeout(resolve, 2000);
    });
  };

  if (typeof window === 'undefined' || typeof window.RTCPeerConnection === 'undefined') {
    reportError('unsupported');
    return { stop };
  }

  void (async () => {
    try {
      const track = options.stream.getAudioTracks()[0];
      if (!track) throw Object.assign(new Error('No microphone track.'), { name: 'NotFoundError' });
      peer = new RTCPeerConnection({ iceServers: options.iceServers || [] });
      peer.addTrack(track, options.stream);
      channel = peer.createDataChannel(LIVE_DATA_CHANNEL);
      channel.onopen = () => {
        options.onStatus?.('live');
        channel?.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text'],
              model: options.model,
              // No language: the server detects it.
              input_audio_transcription: { model: options.model },
              turn_detection: { ...LIVE_TURN_DETECTION },
            },
          }),
        );
      };
      channel.onmessage = (event: MessageEvent) => {
        let envelope: LiveEnvelope;
        try {
          envelope = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const payload = feedLiveEnvelope(buffers, envelope);
        if (payload === null) return;
        try {
          handleServerEvent(decodeLiveEnvelopeData(payload));
        } catch {
          // Ignore undecodable payloads.
        }
      };
      peer.oniceconnectionstatechange = () => {
        if (peer?.iceConnectionState === 'failed') reportError('connection');
      };
      peer.onconnectionstatechange = () => {
        if (peer?.connectionState === 'failed' || peer?.connectionState === 'disconnected') reportError('connection');
      };
      const offer = await peer.createOffer();
      if (closed) throw new Error('stopped');
      await peer.setLocalDescription(offer);
      if (closed) throw new Error('stopped');
      options.onStatus?.('connecting');
      const answer = await options.signal(peer.localDescription!.sdp);
      if (closed) throw new Error('stopped');
      if (!answer || answer.includes('<')) throw new Error('No SDP answer received.');
      await peer.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') reportError('permission');
      else if (name === 'NotFoundError' || name === 'NotReadableError') reportError('no-microphone');
      else if (name === 'InvalidStateError' || (error as Error)?.message === 'stopped') {
        // Normal teardown.
      } else reportError('signal', error instanceof Error ? error.message : undefined);
      if (!closed) void stop();
    }
  })();

  return { stop };
}
