import {afterEach,describe,it,expect} from 'vitest';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runOpenCodeWork,workEngineConfig,workEngineEnvironment} from './openCodeWork';
import {startWorkBridge} from './openCodeBridge';
const cleanup:Array<()=>Promise<void>|void>=[];afterEach(async()=>{for(const fn of cleanup.splice(0).reverse())await fn();});
const tools=[{type:'function',function:{name:'write_file',description:'Write a fixture file.',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content']}}}];
const listen=async(server:http.Server)=>{await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));cleanup.push(()=>{server.closeAllConnections();server.close();});return 'http://127.0.0.1:'+(server.address() as any).port;};
describe('OpenCode work bridge',()=>{
 it('isolates configuration, credentials and project plugins without changing the selected model',()=>{
  const config=workEngineConfig('Exact school ID',{url:'http://127.0.0.1:1234',token:'local-lease'},'SchoolWork instructions');
  expect(config.model).toEqual({providerID:'teachgpt',model:'Exact school ID'});expect(config.share).toBe('disabled');expect(workEngineConfig('text only',{url:'http://127.0.0.1',token:'lease'},'',false).providers.teachgpt.models['text only'].capabilities.input).toEqual(['text']);
  expect(config.permissions).toEqual([{action:'*',resource:'*',effect:'deny'},{action:'schoolwork_*',resource:'*',effect:'allow'},{action:'question',resource:'*',effect:'allow'}]);
  const env=workEngineEnvironment(path.resolve('isolated-engine'),config,'lease-password');
  expect(env.OPENCODE_CONFIG_PROJECT_DISABLE).toBe('1');expect(env).not.toHaveProperty('TEACHGPT_API_KEY');expect(env).not.toHaveProperty('ELECTRON_RUN_AS_NODE');
 });
 it('requires a local lease and deduplicates repeated MCP writes',async()=>{
  let count=0;const bridge=await startWorkBridge({model:'fixture',baseURL:'http://unused',key:()=>'',signal:new AbortController().signal,tools,execute:async()=>({ok:true,data:{count:++count}}),redact:s=>s,activity:()=>{},diagnostic:()=>{},beforeInference:()=>10000});cleanup.push(bridge.close);
  const body=JSON.stringify({jsonrpc:'2.0',id:42,method:'tools/call',params:{name:'write_file',arguments:{path:'a.txt',content:'hello',__sw_operation:'oc-11111111-1111-4111-8111-111111111111'}}});
  expect((await fetch(bridge.url+'/mcp',{method:'POST',body})).status).toBe(401);
  const request=()=>fetch(bridge.url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+bridge.token},body}).then(r=>r.json());
  const [a,b]=await Promise.all([request(),request()]);expect(a).toEqual(b);expect(count).toBe(1);
  expect((await fetch(bridge.url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+bridge.token,Origin:'http://untrusted'},body})).status).toBe(401);
 });
 it('runs the real bundled OpenCode loop, uses the existing school key, and receives an actual MCP tool result',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'schoolwork-opencode-test-'));cleanup.push(()=>fs.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200}));
  let requests=0,writes=0;const seen:any[]=[];
  const provider=http.createServer((request,response)=>{void(async()=>{
   let text='';for await(const chunk of request)text+=chunk;const body=JSON.parse(text);seen.push(body);console.log('TOOLS',body.tools?.map((t:any)=>t.function?.name));expect(request.headers.authorization).toBe('Bearer fixture-school-key');
   response.writeHead(200,{'Content-Type':'text/event-stream'});
   const found=body.messages.some((m:any)=>m.role==='tool');
   const delta=found?{content:'Verified fixture written.'}:{tool_calls:[{index:0,id:'fixture-call-'+(++requests),type:'function',function:{name:'schoolwork_write_file',arguments:JSON.stringify({path:'fixture.txt',content:'hello'})}}]};
   response.end('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:body.model,choices:[{index:0,delta,finish_reason:null}]})+'\n\ndata: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:body.model,choices:[{index:0,delta:{},finish_reason:found?'stop':'tool_calls'}]})+'\n\ndata: [DONE]\n\n');
  })().catch(error=>{response.statusCode=500;response.end(error.message);});});
  const baseURL=await listen(provider);let sessionId='';const events:string[]=[];
  const answer=await runOpenCodeWork({executable:path.resolve('node_modules/@opencode/cli/bin','opencode.exe'),root:path.join(root,'engine'),workspace:root,model:'Qwen3.8-27B',system:'Use SchoolWork tools; write the requested fixture then verify the tool result.',prompt:'Write hello to fixture.txt, then report the actual result.',signal:AbortSignal.timeout(60000),key:()=> 'fixture-school-key',baseURL,tools,redact:s=>s,execute:async(_name,args:any)=>{writes++;await fs.writeFile(path.join(root,args.path),args.content);return {ok:true,summary:'Fixture saved.',data:{path:args.path,content:await fs.readFile(path.join(root,args.path),'utf8')}};},metadata:id=>{sessionId=id;},activity:text=>console.log('ENGINE',text),diagnostic:details=>console.log('METRICS',details),event:(type,data)=>{events.push(type);if(type==='session.tool.failed')console.log('TOOL_ERROR',data);},beforeInference:()=>60000});
  expect(answer).toContain('Verified fixture written');expect(writes).toBe(1);expect(sessionId).toMatch(/^ses/);expect(seen.length).toBeGreaterThanOrEqual(2);expect(seen.every(r=>r.model==='Qwen3.8-27B'&&r.stream===true)).toBe(true);expect(events).toContain('session.execution.succeeded');
 },120000);
});
it('answers an actual OpenCode native question through its form protocol',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sw-question-native-'));cleanup.push(()=>fs.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200}));
 const provider=http.createServer((request,response)=>{void(async()=>{
  let text='';for await(const chunk of request)text+=chunk;const body=JSON.parse(text);
  const answered=body.messages.some((m:any)=>m.role==='tool'&&JSON.stringify(m.content).includes('Blue'));
  const native=body.tools?.some((t:any)=>t.function.name==='question');
  const delta=answered||!native?{content:answered?'The user selected Blue.':'Question task'}:{tool_calls:[{index:0,id:'choose_color',type:'function',function:{name:'question',arguments:JSON.stringify({questions:[{header:'Colour',question:'Choose a colour.',options:[{label:'Blue',description:'Blue theme'},{label:'Green',description:'Green theme'}]}]})}}]};
  response.writeHead(200,{'Content-Type':'text/event-stream'});response.end('data: '+JSON.stringify({choices:[{delta,finish_reason:answered||!native?'stop':'tool_calls'}]})+'\n\ndata: [DONE]\n\n');
 })().catch(e=>{response.statusCode=500;response.end(e.message);});});
 let asked=0;
 const answer=await runOpenCodeWork({executable:path.resolve('node_modules/@opencode/cli/bin','opencode.exe'),root:path.join(root,'engine'),workspace:root,model:'Qwen3.8-27B',system:'Ask the user to choose a colour using question, then report the answer.',prompt:'Let me choose a colour.',signal:AbortSignal.timeout(60000),key:()=> 'fixture-key',baseURL:await listen(provider),tools:[],redact:s=>s,execute:async()=>{throw new Error('No SchoolWork tool should execute');},metadata:()=>{},activity:()=>{},diagnostic:()=>{},event:()=>{},beforeInference:()=>60000,
 question:async q=>{asked++;expect(q.fields[0]).toMatchObject({key:'q0',type:'string',custom:true});return {q0:'Blue'};}});
 expect(asked).toBe(1);expect(answer).toContain('Blue');
},120000);


it('uses a streaming JSON action protocol on the same model when native tools are explicitly unsupported',async()=>{
 let calls=0;const seen:any[]=[];
 const provider=http.createServer((req,res)=>{void(async()=>{let text='';for await(const part of req)text+=part;const body=JSON.parse(text);seen.push(body);calls++;
 if(body.tools){res.writeHead(422,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Native tools are not supported by this model'}}));return;}
 const delta={content:JSON.stringify({action:{tool:'schoolwork_write_file',arguments:{path:'a.txt',content:'hello'}}})};res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{delta,finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
 })().catch(e=>res.destroy(e));});
 const bridge=await startWorkBridge({model:'Exact selected model',baseURL:await listen(provider),key:()=> 'fixture',signal:new AbortController().signal,tools,execute:async()=>{throw new Error('Inference must not execute the action');},redact:s=>s,activity:()=>{},diagnostic:()=>{},beforeInference:()=>10000});cleanup.push(bridge.close);
 const r=await fetch(bridge.url+'/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+bridge.token},body:JSON.stringify({messages:[{role:'user',content:'Write hello'},{role:'assistant',content:'',tool_calls:[{id:'previous',type:'function',function:{name:'schoolwork_read_file',arguments:'{}'}}]},{role:'tool',tool_call_id:'previous',content:'A prior observation'}],tools:[{...tools[0],function:{...tools[0].function,name:'schoolwork_write_file'}}]})});
 const stream=await r.text();expect(calls).toBe(2);expect(seen.every(b=>b.model==='Exact selected model'&&b.stream===true)).toBe(true);expect(seen[1].messages.every((m:any)=>m.role!=='tool'&&!m.tool_calls)).toBe(true);expect(seen[1].messages[0].content).toContain('text action protocol');expect(stream).toContain('schoolwork_write_file');expect(stream).toContain('__sw_operation');expect(stream).toContain('[DONE]');
},20000);
