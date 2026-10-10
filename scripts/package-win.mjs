import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {build,Platform,Arch}=require('electron-builder');
const hash=file=>crypto.createHash('sha256').update(readFileSync(file)).digest('hex');
// Refuse to ship a missing or stale helper when cross-building on Linux.
const manifest=JSON.parse(readFileSync('dist-native/build.json','utf8'));
if(manifest.sourceSha256!==hash('native/DesktopBridge.cs') || manifest.binarySha256!==hash('dist-native/SchoolWork.DesktopBridge.exe')) throw new Error('Rebuild the Windows desktop helper before packaging.');
if(process.platform==='linux') {
  // electron-builder already uses this PE/NSIS extractor on macOS where 32-bit Wine
  // cannot run. Its Wine 11 Linux bundle lacks core Windows DLLs, so use the same
  // validated extractor for ONLY the temporary uninstaller-generation stub.
  // The final installer is still compiled by the normal NSIS target.
  const {WineVmManager}=require('app-builder-lib/out/vm/WineVm');
  const {UninstallerReader}=require('app-builder-lib/out/targets/nsis/nsisUtil');
  const original=WineVmManager.prototype.exec;
  WineVmManager.prototype.exec=function(file,args,options,...rest) {
    if(file.endsWith('-setup.exe') && args.length===0 && options?.env?.__COMPAT_LAYER==='RunAsInvoker' && statSync(file).size < 2*1024*1024) {
      const output=path.join(path.dirname(file),path.basename(file,'exe')+'__uninstaller.exe');
      return UninstallerReader.exec(file,output);
    }
    return original.call(this,file,args,options,...rest);
  };
}
await build({targets:Platform.WINDOWS.createTarget(['nsis','portable'],Arch.x64),publish:'never',
  config:process.platform==='win32'?{electronDist:'node_modules/electron/dist'}:undefined});
