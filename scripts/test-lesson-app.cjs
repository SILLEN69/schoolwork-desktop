// Isolated real Electron app and IPC with simulated remote services. Never uses a personal profile.
const { app, ipcMain, safeStorage, shell } = require('electron');
const fs=require('node:fs'),path=require('node:path');
const data=process.env.SCHOOLWORK_LESSON_TEST_DATA;
if(!data || !path.isAbsolute(data)) throw new Error('Use test:lessons with an isolated test directory.');
app.setPath('userData',data);
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
global.__lessonTest={audioModels:[],summaryRequests:0,calendarWrites:0,modelSaveDelay:0,settingsDelay:0,rejectModel:false,failAudio:false};
shell.openExternal=async(url)=>{if(String(url).startsWith('https://accounts.google.com/')){global.__lessonTest.oauthUrl=url;return;}throw new Error('Unexpected browser launch in isolated test');};
const handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,listener)=>handle(channel,async(...args)=>{
  const state=global.__lessonTest;
  if(channel==='settings:set-model'){await new Promise(r=>setTimeout(r,state.modelSaveDelay));if(state.rejectModel)throw new Error('Simulated save failure');}
  const result=await listener(...args);
  if(channel==='settings:get' && state.settingsDelay) await new Promise(r=>setTimeout(r,state.settingsDelay));
  return result;
});
app.whenReady().then(()=>{
  // Linux CI has no OS keyring. This isolated fixture contains only synthetic credentials.
  if(process.platform==='linux') safeStorage.setUsePlainTextEncryption(true);
  fs.writeFileSync(path.join(data,'schoolwork-settings.json'),JSON.stringify({encryptedKey:safeStorage.encryptString('test-only-not-a-real-credential').toString('base64'),model:'Qwen3.8-27B',workspace:data,language:'en',capabilities:{allApps:false,launchApps:false,viewScreen:false,controlScreen:false,allowedApps:[]}}));
  global.fetch=async(url,init)=>{
    const state=global.__lessonTest;
    if(String(url).endsWith('/audio/transcriptions')){
      state.audioModels.push(init.body.get('model'));
      if(state.failAudio)return new Response('',{status:503});
      const file=init.body.get('file');if(!file || file.size<=44)throw new Error('No actual audio payload');
      return Response.json({text:init.body.get('language')==='sv'?'Gör uppgift 3 nu. Lämna in rapporten den 16 oktober.':'Do exercise three now. Submit the report on 16 October.'});
    }
    if(String(url).endsWith('/chat/completions')){
      state.summaryRequests++;
      const request=JSON.parse(init.body),sv=request.messages[0].content.includes('Swedish');
      const text=JSON.stringify({title:sv?'Algebra · ekvationer':'Algebra · equations',overview:sv?'Vi arbetar med ekvationer och planerar rapporten.':'We are working on equations and planning the report.',sections:[{heading:sv?'Ekvationer':'Equations',points:[sv?'Gör samma operation på båda sidor.':'Apply the same operation to both sides.']}],tasks:[{id:'class-task',title:sv?'Uppgift 3':'Exercise 3',details:sv?'Arbeta med övningen under lektionen.':'Work on the exercise in class.',kind:'lesson',dueDate:null,evidence:sv?'Gör uppgift 3 nu.':'Do exercise three now.'},{id:'assignment',title:sv?'Lämna in rapporten':'Submit the report',details:sv?'Lämna in rapporten efter lektionen.':'Submit the report after the lesson.',kind:'assignment',dueDate:'2026-10-16',evidence:sv?'Lämna in rapporten den 16 oktober.':'Submit the report on 16 October.'}]});
      return new Response('data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
    }
    if(String(url).endsWith('/token'))return Response.json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/calendar.events'});
    if(String(url).includes('www.googleapis.com/calendar/v3/')){state.calendarWrites++;return Response.json({id:JSON.parse(init.body).id,htmlLink:'https://calendar.google.com/calendar/event?eid=test'});}
    if(String(url).endsWith('/revoke'))return new Response('');
    throw new Error('Unexpected external request in isolated lesson test');
  };
  require('../dist-electron/main.js');
});
