import { BrowserWindow } from 'electron';
import { z } from 'zod';

export const previewInput = z.object({ url: z.string().url(), clickSelector: z.string().max(500).optional(), expectedText: z.string().min(1).max(500).optional() });
export function localPreviewUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Preview checks require a localhost HTTP/HTTPS address without credentials.');
  return url;
}
/** Dedicated renderer: no preload, IPC bindings, shared login session or Node APIs. */
export async function checkPreview(raw: unknown, signal: AbortSignal) {
  const args = previewInput.parse(raw); const url = localPreviewUrl(args.url); signal.throwIfAborted();
  const win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'preview-' + crypto.randomUUID() } });
  const errors: string[] = [];
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, destination) => { if (new URL(destination).origin !== url.origin) event.preventDefault(); });
  win.webContents.on('will-redirect', (event, destination) => { if (new URL(destination).origin !== url.origin) event.preventDefault(); });
  // Local preview windows need loopback network access; other device permissions stay denied.
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => permission === 'loopback-network');
  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'loopback-network'));
  win.webContents.on('console-message', event => { if (event.level === 'error' && errors.length < 20) errors.push(event.message.slice(0, 600)); });
  const abort = () => { if (!win.isDestroyed()) win.destroy(); };
  signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        await win.loadURL(url.href);
        // A fixed, bounded browser script. Model-provided selectors are data, never JS code.
        const data = await win.webContents.executeJavaScript(`(async () => {
          const selector = ${JSON.stringify(args.clickSelector || '')};
          if (selector) { const element = document.querySelector(selector); if (!element) throw new Error('Click target not found'); element.click(); }
          await new Promise(resolve => setTimeout(resolve, 400));
          return { title: document.title, url: location.href, text: document.body.innerText.slice(0, 12000),
            controls: Array.from(document.querySelectorAll('button,a,input,select')).slice(0, 50).map(el => ({ tag: el.tagName, id: el.id, label: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || '').slice(0, 100) })) };
        })()`);
        signal.throwIfAborted();
        const expectationPassed = args.expectedText ? data.text.includes(args.expectedText) : null;
        return { ok: expectationPassed !== false && errors.length === 0, summary: expectationPassed === false ? 'Expected page text was not found.' : errors.length ? 'Page loaded with browser console errors.' : args.expectedText ? 'Page interaction and expected text verified.' : 'Page inspected. No interaction assertion was requested.', data: { ...data, consoleErrors: errors, expectationPassed, clicked: args.clickSelector || null } };
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { abort(); reject(new Error('Preview check timed out after 20 seconds.')); }, 20000); }),
    ]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); abort(); }
}
