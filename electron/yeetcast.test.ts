import {it,expect,vi,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';
const viewerFixture=vi.hoisted(()=>({media:{videoCount:1,readyState:4},loadGate:null as Promise<void>|null,captureGate:null as Promise<void>|null,windows:[] as any[]}));
vi.mock('electron',()=>({BrowserWindow:class extends EventEmitter {
  visible=false;destroyed=false;url='';
  constructor(){super();viewerFixture.windows.push(this);}
  webContents=Object.assign(new EventEmitter(),{session:{setPermissionRequestHandler:vi.fn(),setPermissionCheckHandler:vi.fn(),setDisplayMediaRequestHandler:vi.fn()},setWindowOpenHandler:vi.fn(),getURL:()=>this.url,loadURL:async(url:string)=>{this.url=url;await viewerFixture.loadGate;},executeJavaScript:async()=>viewerFixture.media,capturePage:async()=>{await viewerFixture.captureGate;return {isEmpty:()=>false,toJPEG:()=>Buffer.from('jpeg')};}});
  setMenuBarVisibility(){}isDestroyed(){return this.destroyed;}isVisible(){return this.visible;}isMinimized(){return false;}
  show(){this.visible=true;}hide(){this.visible=false;}focus(){}destroy(){this.destroyed=true;this.emit('closed');}
}}));
import {Board} from './yeetcast';
import fs from 'node:fs/promises';
function setup(fetcher:typeof fetch, resolver=async(_code:string)=>'https://yeet.ssis.nu/receiver/42') {
  const metadata=new Map<string,string>();
  const store={getMetadata:(key:string)=>metadata.get(key),setMetadata:(key:string,value:string)=>metadata.set(key,value)};
  return {metadata,board:new Board(store as any,'unused-test-capture-root',fetcher,resolver)};
}
const page=(active=true)=>new Response(`<div wire:snapshot='${JSON.stringify({memo:{name:'receiver-screen'},data:{active,connections:active,receiverUri:active?'https://vdo.ninja/?view=abc123':'',senders:[[],{s:'clctn'}]}})}'>`);
afterEach(()=>{vi.useRealTimers();viewerFixture.media={videoCount:1,readyState:4};viewerFixture.loadGate=null;viewerFixture.captureGate=null;viewerFixture.windows=[];});
it('reuses a saved receiver with its rotated visible code without joining or deleting a sender',async()=>{
  const resolve=vi.fn(async()=> 'https://yeet.ssis.nu/receiver/42');
  const {board}=setup((async()=>new Response('<span class="tabular-nums">654 321</span>')) as typeof fetch,resolve);
  await board.configure('https://yeet.ssis.nu/receiver/42');
  await board.configure('654321');
  expect(resolve).not.toHaveBeenCalled();expect(board.receiverUrl).toBe('https://yeet.ssis.nu/receiver/42');
});
it('captures a ready shared video in a hidden viewer without stealing focus and stops on pause',async()=>{
  const {board}=setup((async()=>page()) as typeof fetch);await board.configure('123456');
  let at=0;const file=await board.capture(true,value=>at=value);
  try {expect(file).toBeTruthy();expect(at).toBeGreaterThan(0);expect(board.status().windowOpen).toBe(false);
    expect(viewerFixture.windows[0].visible).toBe(false);
    board.stopMonitoring();expect(viewerFixture.windows[0].destroyed).toBe(true);
  } finally {if(file)await fs.unlink(file);board.close();}
});
it('pausing before a background fetch completes cannot create a hidden monitor afterward',async()=>{
  let resolve!:(response:Response)=>void;
  const {board}=setup((()=>new Promise<Response>(r=>resolve=r)) as typeof fetch);
  await board.configure('123456');const pending=board.capture(true);
  board.stopMonitoring();resolve(page());
  await expect(pending).rejects.toThrow(/paused/);expect(viewerFixture.windows).toHaveLength(0);
});
it('resolves the displayed PIN to the real receiver, stores no PIN, and survives code rotation',async()=>{
  const resolve=vi.fn(async()=> 'https://yeet.ssis.nu/receiver/42');const fetcher=vi.fn(async(_url:any)=>page());const {board,metadata}=setup(fetcher as typeof fetch,resolve);
  await board.configure('001 234');expect(resolve).toHaveBeenCalledWith('001234');expect([...metadata.values()]).toEqual(['https://yeet.ssis.nu/receiver/42']);
  expect(await board.refresh()).toMatchObject({configured:true,active:true});
  expect(fetcher.mock.calls[0][0]).toBe('https://yeet.ssis.nu/receiver/42');expect(resolve).toHaveBeenCalledTimes(1);
});
it('clears cached state when switching projector and does not let an old request overwrite the new projector',async()=>{
  let release!:(response:Response)=>void;const old=new Promise<Response>(r=>release=r);
  const fetcher=vi.fn(async(url:any)=>url.endsWith('/1')?old:page(false));const {board}=setup(fetcher as typeof fetch);
  await board.configure('https://yeet.ssis.nu/receiver/1');const refreshing=board.refresh();
  await board.configure('https://yeet.ssis.nu/receiver/2');release(page());await refreshing;
  expect(await board.refresh()).toMatchObject({receiverUrl:'https://yeet.ssis.nu/receiver/2',active:false,viewUrl:null,error:undefined});
});
it('cancelled or failed code resolution preserves the previous projector',async()=>{
  let resolve!:(value:string)=>void;const pending=new Promise<string>(r=>resolve=r);const {board}=setup((async()=>page()) as typeof fetch,()=>pending);
  await board.configure('https://yeet.ssis.nu/receiver/1');const connecting=board.configure('123456');const rejected=expect(connecting).rejects.toThrow(/cancelled/);
  board.cancelConnect();resolve('https://yeet.ssis.nu/receiver/42');await rejected;
  expect(board.status().receiverUrl).toBe('https://yeet.ssis.nu/receiver/1');
});
it('hide/show actually toggles the board window and disconnect clears state',async()=>{
  const {board}=setup((async()=>page()) as typeof fetch);await board.configure('123456');expect(await board.open()).toMatchObject({windowOpen:true});
  expect(board.hide()).toBe(false);expect(board.status().windowOpen).toBe(false);expect(await board.capture()).toBeNull();
  expect(await board.open()).toMatchObject({windowOpen:true});board.disconnect();expect(board.status()).toMatchObject({configured:false,active:false,windowOpen:false,viewUrl:null});
});
it('network failure removes a stale stream and cannot be captured or reopened',async()=>{
  vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValueOnce(page()).mockRejectedValue(new Error('offline'));const {board}=setup(fetcher);
  await board.configure('123456');await board.open();vi.setSystemTime(Date.now()+9000);await board.refresh();
  expect(board.status()).toMatchObject({active:false,viewUrl:null,error:expect.stringMatching(/connection/)});expect(await board.capture()).toBeNull();await expect(board.open()).rejects.toThrow();board.close();
});
it('manual refresh actually bypasses the polling cache',async()=>{
  const fetcher=vi.fn(async()=>page());const {board}=setup(fetcher as typeof fetch);
  await board.configure('123456');await board.refresh();await board.refresh();expect(fetcher).toHaveBeenCalledTimes(1);
  await board.refresh(true);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('disconnect aborts an outstanding receiver request and does not publish stale errors',async()=>{
  let signal!:AbortSignal;
  const fetcher=vi.fn((_url:any,options:any)=>new Promise<Response>((_resolve,reject)=>{signal=options.signal;signal.addEventListener('abort',()=>reject(new Error('aborted')));}));
  const {board}=setup(fetcher as typeof fetch);await board.configure('123456');const pending=board.refresh();board.disconnect();
  expect(signal.aborted).toBe(true);await pending;expect(board.status()).toMatchObject({configured:false,error:undefined});
});
it('a new receiver can refresh without waiting for an abandoned fetch',async()=>{
  let release!:(response:Response)=>void;const old=new Promise<Response>(r=>release=r);
  const {board}=setup((async(url:any)=>url.endsWith('/1')?old:page(false)) as typeof fetch);
  await board.configure('https://yeet.ssis.nu/receiver/1');const first=board.refresh();
  await board.configure('https://yeet.ssis.nu/receiver/2');
  try{expect(await board.refresh()).toMatchObject({receiverUrl:'https://yeet.ssis.nu/receiver/2',active:false});}
  finally{release(page());await first;board.close();}
});
it('disconnect during window load cannot reopen the old viewer',async()=>{
  let release!:()=>void;viewerFixture.loadGate=new Promise<void>(r=>release=r);
  const {board}=setup((async()=>page()) as typeof fetch);await board.configure('123456');const pending=board.open();
  await vi.waitFor(()=>expect(viewerFixture.windows.length).toBe(1));board.disconnect();release();
  await expect(pending).rejects.toThrow(/changed/);expect(board.status()).toMatchObject({configured:false,windowOpen:false});
});
it('does not create a screenshot while the stream has no video frames',async()=>{
  const {board}=setup((async()=>page()) as typeof fetch);await board.configure('123456');await board.open();
  viewerFixture.media={videoCount:1,readyState:0};
  await expect(board.capture()).rejects.toThrow(/video is still connecting/);board.close();
});
it('cannot attach an image captured after a disconnect',async()=>{
  let release!:()=>void;viewerFixture.captureGate=new Promise<void>(r=>release=r);
  const {board}=setup((async()=>page()) as typeof fetch);await board.configure('123456');await board.open();
  const pending=board.capture();await new Promise(r=>setTimeout(r,0));board.disconnect();release();
  expect(await pending).toBeNull();
});
