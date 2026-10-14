// Adapt synthetic provider scenarios to the real OpenCode MCP namespace.
// No production path or remote traffic is bypassed.
module.exports=function wrap(fetcher){
 return async(url,init)=>{
  const engine=new Headers(init?.headers).get('X-SchoolWork-Engine');
  if(engine!=='opencode-v2')return fetcher(url,init);
  const body=JSON.parse(init.body);
  const jsonProtocol=body.messages[0]?.content?.startsWith('You use a text action protocol');
  if(!body.tools?.length&&!jsonProtocol)return new Response('data: '+JSON.stringify({choices:[{delta:{content:'SchoolWork task'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  const names=new Set((body.tools||[]).filter(t=>t.function.name.startsWith('schoolwork_')).map(t=>t.function.name.slice(11)));
  if(body.tools)body.tools=body.tools.map(t=>({...t,function:{...t.function,name:t.function.name.replace(/^schoolwork_/,'')}}));
  body.messages=body.messages.map(message=>({...message,tool_calls:message.tool_calls?.map(call=>({...call,function:{...call.function,name:call.function.name.replace(/^schoolwork_/,'')}}))}));
  const response=await fetcher(url,{...init,body:JSON.stringify(body)});
  if(!response.headers.get('Content-Type')?.includes('text/event-stream'))return response;
  const text=await response.text();
  return new Response(text.split('\n').map(line=>{
   if(!line.startsWith('data: ')||line.includes('[DONE]'))return line;
   const data=JSON.parse(line.slice(6));
   for(const choice of data.choices||[])for(const call of choice.delta?.tool_calls||[])if(names.has(call.function?.name))call.function.name='schoolwork_'+call.function.name;
   return 'data: '+JSON.stringify(data);
  }).join('\n'),{status:response.status,headers:response.headers});
 };
};
