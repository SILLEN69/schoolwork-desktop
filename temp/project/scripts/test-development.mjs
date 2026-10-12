import {fork} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const profile=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork dev smoke '));
const child=fork('scripts/start-dev.mjs',[],{stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,SCHOOLWORK_DEV_DATA:profile,SCHOOLWORK_DEV_PORT:'0',ELECTRON_RUN_AS_NODE:'1'}});
let output='',code;child.stdout.on('data',data=>output=(output+data).slice(-4000));child.stderr.on('data',data=>output=(output+data).slice(-4000));
const exited=new Promise(resolve=>child.once('exit',value=>{code=value;resolve(value);}));
try {
  const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Development startup timed out. '+output)),20000);child.once('message',value=>{clearTimeout(timer);resolve(value);});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',value=>{clearTimeout(timer);reject(new Error('Development exited before readiness: '+value+' '+output));});});
  assert.equal(ready.profile,profile);assert.match(ready.url,/^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.equal((await fetch(ready.url)).status,200);
  const until=Date.now()+12000;let database=false;
  while(Date.now()<until){try{await fs.access(path.join(profile,'schoolwork.sqlite3'));database=true;break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal(database,true,'Electron must initialize the isolated profile even when parent ELECTRON_RUN_AS_NODE is set. '+output);
  child.send('stop');await exited;assert.equal(code,0);
  await assert.rejects(fetch(ready.url),'Owned Vite server must be closed');
  console.log('PASS: owned Vite server chooses a free port, Electron uses the isolated profile, inherited Node mode is cleared and parent stop closes both.');
} finally {if(child.connected)child.send('stop');await exited;assert.equal(path.dirname(profile),os.tmpdir());await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
