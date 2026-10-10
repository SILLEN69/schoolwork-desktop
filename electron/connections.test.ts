import {expect,it} from 'vitest';
import http from 'node:http';
import {Connections,connectionUrl} from './connections';
it('rejects insecure remote endpoints and never exposes stored tokens',()=>{
 for(const url of ['http://example.com/mcp','https://user:pass@example.com','https://example.com/?token=secret','file:///x'])expect(()=>connectionUrl(url)).toThrow();
 expect(connectionUrl('http://127.0.0.1:8000/mcp').hostname).toBe('127.0.0.1');
 const values=new Map<string,string>(),c=new Connections({getMetadata:k=>values.get(k),setMetadata:(k,v)=>{values.set(k,v);}},s=>'encrypted:'+s,s=>s.slice(10));
 const saved=c.configure({name:'Test',url:'https://example.com/mcp',token:'private-token'});expect(JSON.stringify(saved)).not.toContain('private-token');expect(saved[0].authenticated).toBe(true);
 c.configure({...saved[0],url:'https://other.example/mcp'});expect(c.list()[0].authenticated).toBe(false);
});
it('uses the real MCP HTTP client, validates arguments and calls an external action exactly once',async()=>{
 let calls=0,seenAuth='';
 const server=http.createServer(async(req,res)=>{
  seenAuth=String(req.headers.authorization||'');if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  let body='';for await(const chunk of req)body+=chunk;const message=JSON.parse(body);
  if(message.id===undefined){res.writeHead(202);res.end();return;}
  let result:any,error:any;
  switch(message.method){
   case 'initialize':result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};break;
   case 'tools/list':result={tools:[{name:'echo',description:'Fixture action',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false}}]};break;
   case 'tools/call':calls++;result={content:[{type:'text',text:message.params.arguments.text}]};break;
   default:error={code:-32601,message:'Unsupported method'};
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,...(error?{error}:{result})}));
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as any,values=new Map<string,string>();
 const c=new Connections({getMetadata:k=>values.get(k),setMetadata:(k,v)=>{values.set(k,v);}},s=>'encrypted:'+s,s=>s.slice(10));
 const id=c.configure({name:'Fixture',url:`http://127.0.0.1:${address.port}/mcp`,token:'fixture-only'})[0].id;
 try{
  expect((await c.tools(id,AbortSignal.timeout(10000)))[0].name).toBe('echo');expect(seenAuth).toBe('Bearer fixture-only');
  await expect(c.call(id,'echo',{text:123},AbortSignal.timeout(10000))).rejects.toThrow(/schema/);expect(calls).toBe(0);
  expect((await c.call(id,'echo',{text:'Hello'},AbortSignal.timeout(10000))).data.content[0].text).toBe('Hello');expect(calls).toBe(1);
  c.remove(id);await expect(c.tools(id,AbortSignal.timeout(10000))).rejects.toThrow(/Enable/);
 }finally{c.stop();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
},30000);
