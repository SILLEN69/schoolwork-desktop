import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

if(process.platform!=='win32')throw new Error('This focused regression uses Windows PowerShell and batch launchers.');
for(const marker of ['#verification-prefix','#verification-batch']) {
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork recovery '));
  let app;
  try {
    app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('scripts/test-app.cjs'),'--user-data-dir='+data],env:{...process.env,SCHOOLWORK_TEST_DATA:data,SCHOOLWORK_TEST_EXE:process.execPath},timeout:30000});
    app.process().stderr.on('data',chunk=>process.stderr.write(chunk));
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
    const page=await app.firstWindow();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.waitForFunction(()=>Boolean(window.schoolwork));
    const owner=randomUUID();await page.evaluate(({owner,marker})=>window.schoolwork.send({chatId:owner,userText:marker,model:'Test-vision'}),{owner,marker});
    const until=Date.now()+25000;let chat;
    while(Date.now()<until){chat=await page.evaluate(owner=>window.schoolwork.getChat(owner),owner);if(['completed','waiting_retry','failed'].includes(chat.task?.state))break;await new Promise(resolve=>setTimeout(resolve,60));}
    assert.equal(chat?.task?.state,'completed',chat?.task?.error||'Task did not complete');
    assert.equal(chat.messages.filter(message=>message.role==='user').length,1);
    const tools=chat.messages.filter(message=>message.role==='tool');
    assert.equal(tools.length,marker==='#verification-batch'?3:2,'No redundant tool execution or final-answer repair loop');
    const check=JSON.parse(tools.at(-1).content);assert.equal(check.data.exitCode,0);assert.equal(check.ok,true);
    assert.equal(errors.length,0);console.log('PASS: '+marker+' completes after one real check, without duplicate input/actions.');
  } finally {await app?.close();}
}
