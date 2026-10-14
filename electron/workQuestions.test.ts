import {it,expect} from 'vitest';import {WorkQuestions} from './workQuestions';
const question={id:'form_1',sessionID:'sess_1',title:'Questions',operationId:'message:tool',fields:[{key:'q0',type:'string' as const,custom:true}]};
it('persists a response before delivery and replays only the same question operation',async()=>{
 const data=new Map<string,string>();const states:string[]=[];
 const store={getMetadata:(k:string)=>data.get(k),setMetadata:(k:string,v:string)=>{data.set(k,v);},updateTask:(_id:string,s:string)=>states.push(s)};
 const manager=new WorkQuestions(store,()=>{}),task={id:'task'};
 const pending=manager.ask(task,question,new AbortController().signal);expect(states.at(-1)).toBe('waiting_user');
 manager.reply(task,'form_1',{q0:'blue'});expect(await pending).toEqual({q0:'blue'});
 const restarted=new WorkQuestions(store,()=>{});
 expect(await restarted.ask(task,{...question,id:'new_form'},new AbortController().signal)).toEqual({q0:'blue'});
 const cancel=new AbortController();const different=restarted.ask(task,{...question,id:'new_form',operationId:'different'},cancel.signal);cancel.abort();
 await expect(different).rejects.toThrow(/saved/);
 expect(manager.context(task.id)).toContain('blue');
});
it('rejects stale IDs and invalid multi-select shapes without settling the question',async()=>{
 const data=new Map();const manager=new WorkQuestions({getMetadata:k=>data.get(k),setMetadata:(k,v)=>data.set(k,v),updateTask:()=>{}},()=>{});
 const task={id:'task'};const q={...question,fields:[{key:'q0',type:'multiselect' as const}]};const pending=manager.ask(task,q,new AbortController().signal);
 expect(()=>manager.reply(task,'old',{q0:['yes']})).toThrow(/no longer/);
 expect(()=>manager.reply(task,q.id,{q0:'yes'})).toThrow(/format/);
 manager.reply(task,q.id,{q0:['yes']});expect(await pending).toEqual({q0:['yes']});
});
