import { build } from 'esbuild';
import {copyFile} from 'node:fs/promises';

const clientId = process.env.SCHOOLWORK_GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.SCHOOLWORK_GOOGLE_CLIENT_SECRET?.trim();
if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error('Set both publisher Google Desktop client values, or neither.');
if (process.env.SCHOOLWORK_GOOGLE_REQUIRED === '1' && !clientId) throw new Error('Release builds require the publisher Google Desktop client configuration.');
if (clientId && (!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) || clientSecret.length > 512)) {
  throw new Error('Invalid publisher Google Desktop client configuration.');
}
if (!clientId) console.warn('Google sign-in is not provisioned in this build. Existing custom connections remain available.');
await build({
  entryPoints: ['electron/main.ts', 'electron/preload.ts', 'electron/pointerPreload.ts'], bundle: true,
  platform: 'node', format: 'cjs', external: ['electron', 'electron-updater'], outdir: 'dist-electron',
  define: { SCHOOLWORK_GOOGLE_CLIENT: JSON.stringify(clientId ? { clientId, clientSecret } : null) },
});
await copyFile('electron/desktop-pointer.html','dist-electron/desktop-pointer.html');
