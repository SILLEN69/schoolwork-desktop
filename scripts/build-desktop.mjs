import { build } from 'esbuild';
import {copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {projectorDebugEnabled}=require('./projector-debug-config.cjs');
let sourceBranch='';
try {sourceBranch=execFileSync('git',['branch','--show-current'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{/* Source archives can still use their release version. */}
const projectorDebug=projectorDebugEnabled({version:require('../package.json').version,ref:process.env.GITHUB_REF,branch:sourceBranch});

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
  define: { SCHOOLWORK_GOOGLE_CLIENT: JSON.stringify(clientId ? { clientId, clientSecret } : null), SCHOOLWORK_PROJECTOR_DEBUG: JSON.stringify(projectorDebug) },
});
await copyFile('electron/desktop-pointer.html','dist-electron/desktop-pointer.html');
