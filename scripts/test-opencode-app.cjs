// Isolated real SchoolWork + real bundled OpenCode. Only TeachGPT responses are simulated.
const {app,safeStorage,Notification}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const data=process.env.SCHOOLWORK_OPENCODE_TEST_DATA;if(!data)throw new Error('Use the isolated OpenCode verification harness.');
app.setPath('userData',data);app.getVersion=()=>require('../package.json').version;Notification.isSupported=()=>false;
global.__openCodeTest={requests:0,operations:[],hold:false,question:false};
const realFetch=global.fetch;
global.fetch=async(url,init)=>{
 if(!String(url).startsWith('https://teachgpt.ssis.nu/api/v1/'))return realFetch(url,init);
 if(String(url).endsWith('/models'))return Response.json({data:[{id:'Qwen3.8-27B'}]});
 const body=JSON.parse(init.body);const state=global.__openCodeTest;state.requests++;
 const native=body.tools?.some(t=>t.function.name.startsWith('schoolwork_'));
 const results=body.messages.filter(m=>m.role==='tool');
 fs.appendFileSync(path.join(data,'provider-events.jsonl'),JSON.stringify({bytes:Buffer.byteLength(init.body),tools:body.tools?.length,roles:body.messages.map(m=>m.role),lastTool:results.at(-1),lastUser:body.messages.filter(m=>m.role==='user').at(-1)})+'\n');
 let delta,reason='stop';
 if(!native)delta={content:'Fixture title'};
 else if(state.question){const answered=results.some(m=>JSON.stringify(m.content).includes('Blue'));delta=answered?{content:'The user selected Blue.'}:{tool_calls:[{index:0,id:'colour-choice',type:'function',function:{name:'question',arguments:JSON.stringify({questions:[{header:'Colour',question:'Choose a colour.',options:[{label:'Blue',description:'Blue theme'},{label:'Green',description:'Green theme'}]}]})}}]};reason=answered?'stop':'tool_calls';}
 else if(!results.length){delta={tool_calls:[{index:0,id:'first-'+state.requests,type:'function',function:{name:'schoolwork_write_file',arguments:JSON.stringify({path:'checked.js',content:'module.exports = 42;\n'})}}]};reason='tool_calls';state.operations.push('write');}
 else if(!results.some(m=>JSON.stringify(m).includes('Process exited 0'))){
  if(state.hold)return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(': waiting\n\n'));init.signal?.addEventListener('abort',()=>controller.error(new Error('Stopped')),{once:true});}}),{headers:{'Content-Type':'text/event-stream'}});
  delta={tool_calls:[{index:0,id:'check-'+state.requests,type:'function',function:{name:'schoolwork_run_process',arguments:JSON.stringify({executable:'node',args:['-e',"require('node:assert/strict').equal(require('./checked.js'),42)"],purpose:'test'})}}]};reason='tool_calls';state.operations.push('check');
 }else delta={content:'Created checked.js and verified that it exports 42.'};
 const chunk=(delta,finish_reason)=>({id:'fixture-'+state.requests,object:'chat.completion.chunk',created:1,model:body.model,choices:[{index:0,delta,finish_reason}]});
 return new Response('data: '+JSON.stringify(chunk(delta,null))+'\n\ndata: '+JSON.stringify(chunk({},reason))+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
};
app.whenReady().then(()=>{
 if(process.platform==='linux')safeStorage.setUsePlainTextEncryption(true);
 fs.writeFileSync(path.join(data,'schoolwork-settings.json'),JSON.stringify({encryptedKey:safeStorage.encryptString('fixture-not-a-real-key').toString('base64'),model:'Qwen3.8-27B',workspace:data,language:'en',capabilities:{allApps:false,launchApps:false,viewScreen:false,controlScreen:false,allowedApps:[]}}));
 require('../dist-electron/main.js');
});
