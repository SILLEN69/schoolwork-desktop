import {it,expect,vi,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';
vi.mock('electron',()=>({BrowserWindow:class extends EventEmitter {
  visible=false;destroyed=false;url='';
  webContents=Object.assign(new EventEmitter(),{session:{setPermissionRequestHandler:vi.fn(),setPermissionCheckHandler:vi.fn(),setDisplayMediaRequestHandler:vi.fn()},setWindowOpenHandler:vi.fn(),getURL:()=>this.url,loadURL:async(url:string)=>{this.url=url;},capturePage:async()=>({isEmpty:()=>false,toJPEG:()=>Buffer.from('jpeg')})});
  setMenuBarVisibility(){}isDestroyed(){return this.destroyed;}isVisible(){return this.visible;}isMinimized(){return false;}
  show(){this.visible=true;}hide(){this.visible=false;}focus(){}destroy(){this.destroyed=true;this.emit('closed');}
}}));
import {Board} from './yeetcast';
function setup(fetcher:typeof fetch, resolver=async(_code:string)=>'https://yeet.ssis.nu/receiver/42') {
  const metadata=new Map<string,string>();
  const store={getMetadata:(key:string)=>metadata.get(key),setMetadata:(key:string,value:string)=>metadata.set(key,value)};
  return {metadata,board:new Board(store as any,'unused-test-capture-root',fetcher,resolver)};
}
const page=(active=true)=>new Response(`<div wire:snapshot='${JSON.stringify({memo:{name:'receiver-screen'},data:{active,connections:active,receiverUri:active?'https://vdo.ninja/?view=abc123':'',senders:[[],{s:'clctn'}]}})}'>`);
afterEach(()=>vi.useRealTimers());
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
