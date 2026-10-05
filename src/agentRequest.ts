import { IncompleteStreamError, requestChatCompletionStream } from './provider';

type Options = Parameters<typeof requestChatCompletionStream>[2];
type Request = { model: string; messages: Array<{ role: string; content?: unknown; [key: string]: unknown }>; [key: string]: unknown };

/** Recovery is inference-only: no partial response is committed or dispatched. */
export async function requestAgentStep(url: string, init: RequestInit, request: Request, options: Options, onRecovery: (next: Request) => void) {
  const started = Date.now();
  try { return await requestChatCompletionStream(url, { ...init, body: JSON.stringify(request) }, options); }
  catch (error) {
    const recoverable = error instanceof IncompleteStreamError && /without a usable|no usable answer|output length limit/.test(error.message);
    const remaining = (options.maxDurationMs ?? 600_000) - (Date.now() - started);
    if (!recoverable || options.signal.aborted || remaining < 1000) throw error;
    const next: Request = { ...request, stream: true, messages: [...request.messages, {
      role: 'system',
      content: 'The previous inference produced no usable answer or completed action. No action from that inference was executed. Continue the original objective using the recorded tool results. Choose just one small next tool action with bounded arguments, then wait for its result. Prefer reading a relevant range or making a targeted patch over generating a whole application in one response. If no tool is needed, give a brief direct answer. Do not claim completion without actual verification evidence.',
    }] };
    onRecovery(next);
    return requestChatCompletionStream(url, { ...init, body: JSON.stringify(next) }, { ...options, maxDurationMs: remaining });
  }
}
