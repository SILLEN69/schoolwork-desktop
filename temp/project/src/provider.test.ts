import { describe, expect, it, vi } from 'vitest';
import { consumeChatCompletionStream, IncompleteStreamError, providerError, requestChatCompletionStream, requestWithRetry, safeProviderDetail } from './provider';

describe('TeachGPT transient failures', () => {
  it('retries a 504 within the same request and reports progress', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('<html>timeout</html>', { status: 504 }))
      .mockResolvedValueOnce(new Response('{"choices":[]}', { status: 200 }));
    const onRetry = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);
    const result = await requestWithRetry('https://example.test/chat', { method: 'POST' }, new AbortController().signal, onRetry, { fetcher, wait, random: () => 0 });
    expect(result.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(2, 1500, 504);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('stops after three 504 responses and never exposes gateway HTML', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<html>Gateway Time-out</html>', { status: 504 }));
    const result = await requestWithRetry('https://example.test/chat', {}, new AbortController().signal, undefined, { fetcher, wait: async () => {} });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(providerError(result.status)).toContain('timed out (HTTP 504)');
    expect(providerError(result.status)).not.toContain('<html>');
  });

  it('does not retry rejected credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    const result = await requestWithRetry('https://example.test/chat', {}, new AbortController().signal, undefined, { fetcher });
    expect(result.status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('replaces gateway HTML with a useful normalized timeout message', () => {
    const message = safeProviderDetail(504, '<html><body><h1>504 Gateway Time-out</h1></body></html>');
    expect(message).toContain('timed out (HTTP 504)');
    expect(message).not.toContain('<html>');
  });
});

function streamResponse(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  return new Response(new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }), { status: 200, headers });
}
function sseBytes(lines: string, splitAt: number[] = []) {
  const bytes = new TextEncoder().encode(lines); const points = [0, ...splitAt.filter(x => x > 0 && x < bytes.length), bytes.length].sort((a, b) => a - b);
  return points.slice(1).map((end, i) => bytes.slice(points[i], end));
}
function data(value: unknown) { return 'data: ' + JSON.stringify(value) + '\r\n\r\n'; }

describe('TeachGPT streaming SSE', () => {
  it('parses UTF-8 and SSE fields fragmented across chunks with multiple indexed tool calls', async () => {
    const text = ': keepalive\r\n' + data({ choices: [{ delta: { content: 'Hej världen ' }, finish_reason: null }] }) +
      data({ choices: [{ delta: { reasoning_content: 'private reasoning' }, finish_reason: null }] }) +
      data({ choices: [{ delta: { tool_calls: [
        { index: 1, id: 'second', type: 'function', function: { name: 'read_file', arguments: '{"path":"x"}' } },
        { index: 0, id: 'first', type: 'function', function: { name: 'write_file', arguments: '{"path":"a","content":"ok"}' } },
      ] }, finish_reason: null }] }) +
      data({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }) +
      data({ choices: [], usage: { prompt_tokens: 18, completion_tokens: 9 } }) + 'data: [DONE]\r\n\r\n';
    const bytes = new TextEncoder().encode(text); const splitPoints = Array.from({ length: bytes.length - 1 }, (_, i) => i + 1);
    const activity: string[] = [];
    const result = await consumeChatCompletionStream(streamResponse(sseBytes(text, splitPoints), { 'x-request-id': 'request-test' }), { signal: new AbortController().signal, onActivity: a => activity.push(a.kind) });
    expect(result.content).toBe('Hej världen ');
    expect(result.toolCalls.map(x => [x.id, x.function.name])).toEqual([['first', 'write_file'], ['second', 'read_file']]);
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({ path: 'a', content: 'ok' });
    expect(result.finishReason).toBe('tool_calls'); expect(result.usage).toEqual({ prompt_tokens: 18, completion_tokens: 9 });
    expect(result.metrics.requestId).toBe('request-test'); expect(activity).toContain('reasoning');
    expect(JSON.stringify(result)).not.toContain('private reasoning');
  });

  it('rejects a dropped connection and truncated tool arguments without returning executable calls', async () => {
    const incomplete = data({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'x', function: { name: 'write_file', arguments: '{"path":' } }] }, finish_reason: 'tool_calls' }] });
    await expect(consumeChatCompletionStream(streamResponse(sseBytes(incomplete)), { signal: new AbortController().signal })).rejects.toThrow(/before a complete|truncated or invalid/);
    const truncatedArgs = data({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'x', function: { name: 'write_file', arguments: '{"path":' } }] }, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n';
    await expect(consumeChatCompletionStream(streamResponse(sseBytes(truncatedArgs)), { signal: new AbortController().signal })).rejects.toThrow(IncompleteStreamError);
  });

  it('treats finish_reason length as incomplete and cancels the body reader', async () => {
    const limited = data({ choices: [{ delta: { content: 'partial' }, finish_reason: 'length' }] }) + 'data: [DONE]\n\n';
    await expect(consumeChatCompletionStream(streamResponse(sseBytes(limited)), { signal: new AbortController().signal })).rejects.toThrow(/output length limit/);
    const controller = new AbortController(); let wasCancelled = false;
    const response = new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() { wasCancelled = true; } }));
    const parsing = consumeChatCompletionStream(response, { signal: controller.signal, inactivityTimeoutMs: 5000 });
    controller.abort(new Error('test cancellation'));
    await expect(parsing).rejects.toThrow(IncompleteStreamError);
    expect(wasCancelled).toBe(true);
  });

  it('enforces the no-data timeout and releases an idle reader', async () => {
    let wasCancelled = false;
    const response = new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() { wasCancelled = true; } }));
    await expect(consumeChatCompletionStream(response, { signal: new AbortController().signal, inactivityTimeoutMs: 10, maxDurationMs: 1000 })).rejects.toThrow(/idle for too long/);
    expect(wasCancelled).toBe(true);
  });

  it('returns from timeout even if the network stream never finishes cancellation', async () => {
    let cancelStarted = false;
    const response = new Response(new ReadableStream<Uint8Array>({
      start() {},
      cancel() { cancelStarted = true; return new Promise<void>(() => {}); },
    }));
    const result = await Promise.race([
      consumeChatCompletionStream(response, { signal: new AbortController().signal, inactivityTimeoutMs: 10, maxDurationMs: 1000 })
        .then(() => 'completed', error => error instanceof IncompleteStreamError ? error.message : String(error)),
      new Promise<string>(resolve => setTimeout(() => resolve('test watchdog expired; task is still hanging'), 250)),
    ]);
    expect(cancelStarted).toBe(true);
    expect(result).toMatch(/idle for too long/);
  });

  it('retries an idle stream without leaving the task stuck or dropping stream mode', async () => {
    const idle = new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() { return new Promise<void>(() => {}); } }));
    const complete = data({ choices: [{ delta: { content: 'recovered' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n';
    const fetcher = vi.fn().mockResolvedValueOnce(idle).mockResolvedValueOnce(streamResponse(sseBytes(complete)));
    const result = await requestChatCompletionStream('https://example.test/chat', { method: 'POST', body: JSON.stringify({ stream: true }) }, {
      signal: new AbortController().signal, fetcher, wait: async () => {}, random: () => 0, inactivityTimeoutMs: 10, maxDurationMs: 1000,
    });
    expect(result.content).toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => JSON.parse(String(init?.body)).stream === true)).toBe(true);
  });

  it('retries a gateway response on the same streaming request and never drops stream mode', async () => {
    const complete = data({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n';
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('gateway timeout', { status: 504 }))
      .mockResolvedValueOnce(streamResponse(sseBytes(complete)));
    const onRetry = vi.fn();
    const result = await requestChatCompletionStream('https://example.test/chat', { method: 'POST', body: JSON.stringify({ stream: true }) }, {
      signal: new AbortController().signal, fetcher, wait: async () => {}, random: () => 0, onRetry,
    });
    expect(result.content).toBe('ok');
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Number), 504);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => JSON.parse(String(init?.body)).stream === true)).toBe(true);
  });

  it('continues reading after the 30-second header deadline once streaming has begun', async () => {
    vi.useFakeTimers();
    try {
      const payload = new TextEncoder().encode(data({ choices: [{ delta: { content: 'finished' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n');
      const body = new ReadableStream<Uint8Array>({ pull(controller) { return new Promise<void>(resolve => setTimeout(() => { controller.enqueue(payload); controller.close(); resolve(); }, 31_000)); } });
      const resultPromise = requestChatCompletionStream('https://example.test/chat', { method: 'POST', body: JSON.stringify({ stream: true }) }, {
        signal: new AbortController().signal, fetcher: async () => new Response(body), connectTimeoutMs: 30_000, inactivityTimeoutMs: 40_000, maxDurationMs: 60_000,
      });
      await vi.advanceTimersByTimeAsync(31_001);
      const result = await resultPromise;
      expect(result.content).toBe('finished');
      expect(result.metrics.durationMs).toBeGreaterThanOrEqual(31_000);
    } finally { vi.useRealTimers(); }
  });

  it('discards an interrupted body before retrying, so incomplete tool calls are never returned', async () => {
    const partial = data({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'partial', function: { name: 'write_file', arguments: '{"path":' } }] }, finish_reason: null }] });
    const complete = data({ choices: [{ delta: { content: 'recovered' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n';
    const fetcher = vi.fn().mockResolvedValueOnce(streamResponse(sseBytes(partial))).mockResolvedValueOnce(streamResponse(sseBytes(complete)));
    const result = await requestChatCompletionStream('https://example.test/chat', { method: 'POST', body: JSON.stringify({ stream: true }) }, {
      signal: new AbortController().signal, fetcher, wait: async () => {}, random: () => 0,
    });
    expect(result.toolCalls).toEqual([]);
    expect(result.content).toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
