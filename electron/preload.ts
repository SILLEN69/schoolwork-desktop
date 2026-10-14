import { contextBridge, ipcRenderer } from "electron";
import {cleanError} from '../src/userError';
async function invoke(channel:string,...args:unknown[]) {
  try{return await ipcRenderer.invoke(channel,...args);}
  catch(error){throw new Error(cleanError(error));}
}
contextBridge.exposeInMainWorld("schoolwork", {
  connectionList:()=>invoke('connections:list'),
  connectionSave:(input:unknown)=>invoke('connections:save',input),
  connectionRemove:(id:string)=>invoke('connections:remove',id),
  connectionTest:(id:string)=>invoke('connections:test',id),
  calendarDrive:(enabled:boolean)=>invoke('calendar:drive',enabled),
  steer: (input:unknown)=>invoke('chat:steer',input),
  getQuestion:(taskId:string)=>invoke('chat:question',taskId),
  answerQuestion:(input:unknown)=>invoke('chat:question-answer',input),
  lessonRefine: (input:unknown)=>invoke('lessons:refine',input),
  lessonChat: (input:unknown)=>invoke('lessons:chat',input),
  calendarCheck: ()=>invoke('calendar:check'),
  calendarImport: ()=>invoke('calendar:import'),
  lessonList: () => invoke('lessons:list'),
  lessonCreate: (input: unknown) => invoke('lessons:create', input),
  lessonUpdate: (input: unknown) => invoke('lessons:update', input),
  lessonEditNotes: (input:unknown)=>invoke('lessons:edit-notes',input),
  lessonDelete: (id: string) => invoke('lessons:delete', id),
  lessonAudio: (input: unknown) => invoke('lessons:audio', input),
  lessonRetry: (input: unknown) => invoke('lessons:retry', input),
  lessonDiscard: (input: unknown) => invoke('lessons:discard', input),
  lessonCancel: (id: string) => invoke('lessons:cancel', id),
  lessonAnalyse: (input: unknown) => invoke('lessons:analyse', input),
  lessonLiveSignal: (input: unknown) => invoke('lessons:live-signal', input),
  lessonLivePrepare: (input: unknown) => invoke('lessons:live-prepare', input),
  lessonLiveStop: (id: string) => invoke('lessons:live-stop', id),
  boardConfigure: (url: string) => invoke('board:configure', url),
  boardCancelConnect: () => invoke('board:cancel-connect'),
  boardDisconnect: () => invoke('board:disconnect'),
  boardStatus: (force=false) => invoke('board:status',force),
  boardExportDiagnostics: () => invoke('board:export-diagnostics'),
  boardOpen: () => invoke('board:open'),
  boardHide: () => invoke('board:hide'),
  boardClose: () => invoke('board:close'),
  boardCapture: (input: unknown) => invoke('board:capture', input),
  boardStopMonitor: () => invoke('board:stop-monitor'),
  calendarStatus: () => invoke('calendar:status'),
  calendarConfigure: (input: unknown) => invoke('calendar:configure', input),
  calendarConnect: () => invoke('calendar:connect'),
  calendarCancelConnect: () => invoke('calendar:cancel-connect'),
  calendarDisconnect: () => invoke('calendar:disconnect'),
  calendarAdd: (input: unknown) => invoke('calendar:add', input),
  updateStatus: () => invoke('updates:status'),
  updateAction: (action: string) => invoke('updates:action',action),
  onUpdate: (callback: (state: any)=>void) => {const listener=(_event:any,state:any)=>callback(state);ipcRenderer.on('updates:state',listener);return ()=>ipcRenderer.removeListener('updates:state',listener);},
  chooseImages: (conversationId: string) =>
    invoke("attachments:choose", conversationId),
  importImage: (input: unknown) =>
    invoke("attachments:import", input),
  readImage: (input: unknown) => invoke("attachments:read", input),
  removeImage: (input: unknown) =>
    invoke("attachments:remove", input),
  setCapabilities: (input: unknown) =>
    invoke("settings:capabilities", input),
  desktopApps: () => invoke("desktop:apps"),
  chooseApplication: () => invoke("desktop:choose-app"),
  desktopWindows: () => invoke("desktop:windows"),
  desktopDisplays: () => invoke("desktop:displays"),
  desktopLessons: () => invoke("desktop:lessons"),
  forgetDesktopLessons: () => invoke("desktop:forget-lessons"),
  telegramConfigure: (input: unknown) =>
    invoke("telegram:configure", input),
  telegramPair: () => invoke("telegram:pair"),
  telegramStatus: () => invoke("telegram:status"),
  telegramDisconnect: () => invoke("telegram:disconnect"),
  telegramTest: () => invoke("telegram:test"),
  captureScreen: (input: unknown) =>
    invoke("desktop:capture", input),
  stopDesktop: () => invoke("desktop:stop"),
  testVision: (model: string) =>
    invoke("models:test-vision", model),
  setFileAccess: (value: "workspace" | "full-user") =>
    invoke("settings:file-access", value),
  inspectProject: (input: unknown) =>
    invoke("project:inspect", input),
  openUrl: (url: string) => invoke("app:open-url", url),
  settingsGet: () => invoke("settings:get"),
  setKey: (key: string) => invoke("settings:set-key", key),
  setModel: (model: string) => invoke("settings:set-model", model),
  setLanguage: (language: "en" | "sv") =>
    invoke("settings:set-language", language),
  setAnimation:(enabled:boolean)=>invoke('settings:set-animation',enabled),
  chooseWorkspace: () => invoke("settings:workspace"),
  listModels: () => invoke("models:list"),
  listChats: (compact = false) => invoke("chat:list", compact),
  getChat: (id: string) => invoke("chat:get", id),
  taskStatus: (id: string) => invoke("chat:status", id),
  getActivity: (id: string) => invoke("chat:activity", id),
  deleteChat: (id: string) => invoke("chat:delete", id),
  openPath: (path: string) => invoke("app:open-path", path),
  send: (payload: {
    chatId: string;
    userText: string;
    model: string;
    clientRequestId?: string;
    attachmentIds?: string[];
  }) => invoke("chat:send", payload),
  cancel: (id: string) => invoke("chat:cancel", id),
  control: (taskId: string, action: "pause" | "resume" | "retry") =>
    invoke("chat:control", { taskId, action }),
  memoryList: () => invoke("memory:list"),
  memorySearch: (query: string) => invoke("memory:search", query),
  memoryGet: (id: string) => invoke("memory:get", id),
  memoryUpdate: (input: {
    noteId: string;
    revision: number;
    changes: Record<string, unknown>;
  }) => invoke("memory:update", input),
  memoryArchive: (id: string) => invoke("memory:archive", id),
  memoryForget: (id: string) => invoke("memory:forget", id),
  memoryGraph: (input?: { noteId?: string; depth?: number }) =>
    invoke("memory:graph", input || {}),
  openVault: () => invoke("memory:open-vault"),
  exportDiagnostics: (taskId: string) =>
    invoke("diagnostics:export", taskId),
  testNotifications:()=>invoke('notifications:test'),
  openNotificationSettings:()=>invoke('notifications:settings'),
  onNotification:(callback:(event:any)=>void)=>{
    const listener=(_event:Electron.IpcRendererEvent,data:unknown)=>callback(data);
    ipcRenderer.on('notifications:event',listener);
    return ()=>ipcRenderer.removeListener('notifications:event',listener);
  },
  onEvent: (callback: (event: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data);
    ipcRenderer.on("chat:event", listener);
    return () => ipcRenderer.removeListener("chat:event", listener);
  },
});
