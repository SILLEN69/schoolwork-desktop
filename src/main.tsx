import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
import "./ui/style.css";
import "./ui/workspace.css";
import "./ui/messages.css";
if (!window.schoolwork) {
  const key = "schoolwork-preview-chats";
  const desktopOnly = async (): Promise<never> => { throw new Error('Öppna SchoolWork-appen för ljud och Google Calendar. / Open the desktop app for audio and Google Calendar.'); };
  window.schoolwork = {
    lessonList: async () => [], lessonCreate: desktopOnly, lessonUpdate: desktopOnly, lessonDelete: desktopOnly,
    lessonAudio: desktopOnly, lessonRetry: desktopOnly, lessonDiscard: desktopOnly, lessonCancel: desktopOnly, lessonAnalyse: desktopOnly,
    calendarStatus: async () => ({configured:false,connected:false,connecting:false,calendarId:'primary'}),
    calendarConfigure: desktopOnly, calendarConnect: desktopOnly, calendarDisconnect: desktopOnly, calendarAdd: desktopOnly,
    updateStatus: async () => ({phase:'unsupported',currentVersion:'preview',message:'Updates are available in the installed app.'}),
    updateAction: async () => ({phase:'unsupported',currentVersion:'preview'}),
    onUpdate: () => () => {},
    chooseImages: async () => {
      throw new Error("Image attachments require the desktop app.");
    },
    importImage: async () => {
      throw new Error("Image attachments require the desktop app.");
    },
    readImage: async () => "",
    removeImage: async () => {},
    setCapabilities: async () => {
      throw new Error("Desktop control requires the Windows app.");
    },
    desktopApps: async () => [],
    chooseApplication: async () => null,
    desktopWindows: async () => [],
    captureScreen: async () => {
      throw new Error("Screen capture requires the Windows app.");
    },
    desktopDisplays: async () => [],
    desktopLessons: async () => [],
    forgetDesktopLessons: async () => true,
    telegramStatus: async () => ({
      configured: false,
      enabled: false,
      paired: false,
    }),
    telegramConfigure: async () => {
      throw new Error("Telegram requires the Windows app.");
    },
    telegramPair: async () => {
      throw new Error("Telegram requires the Windows app.");
    },
    telegramDisconnect: async () => ({}),
    telegramTest: async () => false,
    stopDesktop: async () => ({
      allApps: false,
      launchApps: false,
      viewScreen: false,
      controlScreen: false,
      allowedApps: [],
    }),
    testVision: async () => ({
      status: "unknown",
      checkedAt: Date.now(),
      detail: "Use the Windows app to test TeachGPT vision.",
    }),
    setFileAccess: async () => {
      throw new Error("Open the desktop application to change file access.");
    },
    inspectProject: async () => {
      throw new Error("File navigation requires the desktop application.");
    },
    openUrl: async (url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    getActivity: async () => [],
    taskStatus: async () => ({
      state: "idle",
      text: "Task status is available in the desktop app.",
    }),
    settingsGet: async () => ({
      model: localStorage.getItem("schoolwork-preview-model") || "Qwen3.8-27B",
      workspace: "Browser preview · desktop bridge unavailable",
      configured: false,
      language: "en",
    }),
    setKey: async () => {
      throw new Error(
        "Configure the API key in the desktop application, where it can be encrypted by Windows.",
      );
    },
    setModel: async (m: string) => { localStorage.setItem("schoolwork-preview-model",m); return m; },
    setLanguage: async () => true,
    chooseWorkspace: async () => "Choose a folder in the desktop application.",
    listModels: async () => {
      throw new Error(
        "Model discovery is available in the desktop application.",
      );
    },
    listChats: async () => JSON.parse(localStorage.getItem(key) || "[]"),
    getChat: async (id: string) => ({
      id,
      messages:
        JSON.parse(localStorage.getItem(key) || "[]").find(
          (x: any) => x.id === id,
        )?.messages || [],
    }),
    deleteChat: async (id: string) =>
      localStorage.setItem(
        key,
        JSON.stringify(
          JSON.parse(localStorage.getItem(key) || "[]").filter(
            (x: any) => x.id !== id,
          ),
        ),
      ),
    openPath: async () => {},
    send: async () => {
      throw new Error(
        "This browser preview does not have the desktop tool bridge. Launch SchoolWork with npm start to connect to TeachGPT.",
      );
    },
    cancel: async () => true,
    control: async () => true,
    memoryList: async () => [],
    memorySearch: async () => [],
    memoryGet: async () => null,
    memoryUpdate: async () => null,
    memoryArchive: async () => null,
    memoryForget: async () => true,
    memoryGraph: async () => ({ nodes: [], edges: [] }),
    openVault: async () => "",
    exportDiagnostics: async () => null,
    onEvent: () => () => {},
  };
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
