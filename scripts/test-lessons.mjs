import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const data=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-lesson-ui-'));
const shots=path.resolve('work/lesson-verification');await fs.mkdir(shots,{recursive:true});
let app;
const results=[];
function pass(text){results.push(text);console.log('PASS:',text);}
// waitForFunction polls synchronous predicates; a Promise is truthy before IPC completes.
async function waitIPC(page,predicate,arg){const until=Date.now()+20000;while(Date.now()<until){if(await page.evaluate(predicate,arg))return;await page.waitForTimeout(100);}throw new Error('IPC state did not reach its acceptance condition.');}
async function launch(){return electron.launch({executablePath:process.platform==='win32'?path.resolve('node_modules/electron/dist/electron.exe'):path.resolve('node_modules/electron/dist/electron'),args:[path.resolve('scripts/test-lesson-app.cjs'),'--user-data-dir='+data,...(process.platform==='linux'?['--no-sandbox']:[])],env:{...process.env,XDG_CACHE_HOME:path.resolve('../.cache'),SCHOOLWORK_LESSON_TEST_DATA:data},timeout:30_000});}
try{
  app=await launch();app.process().stderr.on('data',chunk=>{ void fs.appendFile(path.join(shots,'electron-stderr.log'),chunk); });const page=await app.firstWindow();await page.waitForFunction(()=>Boolean(window.schoolwork));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Settings',exact:false}).last().click();
  const select=page.getByRole('combobox',{name:'Default model'});await select.waitFor();
  await app.evaluate(()=>{global.__lessonTest.modelSaveDelay=1800;global.__lessonTest.settingsDelay=2200;});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await select.selectOption('Meta-Llama-3.3-70B-Instruct-AWQ');assert.equal(await select.inputValue(),'Meta-Llama-3.3-70B-Instruct-AWQ');
  await select.selectOption('gpt-oss-120b-high');assert.equal(await select.inputValue(),'gpt-oss-120b-high');
  await page.waitForFunction(()=>document.querySelector('select[aria-label="Default model"]')?.value==='gpt-oss-120b-high');
  await page.waitForTimeout(4200);assert.equal(await select.inputValue(),'gpt-oss-120b-high');
  assert.equal(await page.evaluate(async()=> (await window.schoolwork.settingsGet()).model),'gpt-oss-120b-high');
  pass('model changes immediately; queued saves and stale settings cannot overwrite the latest selection');
  await app.evaluate(()=>{global.__lessonTest.modelSaveDelay=200;global.__lessonTest.settingsDelay=0;global.__lessonTest.rejectModel=true;});
  await select.selectOption('Qwen3.8-27B');await page.waitForFunction(()=>document.querySelector('select[aria-label="Default model"]')?.value==='gpt-oss-120b-high');
  await page.getByText(/Could not save model:/).first().waitFor();pass('failed model save restores the confirmed model with a visible error');
  await app.evaluate(()=>{global.__lessonTest.rejectModel=false;global.__lessonTest.modelSaveDelay=0;});
  await select.selectOption('Qwen3.8-27B');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Follow a lesson'}).click();
  await page.getByRole('heading',{name:'Be present in the lesson.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Svenska',exact:true}).getAttribute('aria-pressed'),'true');
  await page.screenshot({path:path.join(shots,'lesson-empty.png')});
  await page.getByRole('button',{name:'Start recording',exact:true}).click();await page.getByRole('button',{name:"Pause",exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.lesson-live-error')?.textContent?.includes('Live could not connect'),{},{timeout:20_000});
  assert.ok(await app.evaluate(()=>global.__lessonTest.liveBootstrapRequests>0 && global.__lessonTest.liveSignalRequests>0));
  await page.waitForTimeout(1200);await page.getByRole('button',{name:"Pause",exact:true}).click();
  await waitIPC(page,async()=> (await window.schoolwork.lessonList())[0]?.segments.length===1);
  await page.getByRole('heading',{name:'Algebra · ekvationer'}).waitFor({timeout:15_000});
  assert.deepEqual(await app.evaluate(()=>global.__lessonTest.audioModels),['kb-whisper-large']);
  await page.locator('.lesson-title').fill('Matematik · fredag');await page.locator('.lesson-title').blur();
  assert.equal(await page.getByRole('combobox',{name:"Subject",exact:true}).inputValue(),'Matematik');
  await page.getByRole('button',{name:/^Tasks/}).click();
  await page.getByRole('button',{name:'Complete task: Uppgift 3'}).click();await page.waitForFunction(()=>document.querySelector('.lesson-check')?.getAttribute('aria-pressed')==='true');
  pass('real microphone capture produces a complete WAV; Swedish Whisper, persisted transcript, structured summary and task completion work with simulated service responses');
  pass('live relay failure is visible and does not stop the shared microphone or prevent saved file transcription');
  await page.getByRole('button',{name:"Add to Calendar"}).click();
  assert.equal(await page.locator('input[type="date"]').inputValue(),'2026-10-16');assert.equal(await app.evaluate(()=>global.__lessonTest.calendarWrites),0);
  pass('assignment date is reviewed before any calendar write');
  await page.getByRole('button',{name:"Connect Google Calendar",exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'OAuth client ID',exact:true}).count(),0);
  const googleReady=await page.evaluate(()=>window.schoolwork.calendarStatus());
  if(!googleReady.configured){
    await page.getByRole('button',{name:"Advanced: custom Google app",exact:true}).click();
    await page.getByRole('textbox',{name:'OAuth client ID',exact:true}).fill('123-test.apps.googleusercontent.com');
    await page.getByLabel('OAuth client secret',{exact:true}).fill('test-client-secret');
    await page.getByRole('button',{name:"Save connection settings"}).click();
  } else assert.equal(googleReady.configurationSource,'schoolwork');
  await page.screenshot({path:path.join(shots,'google-sign-in.png')});
  await page.getByRole('button',{name:"Sign in with Google"}).click();
  const auth=new URL(await app.evaluate(()=>global.__lessonTest.oauthUrl)),callback=new URL(auth.searchParams.get('redirect_uri'));
  callback.searchParams.set('state',auth.searchParams.get('state'));callback.searchParams.set('code','test-only-code');
  assert.equal((await fetch(callback)).status,200);await page.getByText("Google account connected",{exact:true}).waitFor();
  await page.locator('.calendar-dialog-layer').getByRole('button',{name:"Close",exact:true}).click();
  await page.getByRole('button',{name:"Confirm and save"}).click();await page.getByRole('button',{name:"Saved in Calendar"}).waitFor();
  assert.equal(await app.evaluate(()=>global.__lessonTest.calendarWrites),1);
  const calendarSession=(await page.evaluate(()=>window.schoolwork.lessonList()))[0];
  await page.evaluate(async s=>window.schoolwork.calendarAdd({id:s.id,taskId:s.analysis.tasks.find(t=>t.kind==='assignment').id,title:'Lämna in rapporten',date:'2026-10-16'}),calendarSession);
  assert.equal(await app.evaluate(()=>global.__lessonTest.calendarWrites),1);
  pass('connected Google OAuth callback, confirmed Calendar write and duplicate-event prevention work through real IPC with simulated Google responses');
  await page.getByRole('button',{name:"Transcript",exact:true}).click();await page.getByRole('button',{name:"Copy text",exact:true}).click();
  await page.waitForTimeout(150);
  assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'Gör uppgift 3 nu. Lämna in rapporten den 16 oktober.');
  pass('transcript copy writes the expected text to the clipboard');
  await page.screenshot({path:path.join(shots,'lesson-active.png')});
  const saved=await page.evaluate(()=>window.schoolwork.lessonList());assert.equal(saved[0].title,'Matematik · fredag');assert.equal(saved[0].analysis.tasks[0].completed,true);
  // Failed audio remains available for retry and does not replace an existing transcript.
  await app.evaluate(()=>{global.__lessonTest.failAudio=true;});
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForTimeout(1200);await page.getByRole('button',{name:"Pause",exact:true}).click();
  await page.getByRole('button',{name:"Retry",exact:true}).waitFor({timeout:15_000});
  await app.evaluate(()=>{global.__lessonTest.failAudio=false;});await page.getByRole('button',{name:"Retry",exact:true}).click();
  await waitIPC(page,async()=>{const s=await window.schoolwork.lessonList();return s[0].segments.length===2 && s[0].pending.length===0;});
  pass('failed audio is retained and can be retried without duplicating previous segments');
  await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForTimeout(1200);await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.lesson-continuous>p')?.textContent.includes('Do exercise three now. Submit the report on 16 October.'));
  const models=await app.evaluate(()=>global.__lessonTest.audioModels);assert.equal(models.at(-1),'faster-whisper-large-v3');pass('English switch uses the multilingual Whisper model while retaining Swedish transcript segments');
  await page.locator('.lesson-assistant input').fill('Explain the lesson');await page.locator('.lesson-assistant form button[type=submit]').click();
  await page.locator('.lesson-assistant').getByText('Fixture answer: Explain the lesson',{exact:true}).waitFor();
  const lessonRequest=await app.evaluate(()=>global.__lessonTest.agentRequests.at(-1));assert(JSON.stringify(lessonRequest).includes('Gör uppgift 3 nu.'));
  pass('lesson questions use the Work agent with saved lesson context');
  await page.getByRole('button',{name:'Notes',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();
  const notesDialog=page.getByRole('dialog',{name:'Edit notes',exact:true});await notesDialog.getByRole('textbox',{name:'Notes',exact:true}).fill('Översikt som eleven har förtydligat.\n\n## Teori\n- U = R × I. Spänning mäts i volt.');await notesDialog.getByRole('button',{name:'Save',exact:true}).click();
  await page.locator('.lesson-summary').getByText('Översikt som eleven har förtydligat.',{exact:true}).waitFor();pass('notes can be edited without losing assignment status');
  await app.evaluate(()=>{global.__lessonTest.summaryHold=true;global.__lessonTest.summaryStarted=false;});
  await page.getByRole('button',{name:'Update summary',exact:true}).click();await waitIPC(page,()=>globalThis.window.schoolwork.lessonList().then(()=>true));
  for(let i=0;i<50&&!await app.evaluate(()=>global.__lessonTest.summaryStarted);i++)await page.waitForTimeout(100);assert(await app.evaluate(()=>global.__lessonTest.summaryStarted));
  await page.getByRole('button',{name:'Svenska',exact:true}).click();await page.getByRole('button',{name:'English',exact:true}).click();
  assert.equal(await page.locator('.lesson-back').isEnabled(),true);await page.locator('.lesson-back').click();await page.getByRole('button',{name:'Follow a lesson'}).waitFor();
  await app.evaluate(()=>{global.__lessonTest.summaryHold=false;});await page.getByRole('button',{name:'Follow a lesson'}).click();await page.getByRole('button',{name:/^Matematik · fredag/}).click();
  assert.equal(await page.getByRole('button',{name:'English',exact:true}).getAttribute('aria-pressed'),'true');pass('changing speech language during a pending summary cancels safely and never locks navigation');
  await page.locator('.lesson-back').click();
  assert.equal(await page.getByRole('button',{name:'Screenshot',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Transcription',exact:true}).count(),0);
  const message=page.getByRole('textbox',{name:'Message',exact:true});await page.getByRole('button',{name:'Dictate',exact:true}).click();await page.getByRole('button',{name:'Finish dictation',exact:true}).waitFor();await page.waitForTimeout(1200);await page.getByRole('button',{name:'Finish dictation',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Message"]')?.value.includes('Do exercise three now.'));
  assert.equal(await page.locator('.user-message').count(),0);await message.fill('Do the fixture task');
  // The in-app completion toast is a "user is away" affordance: while the window
  // has focus the chat already shows the result and no toast is sent. Defocus the
  // window at the main-process level so the fixture task's completion exercises
  // the dismissible-notice path.
  await app.evaluate(()=>{global.__lessonTest.agentTool=true;});await page.locator('.send-btn').click();
  await page.waitForFunction(()=>document.body.textContent.includes('Running node'));
  await message.fill('New context: use blue');await page.locator('.send-btn').click();
  // Playwright's input/click actions focus the real window again. Drop focus
  // only AFTER the final steering click, before the asynchronous tool completes.
  await app.evaluate(()=>global.__lessonTest.blurAllWindows());
  assert.equal(await app.evaluate(()=>global.__lessonTest.mainWindowFocused()),false);
  await page.getByText('Fixture answer: New context: use blue',{exact:true}).waitFor({timeout:20000});
  // A public streamed progress message can arrive before durable completion.
  await waitIPC(page,async()=>{const chats=await window.schoolwork.listChats();return (await window.schoolwork.getChat(chats[0].id)).task?.state==='completed';});
  const steered=await page.evaluate(async()=>{const chats=await window.schoolwork.listChats();return window.schoolwork.getChat(chats[0].id);});
  assert(steered.messages.some(m=>m.role==='tool' && m.content.includes('fixture complete')));assert.equal(steered.task.state,'completed');
  pass('Work dictation fills editable text without sending; guidance arrives during a real tool run without cancelling it');
  await page.screenshot({path:path.join(shots,'work-dictation-steering.png')});
  // Task completion creates a persistent, dismissible notice above the lesson controls.
  // Exercise its real dismiss button before continuing the lesson workflow.
  await page.locator('.task-notice').first().waitFor();
  while(await page.locator('.task-notice').count()) {
    await page.locator('.task-notice .notice-dismiss').first().click();
  }
  await page.waitForFunction(()=>document.querySelectorAll('.task-notice').length===0);
  // The user is back at the app: restore focus for the remaining workflow.
  await app.evaluate(()=>global.__lessonTest.focusAllWindows());
  await page.getByRole('button',{name:'Follow a lesson'}).click();await page.getByRole('button',{name:"New session",exact:true}).click();
  await page.getByRole('button',{name:'Svenska',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.lesson-title')?.value==='New lesson');
  const importId=(await page.evaluate(()=>window.schoolwork.lessonList())).find(s=>s.title==='New lesson' && !s.segments.length).id;
  const wav=Buffer.alloc(44+3200);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(3200,40);
  await page.locator('input[type="file"]').setInputFiles({name:'lesson.wav',mimeType:'audio/wav',buffer:wav});
  await waitIPC(page,async id=> (await window.schoolwork.lessonList()).find(s=>s.id===id)?.segments.length===1,importId);
  const imported=(await page.evaluate(()=>window.schoolwork.lessonList())).find(s=>s.id===importId);assert.equal(imported.mode,'lesson');assert.equal(imported.segments.length,1);assert.equal(imported.segments[0].model,'kb-whisper-large');
  pass('audio-file import uses Swedish Whisper in the lesson workspace');
  await waitIPC(page,async id=>{const s=(await window.schoolwork.lessonList()).find(s=>s.id===id);return s.analysedRevision===s.revision;},importId);
  assert.deepEqual(errors,[]);await app.close();app=await launch();const restored=await app.firstWindow();await restored.getByRole('button',{name:'Follow a lesson'}).waitFor();await restored.getByRole('button',{name:'Follow a lesson'}).click();
  await restored.getByRole('button',{name:/^Matematik · fredag/}).click();await restored.getByRole('button',{name:'Transcript',exact:true}).click();await restored.locator('.lesson-continuous>p').waitFor();assert((await restored.locator('.lesson-continuous>p').textContent()).includes('Do exercise three now. Submit the report on 16 October.'));await restored.getByRole('button',{name:/^Tasks/}).click();
  assert.equal(await restored.getByRole('button',{name:'Complete task: Uppgift 3'}).getAttribute('aria-pressed'),'true');
  pass('lesson history, transcript and completed tasks survive an application restart');
  console.log(`PASS: ${results.length} lesson/model UI checks; remote TeachGPT/Google traffic simulated; real Electron IPC and microphone capture exercised.`);
}catch(error){console.error('LESSON_TEST_FAILURE',error);if(app){const page=await app.firstWindow().catch(()=>null);await page?.screenshot({path:path.join(shots,'failure.png')}).catch(()=>{});console.log('SAVED_SESSION_DIAGNOSTIC',await page?.evaluate(()=>window.schoolwork.lessonList()).catch(()=>[]));}throw error;}
finally{if(app){app.process().kill();await app.close().catch(()=>{});}await fs.rm(data,{recursive:true,force:true});}
// Projector setup is a lesson workflow: keep it behind the existing release
// verification gate, with separate isolated windows and simulated services.
await import('./test-projector.mjs');
