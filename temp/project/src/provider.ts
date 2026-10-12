type RetryOptions = {
  fetcher?: typeof fetch;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
};

export type StreamedToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type StreamMetrics = { requestId?: string; headerMs: number; durationMs: number; chunks: number; bytes: number; finishReason?: string; usage?: unknown; reasoningChars?: number; contentChars?: number; toolChars?: number };
export type StreamedCompletion = { content: string; toolCalls: StreamedToolCall[]; finishReason: string; usage?: unknown; metrics: StreamMetrics };
export type StreamActivity = { kind: 'content' | 'reasoning' | 'tool' | 'chunk'; chunks: number; bytes: number; toolName?: string };

function safeUsage(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const allowed = ['prompt_tokens', 'completion_tokens', 'total_tokens', 'input_tokens', 'output_tokens'];
  const output: Record<string, number> = {};
  for (const key of allowed) {
    const count = (value as Record<string, unknown>)[key];
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) output[key] = count;
  }
  return Object.keys(output).length ? output : undefined;
}

export class ProviderHttpError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfter?: string) { super(message); this.name = 'ProviderHttpError'; }
}
export class IncompleteStreamError extends Error {
  constructor(message: string, readonly metrics: StreamMetrics) { super(message); this.name = 'IncompleteStreamError'; }
}

type StreamConsumeOptions = {
  signal: AbortSignal;
  inactivityTimeoutMs?: number;
  maxDurationMs?: number;
  maxBytes?: number;
  noProgressTimeoutMs?: number;
  onActivity?: (activity: StreamActivity) => void;
};

function timeoutError(label: string): Error { const error = new Error(label); error.name = 'TimeoutError'; return error; }

async function readWithLimits(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal, idleMs: number, deadline: number): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) throw signal.reason || new Error('Request cancelled.');
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw timeoutError('TeachGPT stream exceeded its maximum duration.');
  let idleTimer: ReturnType<typeof setTimeout>;
  let totalTimer: ReturnType<typeof setTimeout>;
  let abortListener: (() => void) | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => { idleTimer = setTimeout(() => reject(timeoutError('TeachGPT stream was idle for too long.')), Math.min(idleMs, remaining)); }),
      new Promise<never>((_, reject) => { totalTimer = setTimeout(() => reject(timeoutError('TeachGPT stream exceeded its maximum duration.')), remaining); }),
      new Promise<never>((_, reject) => { abortListener = () => reject(signal.reason || new Error('Request cancelled.')); signal.addEventListener('abort', abortListener, { once: true }); }),
    ]);
  } finally {
    clearTimeout(idleTimer!); clearTimeout(totalTimer!);
    if (abortListener) signal.removeEventListener('abort', abortListener);
  }
}

/** Parses one complete OpenAI-compatible SSE chat-completion response. Partial calls are never returned. */
export async function consumeChatCompletionStream(response: Response, options: StreamConsumeOptions): Promise<StreamedCompletion> {
  const metrics: StreamMetrics = { requestId: response.headers.get('x-request-id') || response.headers.get('request-id') || undefined, headerMs: 0, durationMs: 0, chunks: 0, bytes: 0 };
  const started = Date.now(); const deadline = started + (options.maxDurationMs ?? 600_000); const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const content: string[] = []; const calls = new Map<number, StreamedToolCall>();
  let finishReason: string | undefined; let usage: unknown; let done = false; let sawDone = false;
  let lastUsefulAt = started;
  let phase: StreamActivity['kind'] = 'chunk';
  let toolName: string | undefined;
  metrics.reasoningChars = 0; metrics.contentChars = 0; metrics.toolChars = 0;
  const body = response.body;
  if (!body) throw new IncompleteStreamError('TeachGPT returned no streaming response body.', metrics);
  const reader = body.getReader(); const decoder = new TextDecoder('utf-8');
  let buffer = ''; let dataLines: string[] = []; let eventName = '';
  const dispatch = () => {
    if (!dataLines.length) { eventName = ''; return; }
    const data = dataLines.join('\n'); dataLines = [];
    if (data.trim() === '[DONE]') { sawDone = true; done = true; eventName = ''; return; }
    let payload: any;
    try { payload = JSON.parse(data); } catch { throw new IncompleteStreamError('TeachGPT sent malformed SSE JSON.', { ...metrics, durationMs: Date.now() - started, finishReason }); }
    if (payload?.error) throw new ProviderHttpError(Number(payload.error.status || response.status || 502), String(payload.error.message || 'TeachGPT reported a stream error.'));
    if (payload?.usage) usage = safeUsage(payload.usage);
    const choice = payload?.choices?.[0]; const delta = choice?.delta || {};
    const reasoning = delta.reasoning_content || delta.reasoning || delta.thinking;
    if (typeof reasoning === 'string') { metrics.reasoningChars! += reasoning.length; phase = 'reasoning'; }
    if (typeof delta.content === 'string' && delta.content.length) { content.push(delta.content); metrics.contentChars! += delta.content.length; lastUsefulAt = Date.now(); phase = 'content'; }
    if (Array.isArray(delta.tool_calls)) {
      for (const fragment of delta.tool_calls) {
        const index = Number(fragment.index);
        if (!Number.isInteger(index) || index < 0) throw new IncompleteStreamError('TeachGPT sent a tool call without a valid index.', { ...metrics, durationMs: Date.now() - started });
        let call = calls.get(index);
        if (!call) { call = { id: '', type: 'function', function: { name: '', arguments: '' } }; calls.set(index, call); }
        if (typeof fragment.id === 'string') call.id += fragment.id;
        if (fragment.type && fragment.type !== 'function') throw new IncompleteStreamError('TeachGPT sent an unsupported tool call type.', { ...metrics, durationMs: Date.now() - started });
        if (typeof fragment.function?.name === 'string') call.function.name += fragment.function.name;
        if (typeof fragment.function?.arguments === 'string') call.function.arguments += fragment.function.arguments;
        const fragmentSize = String(fragment.id || '').length + String(fragment.function?.name || '').length + String(fragment.function?.arguments || '').length;
        metrics.toolChars! += fragmentSize;
        if (fragmentSize) lastUsefulAt = Date.now();
        phase = 'tool'; toolName = call.function.name;
      }
    }
    if (typeof choice?.finish_reason === 'string') finishReason = choice.finish_reason;
    if (eventName === 'error') throw new ProviderHttpError(Number(payload?.status || 502), String(payload?.message || 'TeachGPT reported a stream error.'));
    eventName = '';
  };
  const processLine = (line: string) => {
    if (line === '') { dispatch(); return; }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':'); const field = colon < 0 ? line : line.slice(0, colon); let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') dataLines.push(value);
    else if (field === 'event') eventName = value;
  };
  const takeLines = (final = false) => {
    for (;;) {
      const match = /\r\n|\r|\n/.exec(buffer);
      if (!match) break;
      if (match[0] === '\r' && match.index === buffer.length - 1 && !final) break;
      const line = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length); processLine(line);
      if (done) break;
    }
    if (final && buffer.length) { processLine(buffer); buffer = ''; }
  };
  try {
    while (!done) {
      const usefulDeadline = lastUsefulAt + (options.noProgressTimeoutMs ?? 180_000);
      if (Date.now() >= usefulDeadline) throw new IncompleteStreamError('TeachGPT produced no usable answer or action within the progress deadline.', metrics);
      let next: ReadableStreamReadResult<Uint8Array>;
      try { next = await readWithLimits(reader, options.signal, options.inactivityTimeoutMs ?? 60_000, Math.min(deadline, usefulDeadline)); }
      catch (error) {
        if (!options.signal.aborted && Date.now() >= usefulDeadline && usefulDeadline < deadline) throw new IncompleteStreamError('TeachGPT produced no usable answer or action within the progress deadline.', metrics);
        throw error;
      }
      const { value, done: ended } = next;
      if (ended) break;
      metrics.chunks++; metrics.bytes += value.byteLength;
      if (metrics.bytes > maxBytes) throw new IncompleteStreamError('TeachGPT stream exceeded the response size limit.', { ...metrics, durationMs: Date.now() - started, finishReason });
      buffer += decoder.decode(value, { stream: true }); takeLines();
      options.onActivity?.({ kind: phase, chunks: metrics.chunks, bytes: metrics.bytes, toolName });
    }
    buffer += decoder.decode(); takeLines(true); if (dataLines.length) dispatch();
    metrics.durationMs = Date.now() - started; metrics.finishReason = finishReason; metrics.usage = usage;
    if (!sawDone || !finishReason) throw new IncompleteStreamError('TeachGPT stream ended before a complete finish reason and [DONE] marker.', metrics);
    if (finishReason === 'length') throw new IncompleteStreamError('TeachGPT stopped at its output length limit; the response is incomplete and no tool calls were run.', metrics);
    const toolCalls = [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
    for (const call of toolCalls) {
      if (!call.id || !call.function.name || !call.function.arguments) throw new IncompleteStreamError('TeachGPT returned an incomplete tool call; no tools were run.', metrics);
      try { JSON.parse(call.function.arguments); } catch { throw new IncompleteStreamError('TeachGPT returned truncated or invalid tool arguments; no tools were run.', metrics); }
    }
    const publicContent = content.join('').replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '').replace(/<think\b[^>]*>[\s\S]*$/i, '');
    if (!publicContent.trim() && !toolCalls.length) throw new IncompleteStreamError('TeachGPT completed without a usable answer or tool action.', metrics);
    return { content: publicContent, toolCalls, finishReason, usage, metrics };
  } catch (error) {
    metrics.durationMs = Date.now() - started; metrics.finishReason = finishReason; metrics.usage = usage;
    // Cancelling a stalled network body can itself remain pending forever.
    // The timeout/abort is already the authoritative result, so cleanup must
    // never keep the task in its "working" state while waiting for the peer.
    try { void reader.cancel(error).catch(() => {}); } catch {}
    if (error instanceof IncompleteStreamError || error instanceof ProviderHttpError) throw error;
    throw new IncompleteStreamError(error instanceof Error ? error.message : String(error), metrics);
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

type StreamingOptions = {
  signal: AbortSignal;
  noProgressTimeoutMs?: number;
  connectTimeoutMs?: number;
  inactivityTimeoutMs?: number;
  maxDurationMs?: number;
  onRetry?: (attempt: number, delayMs: number, status?: number) => void;
  onActivity?: (activity: StreamActivity) => void;
  onDiagnostic?: (metrics: StreamMetrics, error?: string) => void;
  fetcher?: typeof fetch;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
};

/** Streams SSE with a header deadline; once headers arrive, an idle timeout and total cap govern the body. */
export async function requestChatCompletionStream(url: string, init: RequestInit, options: StreamingOptions): Promise<StreamedCompletion> {
  const fetcher = options.fetcher || fetch; const wait = options.wait || waitForRetry; const random = options.random || Math.random;
  const started = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (options.signal.aborted) throw options.signal.reason || new Error('Request cancelled.');
    const headersStarted = Date.now(); let headerTimer: ReturnType<typeof setTimeout> | undefined;
    const connection = new AbortController(); const cancelFromTask = () => connection.abort(options.signal.reason || new Error('Request cancelled.'));
    options.signal.addEventListener('abort', cancelFromTask, { once: true });
    const connectTimeout = Math.min(options.connectTimeoutMs ?? 30_000, Math.max(1, options.maxDurationMs ?? 600_000));
    headerTimer = setTimeout(() => connection.abort(timeoutError('TeachGPT did not establish the stream within 30 seconds.')), connectTimeout);
    let response: Response | undefined;
    try { response = await fetcher(url, { ...init, signal: connection.signal }); }
    catch (error) {
      clearTimeout(headerTimer); options.signal.removeEventListener('abort', cancelFromTask);
      if (options.signal.aborted) throw options.signal.reason || error;
      if (attempt === 2) { options.onDiagnostic?.({ headerMs: Date.now() - headersStarted, durationMs: Date.now() - started, chunks: 0, bytes: 0 }, error instanceof Error ? error.message : String(error)); throw error; }
      const delay = attempt === 0 ? 5_000 : 15_000; options.onRetry?.(attempt + 2, delay); await wait(delay + Math.floor(random() * 1000), options.signal); continue;
    }
    clearTimeout(headerTimer);
    const headerMs = Date.now() - headersStarted;
    const metrics: StreamMetrics = { requestId: response.headers.get('x-request-id') || response.headers.get('request-id') || undefined, headerMs, durationMs: Date.now() - started, chunks: 0, bytes: 0 };
    if (!response.ok) {
      let detail = ''; try { detail = safeProviderDetail(response.status, await response.text()); } catch {}
      options.signal.removeEventListener('abort', cancelFromTask);
      const transient = [429, 500, 502, 503, 504].includes(response.status);
      if (transient && attempt < 2) {
        const retryAfter = response.headers.get('retry-after');
        const numeric = retryAfter ? Number(retryAfter) * 1000 : NaN;
        const dateValue = retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
        const parsed = Number.isFinite(numeric) ? numeric : dateValue;
        const delay = Number.isFinite(parsed) ? Math.min(30_000, Math.max(500, parsed)) : attempt === 0 ? 5_000 : 15_000;
        options.onRetry?.(attempt + 2, delay, response.status); options.onDiagnostic?.({ ...metrics, durationMs: Date.now() - started }, 'HTTP ' + response.status);
        await wait(delay + Math.floor(random() * 1000), options.signal); continue;
      }
      options.onDiagnostic?.({ ...metrics, durationMs: Date.now() - started }, 'HTTP ' + response.status);
      throw new ProviderHttpError(response.status, detail || providerError(response.status), response.headers.get('retry-after') || undefined);
    }
    const maxDuration = Math.min(options.maxDurationMs ?? 600_000, Math.max(1, (options.maxDurationMs ?? 600_000) - (Date.now() - started)));
    try {
      const result = await consumeChatCompletionStream(response, { signal: AbortSignal.any([options.signal, connection.signal]), inactivityTimeoutMs: options.inactivityTimeoutMs ?? 60_000, noProgressTimeoutMs: options.noProgressTimeoutMs, maxDurationMs: maxDuration, onActivity: options.onActivity });
      result.metrics.headerMs = headerMs; result.metrics.durationMs = Date.now() - started;
      options.onDiagnostic?.(result.metrics);
      options.signal.removeEventListener('abort', cancelFromTask);
      return result;
    } catch (error) {
      // The stream reader can time out after fetch has returned headers. Abort
      // the owning request too, otherwise the underlying socket may keep living
      // after the task has already moved to a retryable failure state.
      if (!connection.signal.aborted) connection.abort(error);
      options.signal.removeEventListener('abort', cancelFromTask);
      const detail = error instanceof Error ? error.message : String(error);
      const partial = error instanceof IncompleteStreamError ? error.metrics : { ...metrics, durationMs: Date.now() - started };
      options.onDiagnostic?.({ ...partial, requestId: metrics.requestId, headerMs, durationMs: Date.now() - started }, detail);
      const interrupted = error instanceof IncompleteStreamError && /ended before a complete finish reason|network|terminated|connection|idle for too long/i.test(detail);
      if (interrupted && attempt < 2 && !options.signal.aborted) {
        const delay = attempt === 0 ? 5_000 : 15_000;
        options.onRetry?.(attempt + 2, delay);
        await wait(delay + Math.floor(random() * 1000), options.signal);
        continue;
      }
      throw error;
    }
  }
  throw new Error('TeachGPT streaming retries exhausted.');
}

function retryDelay(response: Response | undefined, attempt: number, random: () => number): number {
  const header = response?.headers.get('retry-after');
  const seconds = header === null || header === undefined ? NaN : Number(header);
  const retryAfter = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : NaN;
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(30_000, Math.max(500, retryAfter));
  return Math.min(30_000, 1_500 * 2 ** attempt + Math.floor(random() * 500));
}

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function requestWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  onRetry: (attempt: number, delayMs: number, status?: number) => void = () => {},
  options: RetryOptions = {},
): Promise<Response> {
  const fetcher = options.fetcher || fetch;
  const wait = options.wait || waitForRetry;
  const random = options.random || Math.random;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetcher(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]) });
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
      await response.body?.cancel();
    } catch (error) {
      if (signal.aborted || attempt === 2 || !(error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError'))) throw error;
    }
    const delay = retryDelay(response, attempt, random);
    onRetry(attempt + 2, delay, response?.status);
    await wait(delay, signal);
  }
  throw new Error('TeachGPT request retries exhausted.');
}

export function providerError(status: number): string {
  if (status === 504) return 'TeachGPT timed out (HTTP 504). The school server did not finish the request after retries. Your conversation is saved; try again later or choose another model.';
  if (status === 429 || status === 503) return `TeachGPT is temporarily busy (HTTP ${status}). Your conversation is saved; try again shortly.`;
  if (status === 401 || status === 403) return `TeachGPT rejected the API key (HTTP ${status}). Check the key in Settings.`;
  if (status >= 500) return `TeachGPT has a server error (HTTP ${status}). Your conversation is saved; try again later.`;
  return `TeachGPT returned HTTP ${status}. Check the model and connection settings.`;
}

export function safeProviderDetail(status: number, body: string): string {
  const value = body.trim();
  if (!value || /<!doctype\s+html|<html\b|<body\b|<h[1-6]\b/i.test(value)) return providerError(status);
  try {
    const parsed = JSON.parse(value);
    const message = parsed?.error?.message || parsed?.message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 1000);
  } catch {}
  return value.slice(0, 1000);
}
