import {BrowserWindow,screen} from 'electron';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {pointerFrame,pointerPosition,pointerText,type PointerPoint} from './pointerGeometry';

/** Display-only window: no tool APIs, focus, mouse input, or model reasoning. */
export class DesktopPointer {
  private window?:BrowserWindow;
  private ready?:Promise<void>;
  private owner?:string;
  private point?:PointerPoint;
  private explanation='';
  private pendingExplanation?:{owner:string;text:string};
  private generation=0;
  private observations=0;
  private inputHidden=false;
  private reducedMotion=false;
  private ensure() {
    if(this.window&&!this.window.isDestroyed())return this.ready!;
    const win=new BrowserWindow({width:360,height:300,show:false,frame:false,transparent:true,hasShadow:false,focusable:false,skipTaskbar:true,resizable:false,alwaysOnTop:true,title:'SchoolWork AI pointer',webPreferences:{preload:path.join(__dirname,'pointerPreload.js'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
    this.window=win;
    win.setIgnoreMouseEvents(true,{forward:true});win.setAlwaysOnTop(true,'screen-saver');
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',event=>event.preventDefault());
    this.ready=win.loadFile(path.join(__dirname,'desktop-pointer.html')).then(async()=>{
      this.reducedMotion=Boolean(await win.webContents.executeJavaScript("matchMedia('(prefers-reduced-motion: reduce)').matches"));
    });
    return this.ready;
  }
  private draw(pulse=false) {
    const win=this.window;if(!win||win.isDestroyed()||!this.point||this.observations||this.inputHidden)return;
    const frame=pointerFrame(this.point,screen.getDisplayNearestPoint(this.point).bounds);
    win.setBounds(frame.bounds);win.webContents.send('pointer:update',{...frame.cursor,explanation:this.explanation,pulse});
    if(!win.isVisible())win.showInactive();
  }
  explain(owner:string,text:string){
    const clean=pointerText(text);if(!clean)return;this.pendingExplanation={owner,text:clean};
    if(this.owner===owner){this.explanation=clean;this.draw();}
  }
  async beforeInput(owner:string,name:string,args:{x:number;y:number},signal:AbortSignal) {
    const generation=this.generation;signal.throwIfAborted();
    if(this.owner!==owner)this.explanation=this.pendingExplanation?.owner===owner?this.pendingExplanation.text:'';
    this.owner=owner;
    await this.ensure();signal.throwIfAborted();
    if(generation!==this.generation)throw new Error('AI pointer action stopped.');
    this.inputHidden=false;
    const origin=this.point||screen.getCursorScreenPoint();
    const target=['click','scroll'].includes(name)?screen.screenToDipPoint({x:args.x,y:args.y}):origin;
    const duration=this.reducedMotion||(target.x===origin.x&&target.y===origin.y)?0:Math.max(180,Math.min(480,Math.hypot(target.x-origin.x,target.y-origin.y)*.5));
    const began=Date.now();
    while(true) {
      signal.throwIfAborted();if(generation!==this.generation)throw new Error('AI pointer action stopped.');
      const progress=duration===0?1:Math.min(1,(Date.now()-began)/duration);this.point=pointerPosition(origin,target,progress);this.draw();
      if(progress===1)break;
      await delay(20,undefined,{signal});
    }
    // Never cover native hit-testing or include the pointer/bubble in model screenshots.
    this.inputHidden=true;
    await this.hideForObservation(signal);
  }
  async hideForObservation(signal:AbortSignal) {
    if(this.window?.isVisible()){this.window.hide();await delay(35,undefined,{signal});}
    signal.throwIfAborted();
  }
  async observe<T>(signal:AbortSignal,operation:()=>Promise<T>):Promise<T> {
    const generation=this.generation;
    this.observations++;
    try {await this.hideForObservation(signal);return await operation();}
    finally {this.observations--;if(generation===this.generation&&!signal.aborted)this.draw();}
  }
  finished(owner:string,name:string,ok:boolean) {
    if(this.owner!==owner)return;
    this.inputHidden=false;
    this.draw(ok&&name==='click');
  }
  finishTask(owner:string){if(this.pendingExplanation?.owner===owner)this.pendingExplanation=undefined;if(this.owner===owner)this.stop();}
  stop() {
    this.generation++;
    this.pendingExplanation=undefined;
    this.owner=undefined;this.point=undefined;this.explanation='';this.inputHidden=false;
    const win=this.window;this.window=undefined;this.ready=undefined;if(win&&!win.isDestroyed())win.destroy();
  }
}
