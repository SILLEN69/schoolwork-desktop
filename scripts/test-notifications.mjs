import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const data=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork notifications '));let app;
try{
  app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('scripts/test-app.cjs'),'--user-data-dir='+data],env:{...process.env,SCHOOLWORK_TEST_DATA:data,SCHOOLWORK_TEST_EXE:process.execPath},timeout:30000});
  const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>Boolean(window.schoolwork));await page.locator('.startup-splash').waitFor({state:'detached'});
  for(const [marker,state,title] of [['#verification-prefix','completed','Task complete'],['#provider-failure','waiting_retry','Task needs attention']]){
    const owner=randomUUID();await page.evaluate(({owner,marker})=>window.schoolwork.send({chatId:owner,userText:marker,model:'Test-vision'}),{owner,marker});
    await page.waitForFunction(async({owner,state})=>(await window.schoolwork.getChat(owner)).task?.state===state,{owner,state},{timeout:25000});
    const notice=page.locator('.task-notice').filter({has:page.getByText(title,{exact:true})});await notice.waitFor();
    await notice.getByRole('button',{name:'View task',exact:true}).click();
    await page.waitForFunction(marker=>document.querySelector('.thread')?.textContent?.includes(marker)||document.querySelector('.messages')?.textContent?.includes(marker),marker).catch(async()=>{
      await page.getByText(marker,{exact:true}).last().waitFor();
    });
    assert.equal(await notice.count(),0);
  }
  await page.getByRole('button',{name:/Settings/}).first().click();
  await page.getByRole('button',{name:'Test Windows notification',exact:true}).click();
  await page.getByText('The system notification could not be requested. In-app notices still work.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  const db=new DatabaseSync(path.join(data,'schoolwork.sqlite3'),{readOnly:true});
  const rows=db.prepare("SELECT message,details_json FROM diagnostics WHERE category='notifications'").all();db.close();
  assert.ok(rows.filter(row=>row.message==='unsupported').length>=3);assert.ok(rows.every(row=>row.details_json==='{}'));
  console.log('PASS: real completion/error events create visible fallback notices; View task opens the matching conversation; unsupported Windows delivery is diagnosed, and the test button reports it honestly.');
}finally{await app?.close();}

if(process.argv.includes('--native')){
  const nativeData=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork native notification '));let nativeApp;
  try{
    nativeApp=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('scripts/test-app.cjs'),'--user-data-dir='+nativeData],env:{...process.env,SCHOOLWORK_TEST_DATA:nativeData,SCHOOLWORK_TEST_EXE:process.execPath,SCHOOLWORK_TEST_NATIVE_NOTIFICATIONS:'1'},timeout:30000});
    const page=await nativeApp.firstWindow();await page.waitForFunction(()=>Boolean(window.schoolwork));
    const result=await page.evaluate(()=>window.schoolwork.testNotifications());assert.equal(result.requested,true);
    const db=new DatabaseSync(path.join(nativeData,'schoolwork.sqlite3'),{readOnly:true});
    const until=Date.now()+10000;let outcome;
    while(Date.now()<until){outcome=db.prepare("SELECT message FROM diagnostics WHERE category='notifications' AND message IN ('accepted','failed') ORDER BY created_at DESC LIMIT 1").get();if(outcome)break;await new Promise(resolve=>setTimeout(resolve,100));}
    db.close();assert.equal(outcome?.message,'accepted','Windows did not accept the native notification');
    console.log('PASS: actual Windows/Electron notification accepted. Banner visibility depends on Windows user settings.');
  }finally{await nativeApp?.close();}
}
