import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("schoolwork", {
  chooseImages: (conversationId: string) =>
    ipcRenderer.invoke("attachments:choose", conversationId),
  importImage: (input: unknown) =>
    ipcRenderer.invoke("attachments:import", input),
  readImage: (input: unknown) => ipcRenderer.invoke("attachments:read", input),
  removeImage: (input: unknown) =>
    ipcRenderer.invoke("attachments:remove", input),
  setCapabilities: (input: unknown) =>
    ipcRenderer.invoke("settings:capabilities", input),
  desktopApps: () => ipcRenderer.invoke("desktop:apps"),
  chooseApplication: () => ipcRenderer.invoke("desktop:choose-app"),
  desktopWindows: () => ipcRenderer.invoke("desktop:windows"),
  desktopDisplays: () => ipcRenderer.invoke("desktop:displays"),
  desktopLessons: () => ipcRenderer.invoke("desktop:lessons"),
  forgetDesktopLessons: () => ipcRenderer.invoke("desktop:forget-lessons"),
  telegramConfigure: (input: unknown) =>
    ipcRenderer.invoke("telegram:configure", input),
  telegramPair: () => ipcRenderer.invoke("telegram:pair"),
  telegramStatus: () => ipcRenderer.invoke("telegram:status"),
  telegramDisconnect: () => ipcRenderer.invoke("telegram:disconnect"),
  telegramTest: () => ipcRenderer.invoke("telegram:test"),
  captureScreen: (input: unknown) =>
    ipcRenderer.invoke("desktop:capture", input),
  stopDesktop: () => ipcRenderer.invoke("desktop:stop"),
  testVision: (model: string) =>
    ipcRenderer.invoke("models:test-vision", model),
  setFileAccess: (value: "workspace" | "full-user") =>
    ipcRenderer.invoke("settings:file-access", value),
  inspectProject: (input: unknown) =>
    ipcRenderer.invoke("project:inspect", input),
  openUrl: (url: string) => ipcRenderer.invoke("app:open-url", url),
  settingsGet: () => ipcRenderer.invoke("settings:get"),
  setKey: (key: string) => ipcRenderer.invoke("settings:set-key", key),
  setModel: (model: string) => ipcRenderer.invoke("settings:set-model", model),
  setLanguage: (language: "en" | "sv") =>
    ipcRenderer.invoke("settings:set-language", language),
  chooseWorkspace: () => ipcRenderer.invoke("settings:workspace"),
  listModels: () => ipcRenderer.invoke("models:list"),
  listChats: () => ipcRenderer.invoke("chat:list"),
  getChat: (id: string) => ipcRenderer.invoke("chat:get", id),
  taskStatus: (id: string) => ipcRenderer.invoke("chat:status", id),
  getActivity: (id: string) => ipcRenderer.invoke("chat:activity", id),
  deleteChat: (id: string) => ipcRenderer.invoke("chat:delete", id),
  openPath: (path: string) => ipcRenderer.invoke("app:open-path", path),
  send: (payload: {
    chatId: string;
    userText: string;
    model: string;
    clientRequestId?: string;
    attachmentIds?: string[];
  }) => ipcRenderer.invoke("chat:send", payload),
  cancel: (id: string) => ipcRenderer.invoke("chat:cancel", id),
  control: (taskId: string, action: "pause" | "resume" | "retry") =>
    ipcRenderer.invoke("chat:control", { taskId, action }),
  memoryList: () => ipcRenderer.invoke("memory:list"),
  memorySearch: (query: string) => ipcRenderer.invoke("memory:search", query),
  memoryGet: (id: string) => ipcRenderer.invoke("memory:get", id),
  memoryUpdate: (input: {
    noteId: string;
    revision: number;
    changes: Record<string, unknown>;
  }) => ipcRenderer.invoke("memory:update", input),
  memoryArchive: (id: string) => ipcRenderer.invoke("memory:archive", id),
  memoryForget: (id: string) => ipcRenderer.invoke("memory:forget", id),
  memoryGraph: (input?: { noteId?: string; depth?: number }) =>
    ipcRenderer.invoke("memory:graph", input || {}),
  openVault: () => ipcRenderer.invoke("memory:open-vault"),
  exportDiagnostics: (taskId: string) =>
    ipcRenderer.invoke("diagnostics:export", taskId),
  onEvent: (callback: (event: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data);
    ipcRenderer.on("chat:event", listener);
    return () => ipcRenderer.removeListener("chat:event", listener);
  },
});
