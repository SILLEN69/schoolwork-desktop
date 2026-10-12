import { spawn } from "node:child_process";
import path from "node:path";
import fs from 'node:fs';
import electron from 'electron';
import {createServer} from 'vite';
const profile=process.env.SCHOOLWORK_DEV_DATA||path.resolve('work/dev-profile');
if(!path.isAbsolute(profile))throw new Error('SCHOOLWORK_DEV_DATA must be an absolute directory.');
fs.mkdirSync(profile,{recursive:true});
const port=Number(process.env.SCHOOLWORK_DEV_PORT||5173);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('SCHOOLWORK_DEV_PORT must be a port number (0 chooses a free port).');
// Only connect Electron after our own server listens successfully. Never attach
// privileged development IPC to an unrelated listener or silently shifted port.
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true}});
await server.listen();
const url=server.resolvedUrls.local[0];
const developmentEnv={...process.env,VITE_DEV_SERVER_URL:url};
delete developmentEnv.ELECTRON_RUN_AS_NODE;
console.log('Development profile: '+profile);
console.log('Development URL: '+url);
const child = spawn(
  electron,
  [".",'--user-data-dir='+profile],
  {
    windowsHide: true,
    stdio: "inherit",
    env: developmentEnv,
  },
);
let stopping=false;
const stop=()=>{stopping=true;child.kill('SIGTERM');};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,stop);
// Local parent-process control, useful for deterministic development smoke checks.
process.on('message',message=>{if(message==='stop')stop();});
process.send?.({type:'ready',url,profile,pid:child.pid});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
  void server.close();
});
child.on("close", (code) => {
  if(!process.exitCode)process.exitCode = stopping?0:code??1;
  void server.close().finally(()=>{if(process.connected)process.disconnect();});
});
