// Real SchoolWork windows/IPC, isolated profile, simulated YeetCast identity and
// code actions. Never contact a real classroom or log in a real school account.
const {app,safeStorage,session,Notification,dialog}=require('electron');
const fs=require('node:fs');const path=require('node:path');
const data=process.env.SCHOOLWORK_PROJECTOR_TEST_DATA;
if(!data)throw new Error('Use the projector verification script.');
app.setPath('userData',data);app.getVersion=()=>require('../package.json').version;
Notification.isSupported=()=>false;
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(data,'projector-export.json')});
const state=global.__projectorTest={signedIn:false,code:'001234',active:true,offline:false,lookups:0,deletes:0,pushLoads:0,joined:0};
app.whenReady().then(()=>{
 if(process.platform==='linux')safeStorage.setUsePlainTextEncryption(true);
 fs.writeFileSync(path.join(data,'schoolwork-settings.json'),JSON.stringify({encryptedKey:safeStorage.encryptString('test-only-not-a-real-credential').toString('base64'),model:'Qwen3.8-27B',workspace:data,language:'en',capabilities:{allApps:false,launchApps:false,viewScreen:false,controlScreen:false,allowedApps:[]}}));
 session.fromPartition('persist:schoolwork-projector-signin').protocol.handle('https',async request=>{
  const url=new URL(request.url);
  if(url.pathname==='/fixture/login'){state.signedIn=true;return Response.json({ok:true});}
  if(url.pathname==='/fixture/check'){state.lookups++;const input=await request.json();if(input.code.join('')!==state.code)return Response.json({receiverId:0});state.joined++;return Response.json({receiverId:42,senderId:5});}
  if(url.pathname==='/fixture/delete'){state.deletes++;state.joined=Math.max(0,state.joined-1);return Response.json({ok:true});}
  if(url.searchParams.has('push')){state.pushLoads++;return new Response('Unexpected push stream');}
  return new Response(`<!doctype html><html><body><h1>School sign-in fixture</h1><button id="signin">Sign in to school</button><form id="connectForm"><p class="text-sm">That code is invalid or expired.</p></form><script>
   const values={nameSet:${state.signedIn},isGuest:false,guestCodeSet:false,receiverId:0,senderId:0};
   const cast={$get:key=>values[key],$set:async(key,value)=>{values[key]=value},$call:async name=>{
    if(name==='checkCode'){Object.assign(values,await(await fetch('/fixture/check',{method:'POST',body:JSON.stringify({code:values.code})})).json());if(values.senderId){const frame=document.createElement('iframe');frame.src='https://vdo.ninja/?push=own-temp-sender';document.body.append(frame);}}
    if(name==='deleteSender'){await fetch('/fixture/delete',{method:'POST'});values.senderId=0;}
   }};
   window.Livewire={getByName:()=>[cast]};document.getElementById('signin').onclick=async()=>{await fetch('/fixture/login');values.nameSet=true;};
  </script></body></html>`,{headers:{'Content-Type':'text/html'}});
 });
 session.fromPartition('schoolwork-board-view').protocol.handle('https',()=>new Response('<html><body style="margin:0;background:#17372a"><video autoplay muted playsinline style="width:100%;height:100%"></video><script>const c=document.createElement("canvas");c.width=1024;c.height=576;const x=c.getContext("2d");function draw(){x.fillStyle="#17372a";x.fillRect(0,0,c.width,c.height);x.fillStyle="white";x.font="48px sans-serif";x.fillText("Classroom board fixture",40,100);x.fillText("x² + y² = z²",40,200);}draw();setInterval(draw,100);document.querySelector("video").srcObject=c.captureStream(10);</script></body></html>',{headers:{'Content-Type':'text/html'}}));
 global.fetch=async(url)=>{
  if(String(url).startsWith('https://teachgpt.ssis.nu/api/v1/models'))return Response.json({data:[{id:'Qwen3.8-27B'}]});
  if(String(url)==='https://yeet.ssis.nu/receiver/42'){
   if(state.offline)throw new Error('Simulated offline');
   return new Response(`<span class="text-6xl tabular-nums">${state.code.slice(0,3)} ${state.code.slice(3)}</span><div wire:snapshot='${JSON.stringify({memo:{name:'ReceiverScreen'},data:{active:false,connections:state.active,receiverUri:state.active?'https://vdo.ninja/?view=teacher-stream':'',senders:[null,{s:'elcln',class:'Illuminate\\Database\\Eloquent\\Collection',modelClass:'App\\Models\\Sender',keys:state.active?[8]:[]}]}})}'>`);
  }
  throw new Error('Unexpected external request in isolated projector fixture.');
 };
 require('../dist-electron/main.js');
});
