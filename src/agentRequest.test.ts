import { describe, it, expect, vi } from 'vitest';
import { requestAgentStep } from './agentRequest';
import { consumeChatCompletionStream } from './provider';

function response(delta: unknown) {
  return new Response('data: ' + JSON.stringify({ choices: [{ delta, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
describe('empty and reasoning-only generations', () => {
  it('recovers once with the same model and preserves completed tool results', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ reasoning_content: 'private' })).mockResolvedValueOnce(response({ content: 'Verified result' }));
    const request = { model: 'Qwen3.8-27B', stream: true, messages: [{ role: 'user', content: 'Fix this' }, { role: 'tool', content: 'saved-result', tool_call_id: 'done' }] };
    const recovery = vi.fn();
    const result = await requestAgentStep('https://example.test', {}, request, { signal: new AbortController().signal, fetcher }, recovery);
    expect(result.content).toBe('Verified result');
    expect(recovery).toHaveBeenCalledTimes(1);
    const second = JSON.parse(String(fetcher.mock.calls[1][1].body));
    expect(second.model).toBe(request.model); expect(second.stream).toBe(true);
    expect(second.messages.slice(0, 2)).toEqual(request.messages);
    expect(JSON.stringify(second)).not.toContain('private');
  });
  it('stops after one recovery instead of repeating empty generations indefinitely', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response({ reasoning_content: 'private' }));
    await expect(requestAgentStep('https://example.test', {}, { model: 'Qwen3.8-27B', messages: [] }, { signal: new AbortController().signal, fetcher }, () => {})).rejects.toThrow(/without a usable/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not treat continuing reasoning as useful tool progress', async () => {
    vi.useFakeTimers();
    let timer: ReturnType<typeof setInterval>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { timer = setInterval(() => controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { reasoning_content: 'private' } }] }) + '\n\n')), 10); },
      cancel() { clearInterval(timer); },
    });
    try {
      const checked = expect(consumeChatCompletionStream(new Response(body), { signal: new AbortController().signal, noProgressTimeoutMs: 100, maxDurationMs: 1000 })).rejects.toThrow(/progress deadline/);
      await vi.advanceTimersByTimeAsync(101); await checked;
    } finally { clearInterval(timer!); vi.useRealTimers(); }
  });
  it('rejects private thinking enclosed in content instead of delivering it as an answer', async () => {
    await expect(consumeChatCompletionStream(response({ content: '<think>private</think>' }), { signal: new AbortController().signal })).rejects.toThrow(/without a usable/);
  });
});
