import { it, expect, vi } from 'vitest';
import vm from 'node:vm';
vi.mock('electron',()=>({BrowserWindow:vi.fn()}));
import {projectorJoinScript} from './projectorConnect';
function fixture(values:Record<string,unknown>,valid=true,formError?:string) {
  const calls:string[]=[];
  const cast={
    $get:(key:string)=>values[key],
    $set:async(key:string,value:unknown)=>{calls.push('set:'+key);values[key]=value;},
    $call:async(name:string)=>{calls.push(name);if(name==='checkCode'&&valid){values.receiverId=42;values.senderId=5;}if(name==='deleteSender')values.senderId=0;},
  };
  const window={Livewire:{getByName:()=>[cast]},location:{reload:()=>calls.push('reload')}};
  const context=vm.createContext({window,document:{getElementById:()=>formError?{querySelector:(selector:string)=>({textContent:selector.includes('text-red-600')?formError:'Enter the six-digit code.'})}:null}});
  return {values,calls,run:()=>vm.runInContext(projectorJoinScript('001234'),context)};
}
it('uses the real code action and removes only its own temporary sender',async()=>{
  const f=fixture({nameSet:true,isGuest:false,receiverId:0});
  expect(await f.run()).toEqual({phase:'resolved',id:42});
  expect(f.values.code).toEqual(['0','0','1','2','3','4']);
  expect(f.calls).toEqual(['set:code','checkCode','deleteSender']);
  await f.run();expect(f.calls.length).toBe(3);
});
it('waits for an authorized school identity instead of bypassing guest restrictions',async()=>{
  for(const values of [{nameSet:false},{nameSet:true,isGuest:true,guestCodeSet:false}]){
    const f=fixture(values);expect(await f.run()).toEqual({phase:'signin'});expect(f.calls).toEqual([]);
  }
});
it('reports invalid or expired codes and suspended accounts',async()=>{
  const f=fixture({nameSet:true,isGuest:false,receiverId:0},false);
  expect(await f.run()).toMatchObject({phase:'error',message:expect.stringMatching(/invalid or expired/)});
  const suspended=fixture({suspended:true});expect(await suspended.run()).toMatchObject({phase:'error'});expect(suspended.calls).toEqual([]);
  expect(()=>projectorJoinScript('bad code')).toThrow();
});
it('removes the previous sender before attempting a new code so a stale receiver cannot be accepted',async()=>{
  const f=fixture({nameSet:true,isGuest:false,senderId:9,receiverId:17},false);
  expect(await f.run()).toEqual({phase:'loading'});expect(f.calls).toEqual(['deleteSender','reload']);
});
it('shows the actual school form error instead of the generic instructional paragraph',async()=>{
 const f=fixture({nameSet:true,isGuest:false,receiverId:0},false,'The provided code is invalid');
 expect(await f.run()).toEqual({phase:'error',message:'The provided code is invalid'});
});
