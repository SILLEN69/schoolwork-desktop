import {_electron} from 'playwright';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const data=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-opencode-app-'));
const env={...process.env,SCHOOLWORK_OPENCODE_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
let app;const start=async()=>{app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'),args:[path.resolve('scripts/test-opencode-app.cjs'),'--user-data-dir='+data],env});return app.firstWindow();};
try{
 let page=await start();
 await app.evaluate(()=>{global.__openCodeTest.hold=true;});
 await page.locator('.startup-splash').waitFor({state:'detached'});await page.waitForFunction(()=>document.querySelector('.footer-note button')?.textContent==='English');
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Create checked.js and verify the result with Node.');await page.waitForTimeout(150);await page.locator('.send-btn').click();
 await page.waitForFunction(async()=> (await window.schoolwork.listChats()).length>0);
 const id=(await page.evaluate(()=>window.schoolwork.listChats()))[0].id;
 const taskId=(await page.evaluate(id=>window.schoolwork.getChat(id),id)).task.id;
 await page.waitForFunction(async id=>{const c=await window.schoolwork.getChat(id);return c.messages.some(m=>m.role==='tool'&&m.name==='write_file');},id,{timeout:30000});
 const thinking=page.locator('.activity .atom-working');await thinking.waitFor();
 const star=thinking.locator('svg g circle').first();const before=await star.getAttribute('cx');await page.waitForTimeout(340);assert.notEqual(await star.getAttribute('cx'),before);
 await page.evaluate(()=>{const realNow=Date.now;Date.now=()=>realNow()+61000;});
 await page.locator('.surprise-hint').waitFor({timeout:5000});await thinking.focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Star catch',exact:true}).waitFor();await page.locator('.atom-game-close').click();
 assert.equal(await page.locator('.surprise-hint').count(),0);
 console.log('PASS: animated thinking icon, one-minute hint and keyboard game launch work during a real OpenCode task.');
 await page.evaluate(taskId=>window.schoolwork.control(taskId,'pause'),taskId);
 await app.close();app=null;
 page=await start();
 await page.evaluate(taskId=>window.schoolwork.control(taskId,'resume'),taskId);
 let conversation;const until=Date.now()+45000;
 while(Date.now()<until){conversation=await page.evaluate(id=>window.schoolwork.getChat(id),id);if(conversation.task?.state==='completed'||(conversation.task?.state==='waiting_retry'&&conversation.task.error))break;await new Promise(resolve=>setTimeout(resolve,100));}
 if(conversation.task?.state!=='completed')console.error('FIXTURE_STATE',JSON.stringify({task:conversation.task,messages:conversation.messages.map(m=>({role:m.role,name:m.name,content:m.content.slice(0,1000)}))}));
 assert.equal(conversation.task.state,'completed',conversation.task.error||'Task did not complete.');
 assert.equal(conversation.task.model,'Qwen3.8-27B');assert.equal(conversation.messages.filter(m=>m.role==='user').length,1);
 assert.equal(conversation.messages.filter(m=>m.role==='tool'&&m.name==='write_file').length,1);
 assert.equal(conversation.messages.filter(m=>m.role==='tool'&&m.name==='run_process').length,1);
 assert.match(conversation.messages.at(-1).content,/verified/);
 assert.equal(await fs.readFile(path.join(data,'checked.js'),'utf8'),'module.exports = 42;\n');
 await app.evaluate(()=>{global.__openCodeTest.question=true;});
 await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Message',exact:true}).fill('Let me choose a colour.');await page.locator('.send-btn').click();
 await page.locator('.work-question').waitFor({timeout:30000});await page.getByRole('radio',{name:/Blue/}).check();await page.getByRole('button',{name:'Send answer',exact:true}).click();
 await page.getByText('The user selected Blue.',{exact:true}).waitFor({timeout:30000});
 assert.equal(await page.locator('.work-question').count(),0);assert.equal(await page.locator('.surprise-hint').count(),0);
 console.log('PASS: native OpenCode question is presented and answered through real SchoolWork IPC; the model receives Blue.');
 console.log('PASS: real SchoolWork + bundled OpenCode writes, pauses, restarts and resumes with the same model; a real Node assertion passes without duplicate user messages or file writes.');
}catch(error){console.log('UI_FAILURE',await (await app.firstWindow()).evaluate(()=>({text:document.body.innerText.slice(-2500),input:document.querySelector('textarea')?.value})));throw error;}finally{await app?.close().catch(()=>{});}

