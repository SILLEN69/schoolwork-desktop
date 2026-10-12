import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('schoolworkPointer',{subscribe:(listener:(state:unknown)=>void)=>{
  const receive=(_event:unknown,state:unknown)=>listener(state);
  ipcRenderer.on('pointer:update',receive);return()=>ipcRenderer.removeListener('pointer:update',receive);
}});
