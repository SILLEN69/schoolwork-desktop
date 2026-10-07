import type { UpdateState } from '../src/updateState';

export interface UpdateDriver {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  on(name:string,listener:(value:any)=>void):unknown;
  checkForUpdates():Promise<{cancellationToken?:{cancel():void}}|null>;
  downloadUpdate(token?:any):Promise<unknown>;
  quitAndInstall(silent?:boolean,forceRunAfter?:boolean):void;
}
export function updateFailure(error:unknown,operation:'check'|'download'|'install') {
  const e=error as {code?:string;message?:string};
  const code=String(e?.code||'UPDATE_ERROR');
  const detail=String(e?.message||error);
  const message=/CHANNEL_FILE_NOT_FOUND|LATEST_VERSION_NOT_FOUND|INVALID_UPDATE_INFO|Cannot find latest\.yml/.test(code+' '+detail)
    ? 'The published release is missing valid update files. Use the GitHub download until the release is repaired.'
    : /403|429|rate.?limit/i.test(detail)
    ? 'GitHub is temporarily limiting update checks. Try again later or use the GitHub download.'
    : /ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/i.test(code+' '+detail)
    ? 'Could not reach GitHub. Check your connection and try again.'
    : operation==='download'
    ? 'The update could not be downloaded or verified. Try again or use the GitHub download.'
    : operation==='install'
    ? 'The installer could not start. Try again or use the GitHub download.'
    : 'Update check failed. SchoolWork can still be used. Try again or use the GitHub download.';
  return {code,message,detail};
}
/** Main-process owner of the updater. Renderer never supplies a URL or executable path. */
export class Updates {
  state:UpdateState;
  private token?:{cancel():void};
  private checking=false;
  constructor(private driver:UpdateDriver,version:string,private publish:(state:UpdateState)=>void,private busy:()=>boolean,unsupported?:string,private report:(failure:ReturnType<typeof updateFailure>)=>void=()=>{}) {
    this.state={phase:unsupported?'unsupported':'idle',currentVersion:version,message:unsupported};
    driver.autoDownload=false; driver.autoInstallOnAppQuit=false; driver.allowPrerelease=false; driver.allowDowngrade=false;
    driver.on('update-available',info=>{if(this.state.phase==='checking') this.set({phase:'available',version:info.version,message:undefined});});
    driver.on('update-not-available',()=>{if(this.state.phase==='checking') this.set({phase:'idle',message:'You’re up to date.'});});
    driver.on('download-progress',p=>{if(this.state.phase==='downloading') this.set({percent:Math.max(0,Math.min(100,Math.round(p.percent)))});});
    driver.on('update-downloaded',()=>{if(this.state.phase==='downloading') this.set({phase:'ready',percent:100,message:undefined});});
    driver.on('error',error=>{if(['checking','downloading','installing'].includes(this.state.phase)) this.failed(error,this.state.phase==='checking'?'check':this.state.phase==='downloading'?'download':'install');});
  }
  private set(next:Partial<UpdateState>) {this.state={...this.state,...next};this.publish({...this.state});}
  private isFailed() {return this.state.phase==='error';}
  private failed(error:unknown,operation:'check'|'download'|'install') {const failure=updateFailure(error,operation);this.report(failure);this.set({phase:'error',message:failure.message,errorCode:failure.code});}
  async check(manual=true) {
    if(this.checking || !['idle','error','available'].includes(this.state.phase)) return this.state;
    this.checking=true;
    this.set({phase:'checking',message:undefined,percent:undefined,errorCode:undefined,notify:manual});
    try { const result=await this.driver.checkForUpdates();this.token=result?.cancellationToken; }
    catch(error) {if(!this.isFailed())this.failed(error,'check');}
    finally {this.checking=false;}
    return this.state;
  }
  async download() {
    if(this.state.phase!=='available') return this.state;
    this.set({phase:'downloading',percent:0,message:undefined,errorCode:undefined,notify:true});
    try {await this.driver.downloadUpdate(this.token);} catch(error) {if(!this.isFailed())this.failed(error,'download');}
    return this.state;
  }
  install() {
    if(this.state.phase!=='ready') return this.state;
    if(this.busy()) {this.set({message:'Finish or pause running tasks before restarting to update.'});return this.state;}
    this.set({phase:'installing',message:'Restarting to install the update…'});
    try {this.driver.quitAndInstall(false,true);} catch(error) {this.failed(error,'install');}
    return this.state;
  }
}
