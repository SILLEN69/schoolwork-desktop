import {spawn,type ChildProcess} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {OpenCode} from '@opencode/client';
import {startWorkBridge,type WorkTool} from './openCodeBridge';
import {workQuestionSchema,validateWorkAnswer,type WorkQuestion,type WorkAnswer} from '../src/workQuestion';

export const OPENCODE_VERSION='2.0.28';
export function workEngineConfig(model:string,bridge:{url:string;token:string},system:string,vision=true) {
 const permissions=[{action:'*',resource:'*',effect:'deny'},{action:'schoolwork_*',resource:'*',effect:'allow'},{action:'question',resource:'*',effect:'allow'}];
 return {share:'disabled',update:'disable',warming:false,snapshots:false,lsp:false,formatter:false,
  model:{providerID:'teachgpt',model},default_agent:'schoolwork',permissions,
  providers:{teachgpt:{name:'TeachGPT',package:'@opencode/ai/providers/openai-compatible',settings:{baseURL:bridge.url+'/v1',apiKey:bridge.token,timeout:false,headerTimeout:30000,chunkTimeout:650000},models:{[model]:{name:model,capabilities:{tools:true,input:vision?['text','image']:['text'],output:['text']},limit:{context:65536,input:12000,output:32768}}}}},
  agents:{schoolwork:{mode:'primary',system,steps:150,model:{providerID:'teachgpt',model},permissions}},
  mcp:{timeout:{startup:30000,catalog:30000,execution:650000},servers:{schoolwork:{type:'remote',url:bridge.url+'/mcp',headers:{Authorization:'Bearer '+bridge.token},oauth:false,codemode:false,protocol:'legacy'}}},
 };
}
export function workEngineEnvironment(root:string,config:unknown,password:string) {
 const inherited=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','PATH','PATHEXT','APPDATA','LOCALAPPDATA','HOME','LANG','PSModulePath'].filter(k=>process.env[k]).map(k=>[k,process.env[k]!]));
 return {...inherited,HOME:path.join(root,'home'),USERPROFILE:path.join(root,'home'),XDG_CONFIG_HOME:path.join(root,'config'),XDG_DATA_HOME:path.join(root,'data'),XDG_CACHE_HOME:path.join(root,'cache'),XDG_STATE_HOME:path.join(root,'state'),OPENCODE_CONFIG_DIR:path.join(root,'config','opencode'),OPENCODE_CONFIG_CONTENT:JSON.stringify(config),OPENCODE_CONFIG_PROJECT_DISABLE:'1',OPENCODE_DISABLE_MODELS_FETCH:'1',OPENCODE_FILEWATCHER_DISABLE:'1',OPENCODE_PASSWORD:password};
}
function killOwnedTree(child:ChildProcess){if(!child.pid)return;if(process.platform==='win32'){const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});killer.on('error',()=>child.kill());}else{try{process.kill(-child.pid,'SIGTERM');}catch{child.kill();}}}
type RunOptions = {
 executable:string;root:string;workspace:string;model:string;system:string;prompt:string;sessionId?:string;
 signal:AbortSignal;key:()=>string;baseURL:string;tools:WorkTool[];redact:(text:string)=>string;
 execute:(name:string,args:unknown,callId:string)=>Promise<any>;
 metadata:(sessionId:string)=>void;activity:(text:string)=>void;diagnostic:(details:Record<string,unknown>)=>void;
 event:(type:string,data:any)=>void;beforeInference:()=>number;
 localFetch?:typeof fetch;
 question?:(question:WorkQuestion)=>Promise<WorkAnswer|null>;
 files?:Array<{uri:string;name?:string}>;vision?:boolean;
 steering?:{pending:()=>Promise<Array<{id:string;text:string;files?:Array<{uri:string;name?:string}>}>>;delivered:(id:string)=>void};
};
/** OpenCode owns context, compaction, planning and tool orchestration. SchoolWork
 * supplies its Windows/desktop/connection tools over an authenticated MCP lease. */
export async function runOpenCodeWork(options:RunOptions):Promise<string> {
 options.signal.throwIfAborted();await fs.mkdir(path.join(options.root,'home'),{recursive:true});
 await fs.access(options.executable).catch(()=>{throw new Error('The bundled OpenCode runtime is missing. Rebuild or reinstall this beta; no separate OpenCode setup is required.');});
 const bridge=await startWorkBridge(options);const password=crypto.randomBytes(32).toString('base64url');
 const config=workEngineConfig(options.model,bridge,options.system,options.vision!==false);
 const child=spawn(options.executable,['serve','--stdio','--hostname','127.0.0.1','--port','0'],{cwd:options.workspace,env:workEngineEnvironment(options.root,config,password),windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
 let stderr='';child.stderr!.on('data',data=>{stderr=(stderr+data.toString()).slice(-1800);});
 let client:ReturnType<typeof OpenCode.make>|undefined;let sessionId=options.sessionId;
 const eventsAbort=new AbortController();
 const cancel=()=>{eventsAbort.abort();void client?.session.interrupt({sessionID:sessionId!}).catch(()=>{});child.stdin!.end();killOwnedTree(child);};
 options.signal.addEventListener('abort',cancel,{once:true});
 try{
  const endpoint=await new Promise<string>((resolve,reject)=>{
   let pending='';const timer=setTimeout(()=>reject(new Error('OpenCode did not start within 30 seconds.')),30000);
   const done=(error?:Error,value?:string)=>{clearTimeout(timer);child.stdout!.removeListener('data',read);error?reject(error):resolve(value!);};
   const read=(data:Buffer)=>{pending+=data.toString();if(pending.length>20000){done(new Error('Unexpected OpenCode startup output.'));return;}let lineEnd;while((lineEnd=pending.indexOf('\n'))>=0){const line=pending.slice(0,lineEnd);pending=pending.slice(lineEnd+1);try{const item=JSON.parse(line);const url=new URL(item.url);if(url.hostname==='127.0.0.1'&&url.protocol==='http:')done(undefined,url.origin);}catch{/* Not a readiness line. */}}};
   child.stdout!.on('data',read);child.once('error',error=>done(error));child.once('exit',()=>done(new Error('OpenCode stopped during startup: '+options.redact(stderr).slice(-500))));
   if(options.signal.aborted)done(new Error('Task stopped.'));
  });
  child.stdout!.resume();options.activity('OpenCode is ready; opening the saved work session…');
  client=OpenCode.make({baseUrl:endpoint,fetch:options.localFetch,headers:{Authorization:'Basic '+Buffer.from('opencode:'+password).toString('base64')}});
  const bootstrapSignal=AbortSignal.any([options.signal,AbortSignal.timeout(30000)]);
  const health=await client.server.info({signal:bootstrapSignal});
  if(health.version!==OPENCODE_VERSION)throw new Error('Bundled OpenCode version differs from its client.');
  if(sessionId){await client.session.get({sessionID:sessionId},{signal:bootstrapSignal});await client.session.switchModel({sessionID:sessionId,model:{providerID:'teachgpt',id:options.model}},{signal:bootstrapSignal});}
  else{const session=await client.session.create({location:{directory:options.workspace},agent:'schoolwork',model:{providerID:'teachgpt',id:options.model}},{signal:bootstrapSignal});sessionId=session.id;options.metadata(sessionId);}
  // V2 starts MCP discovery in the background. Do not admit the first prompt
  // while its catalog is empty (a real first-use race, not an inference failure).
  while(true){
   const servers=await client.mcp.list({location:{directory:options.workspace}},{signal:bootstrapSignal});
   const school=servers.data.find(s=>s.name==='schoolwork');
   if(school?.status.status==='connected')break;
   if(school&&['failed','disabled','needs_auth'].includes(school.status.status))throw new Error('The local SchoolWork tool connection could not start. Retry the task.');
   await new Promise(resolve=>setTimeout(resolve,100));bootstrapSignal.throwIfAborted();
  }
  // The pinned runtime coalesces catalog registration over a 100ms debounce.
  await new Promise(resolve=>setTimeout(resolve,150));bootstrapSignal.throwIfAborted();
  options.activity('OpenCode work session connected.');
  let answer='';let executionError='';let completed=false;
  const queuedInputs=new Map<string,string>();let sending=false,submissions=0;
  const toolInputs=new Map<string,{name:string;text:string}>();
  const invalidRepeats=new Map<string,number>();
  const flushSteering=async()=>{
   if(sending||!options.steering||options.signal.aborted)return;sending=true;
   try{for(const input of await options.steering.pending()){
    const id='msg_'+input.id.replaceAll('-','');if(queuedInputs.has(id))continue;queuedInputs.set(id,input.id);
    try{await client!.session.prompt({sessionID:sessionId!,id,text:options.redact(input.text),files:input.files,delivery:'steer',resume:true},{signal:options.signal});submissions++;}
    catch(error){queuedInputs.delete(id);throw error;}
   }}finally{sending=false;}
  };
  let finish!:()=>void;let reject!: (error:Error)=>void;
  const completion=new Promise<void>((resolve,rejection)=>{finish=resolve;reject=rejection;});
  void completion.catch(()=>{});
  const consume=(async()=>{
   try{for await(const event of client!.event.subscribe({signal:eventsAbort.signal})){
    const item=event as any;if((item.data?.sessionID||item.data?.form?.sessionID)!==sessionId)continue;
    if(item.type==='session.tool.input.started')toolInputs.set(item.data.id,{name:item.data.name,text:''});
    if(item.type==='session.tool.input.ended'){const input=toolInputs.get(item.data.id);if(input)input.text=item.data.text.replace(/"__sw_operation"\s*:\s*"[^"]*"/g,'"__sw_operation":"operation"');}
    if(item.type==='session.tool.failed'&&item.data.executed===false){
     const input=toolInputs.get(item.data.id);const signature=JSON.stringify(input||item.data.error);
     const count=(invalidRepeats.get(signature)||0)+1;invalidRepeats.set(signature,count);
     if(count>=3){reject(new Error('The model repeated an invalid action three times. Progress is saved; revise the request or retry.'));break;}
    }
    if(item.type==='session.tool.success')invalidRepeats.clear();
    if(item.type==='form.created'){
     const form=item.data.form;
     if(form.metadata?.kind!=='question'||!options.question){
      await client!.session.form.cancel({sessionID:sessionId!,formID:form.id,message:'This client cannot grant permissions through a form. Use the configured SchoolWork tools.'},{signal:options.signal});
     }else{
      const source=form.metadata?.tool;
      const question=workQuestionSchema.parse({...form,operationId:source?source.messageID+':'+source.id:undefined});
      // Do not block event consumption while the user answers.
      void options.question(question).then(async answer=>{
       if(answer===null)await client!.session.form.cancel({sessionID:sessionId!,formID:form.id,message:'The user skipped this question. Continue using safe defaults when possible.'},{signal:options.signal});
       else await client!.session.form.reply({sessionID:sessionId!,formID:form.id,answer:validateWorkAnswer(question,answer)},{signal:options.signal});
      }).catch(error=>{if(!options.signal.aborted)reject(error);});
     }
    }
    options.event(item.type,item.data);
    if(item.type==='session.inbox.delivered'){const id=queuedInputs.get(item.data.inboxID);if(id){queuedInputs.delete(item.data.inboxID);options.steering?.delivered(id);}}
    if(item.type==='session.execution.started'){completed=false;executionError='';}
    if(item.type==='session.text.ended'){answer=item.data.text;}
    if(item.type==='session.execution.failed'){executionError=options.redact(item.data.error?.message||'OpenCode task failed.');completed=true;finish();}
    if(item.type==='session.execution.succeeded'){completed=true;finish();}
    if(item.type==='session.execution.interrupted'){executionError='OpenCode saved an interrupted task. Resume to continue.';completed=true;finish();}
   }if(!completed&&!options.signal.aborted)reject(new Error('OpenCode event connection ended before task completion.'));
   }catch(error:any){if(!options.signal.aborted)reject(error);}
  })();
  const exit=()=>{if(!completed)reject(new Error('OpenCode exited before completing the task.'));};child.once('exit',exit);
  const abort=()=>reject(new Error('Task stopped.'));options.signal.addEventListener('abort',abort,{once:true});
  const steerTimer=setInterval(()=>{void flushSteering().catch(error=>reject(error));},500);
  try{
   await client.session.prompt({sessionID:sessionId,text:options.prompt,files:options.files,delivery:'steer',resume:true},{signal:options.signal});
   while(true){await flushSteering();const before=submissions;await client.session.wait({sessionID:sessionId},{signal:options.signal});await flushSteering();if(before===submissions)break;}
   await completion;options.signal.throwIfAborted();if(executionError)throw new Error(executionError);
   const messages=await client.message.list({sessionID:sessionId,order:'desc',limit:10},{signal:options.signal});
   const latest=messages.data.find(m=>m.type==='assistant');
   if(latest?.type==='assistant')answer=latest.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');
   if(!answer.trim())throw new Error('OpenCode finished without a public answer. Progress is saved; retry this task.');
   return options.redact(answer);
  }finally{clearInterval(steerTimer);options.signal.removeEventListener('abort',abort);child.removeListener('exit',exit);eventsAbort.abort();await consume.catch(()=>{});}
 }finally{
  options.signal.removeEventListener('abort',cancel);eventsAbort.abort();
  if(client&&sessionId)await client.session.interrupt({sessionID:sessionId},{signal:AbortSignal.timeout(3000)}).catch(()=>{});
  child.stdin!.end();killOwnedTree(child);bridge.close();
 }
}
