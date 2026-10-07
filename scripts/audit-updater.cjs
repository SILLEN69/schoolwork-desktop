const {app}=require('electron');
const path=require('node:path');
const fs=require('node:fs'),os=require('node:os');
const auditData=process.env.SCHOOLWORK_UPDATE_AUDIT_DATA||fs.mkdtempSync(path.join(os.tmpdir(),'schoolwork-update-audit-'));
fs.mkdirSync(auditData,{recursive:true});
app.setPath('userData',auditData);app.setPath('cache',auditData);
app.whenReady().then(async()=>{
  const {NsisUpdater}=require('electron-updater');
  if(process.env.SCHOOLWORK_AUDIT_FROM_VERSION) app.getVersion=()=>process.env.SCHOOLWORK_AUDIT_FROM_VERSION;
  const updater=new NsisUpdater({provider:'github',owner:'SILLEN69',repo:'schoolwork-desktop',private:false});
  if(process.env.SCHOOLWORK_AUDIT_CONFIG)updater.updateConfigPath=process.env.SCHOOLWORK_AUDIT_CONFIG;
  updater.forceDevUpdateConfig=true;
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;
  updater.disableDifferentialDownload=true;
  updater.logger={info:console.log,warn:console.log,error:e=>console.error(String(e).split('\n')[0]),debug:()=>{}};
  updater.on('error',()=>{});
  try {
    const result=await updater.checkForUpdates();console.log('RESULT',result?.updateInfo?.version);
    if(process.env.SCHOOLWORK_AUDIT_DOWNLOAD==='1') {
      const files=await updater.downloadUpdate();
      const crypto=require('node:crypto');
      for(const file of files)console.log('VERIFIED_DOWNLOAD_SHA256',crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
    }
    app.exit(0);
  }
  catch(error){console.log('UPDATE_FAILURE',error.code,String(error.message).slice(0,450));app.exit(1);}
});
