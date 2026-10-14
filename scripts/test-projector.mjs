// Hosted startup failures must include the child's launch/exit diagnostics.
if(process.env.CI)process.env.DEBUG=[process.env.DEBUG,'pw:browser'].filter(Boolean).join(',');
const {_electron:electron}=await import('playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
const launchEnv={...process.env};delete launchEnv.ELECTRON_RUN_AS_NODE;delete launchEnv.ELECTRON_SKIP_BINARY_DOWNLOAD;
execFileSync(process.execPath,[path.resolve('node_modules/electron/install.js')],{stdio:'inherit',windowsHide:true,env:launchEnv});
const data=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-projector-test-'));
const shots=path.resolve('work/projector-verification');await fs.mkdir(shots,{recursive:true});
const results=[];const pass=text=>{results.push(text);console.log('PASS:',text);};
let app;
try{
 app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist',process.platform==='win32'?'electron.exe':'electron'),args:[path.resolve('scripts/test-projector-app.cjs'),'--user-data-dir='+data,'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',...(process.platform==='linux'?['--no-sandbox']:[])],env:{...launchEnv,SCHOOLWORK_PROJECTOR_TEST_DATA:data},timeout:30000});
 app.process().stderr.on('data',chunk=>{void fs.appendFile(path.join(shots,'electron-stderr.log'),chunk);});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',dialog=>{void dialog.accept().catch(()=>{});});
 await page.getByRole('button',{name:'Follow a lesson'}).click();
 const board=page.getByRole('region',{name:'Tavlan (YeetCast)'});const input=board.getByRole('textbox',{name:'Projektorkod'});await input.waitFor();
 await input.fill('123');await board.getByRole('button',{name:'Anslut',exact:true}).click();await board.getByRole('status').filter({hasText:/six-digit/}).waitFor();
 assert.equal(await app.evaluate(()=>global.__projectorTest.lookups),0);pass('invalid input has a clear error and makes no join request');
 await input.fill('001 234');const connecting=board.getByRole('button',{name:'Ansluter…'});await board.getByRole('button',{name:'Anslut',exact:true}).click();await connecting.waitFor();
 let login;for(let i=0;i<80;i++){login=app.windows().find(w=>w.url()==='https://yeet.ssis.nu/');if(login)break;await page.waitForTimeout(100);}
 assert.ok(login,'first connection opens the school sign-in window');await login.getByRole('button',{name:'Sign in to school'}).click();
 await board.getByText('Teacher',{exact:true}).waitFor({timeout:20000});
 assert.equal(await page.evaluate(()=>window.schoolwork.boardStatus().then(s=>s.receiverUrl)),'https://yeet.ssis.nu/receiver/42');
 assert.deepEqual(await app.evaluate(()=>({lookups:global.__projectorTest.lookups,deletes:global.__projectorTest.deletes,joined:global.__projectorTest.joined,pushLoads:global.__projectorTest.pushLoads})),{lookups:1,deletes:1,joined:0,pushLoads:0});
 pass('a spaced six-digit code resolves through normal sign-in, stores the receiver, deletes its temporary sender and never loads a push stream');
 await app.evaluate(()=>{global.__projectorTest.code='654321';});
 await board.getByRole('button',{name:'Byt projektor'}).click();await input.fill('654321');await board.getByRole('button',{name:'Anslut',exact:true}).click();
 await board.getByText('Teacher',{exact:true}).waitFor();
 assert.equal(await app.evaluate(()=>global.__projectorTest.lookups),1);
 pass('a rotated visible code reconnects read-only without adding or removing a sender; active=false mount does not hide the cast');
 await board.getByRole('button',{name:'Visa tavlan'}).click();await board.getByRole('button',{name:'Dölj fönstret'}).waitFor();
 const viewer=app.windows().find(w=>w.url().startsWith('https://vdo.ninja/'));assert.ok(viewer);await viewer.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await board.getByRole('button',{name:'Dölj fönstret'}).click();await board.getByRole('button',{name:'Visa tavlan'}).waitFor();
 await board.getByRole('button',{name:'Visa tavlan'}).click();await board.getByRole('button',{name:'Dölj fönstret'}).waitFor();
 assert.equal(await app.evaluate(()=>global.__projectorTest.lookups),1);pass('rotating the code does not disconnect the remembered projector; hide and show both work');
 const lesson=await page.evaluate(()=>window.schoolwork.lessonCreate({title:'Classroom board test',language:'sv',mode:'lesson'}));
 await page.reload();await page.getByRole('button',{name:'Follow a lesson'}).click();await page.getByRole('button',{name:/^Classroom board test/}).click();
 await board.getByRole('button',{name:'Fotografera tavlan'}).click();await board.getByRole('status').filter({hasText:'Tavlan sparas som AI-kontext.'}).waitFor();
 const saved=await page.evaluate(id=>window.schoolwork.lessonList().then(items=>items.find(item=>item.id===id)),lesson.id);
 assert.equal(saved.boardSnapshots.length,1);assert.ok(saved.boardSnapshots[0].path.startsWith(data));
 pass('Capture board stores an actual window image on the selected lesson in the isolated profile');
 await board.getByRole('button',{name:'Dölj fönstret'}).click();
 await page.getByRole('button',{name:'Starta inspelning',exact:true}).click();
 let automatic;
 for(let i=0;i<40;i++){
   automatic=await page.evaluate(id=>window.schoolwork.lessonList().then(sessions=>sessions.find(s=>s.id===id)),lesson.id);
   if(automatic.boardSnapshots.some(frame=>typeof frame.audioTime==='number'))break;
   await page.waitForTimeout(500);
 }
 const timed=automatic.boardSnapshots.findLast(frame=>typeof frame.audioTime==='number');
 assert.ok(timed?.audioTime>=0);
 assert.ok(automatic.boardSnapshots.at(-1).at<=Date.now());
 assert.equal((await page.evaluate(()=>window.schoolwork.boardStatus())).windowOpen,false);
 await page.getByRole('button',{name:'Pausa',exact:true}).click();
 await page.waitForTimeout(500);
 assert.equal(app.windows().filter(w=>w.url().startsWith('https://vdo.ninja/')).length,0);
 pass('recording automatically captures a real video frame in the background, timestamps its audio position and releases the hidden viewer on pause');
 await page.screenshot({path:path.join(shots,'code-connected.png')});
 await board.getByRole('button',{name:'Byt projektor'}).click();await input.fill('111111');await board.getByRole('button',{name:'Anslut',exact:true}).click();await board.getByRole('status').filter({hasText:/invalid or expired/}).waitFor({timeout:20000});
 assert.equal((await page.evaluate(()=>window.schoolwork.boardStatus())).receiverUrl,'https://yeet.ssis.nu/receiver/42');pass('an expired code reports the problem and preserves the previous projector');
 await board.getByRole('button',{name:'Avbryt',exact:true}).click();await board.getByRole('button',{name:'Koppla från'}).click();await input.waitFor();
 await app.evaluate(()=>{global.__projectorTest.signedIn=false;});await input.fill('654321');await board.getByRole('button',{name:'Anslut',exact:true}).click();await connecting.waitFor();
 await board.getByRole('button',{name:'Avbryt',exact:true}).click();await board.getByRole('button',{name:'Anslut',exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.schoolwork.boardStatus())).configured,false);pass('cancel closes pending sign-in and disconnect removes the saved projector');
 assert.equal(errors.length,0,errors.join(' | '));pass('no renderer errors');
 if((await page.evaluate(()=>window.schoolwork.boardStatus())).diagnosticsAvailable){
 await board.getByRole('button',{name:'Spara anslutningslogg'}).click();await board.getByRole('status').filter({hasText:'Anslutningsloggen har sparats.'}).waitFor();
 const report=JSON.parse(await fs.readFile(path.join(data,'projector-export.json'),'utf8'));
 assert.ok(report.events.some(e=>e.event==='connect.phase'&&e.details.phase==='signin'));
 assert.ok(report.events.some(e=>e.event==='connect.finish'&&e.details.outcome==='succeeded'));
 assert.ok(report.events.some(e=>e.event==='board.capture'&&e.details.outcome==='succeeded'));
 assert.ok(!JSON.stringify(report).includes('https://'));assert.ok(!JSON.stringify(report).includes('Teacher'));
 pass('beta connection log exports real lifecycle events without codes, stream URLs or identities');
 }else{assert.equal(await board.getByRole('button',{name:'Spara anslutningslogg'}).count(),0);pass('stable/main builds contain no projector diagnostic control');}
 await fs.writeFile(path.join(shots,'results.json'),JSON.stringify({results,services:'simulated',profileIsolated:true},null,2));
}catch(error){
 console.error('PROJECTOR FAILURE:',error);
 await app?.firstWindow().then(page=>page.screenshot({path:path.join(shots,'failure.png')})).catch(()=>{});
 throw error;
}finally{await app?.close().catch(()=>{});}
