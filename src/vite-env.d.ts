/// <reference types="vite/client" />
interface Window {
  schoolwork: {
    updateStatus: () => Promise<import('./updateState').UpdateState>;
    updateAction: (action:'check'|'download'|'install') => Promise<import('./updateState').UpdateState>;
    onUpdate: (callback:(state:import('./updateState').UpdateState)=>void) => ()=>void;
    chooseImages: (
      conversationId: string,
    ) => Promise<import("./capabilities").Attachment[]>;
    importImage: (input: {
      conversationId: string;
      name: string;
      base64: string;
    }) => Promise<import("./capabilities").Attachment>;
    readImage: (input: {
      conversationId: string;
      id: string;
    }) => Promise<string>;
    removeImage: (input: {
      conversationId: string;
      id: string;
    }) => Promise<void>;
    setCapabilities: (
      input: import("./capabilities").Capabilities,
    ) => Promise<import("./capabilities").Capabilities>;
    desktopApps: () => Promise<Array<{ appId: string; name: string }>>;
    chooseApplication: () => Promise<
      import("./capabilities").Capabilities | null
    >;
    desktopWindows: () => Promise<import("./capabilities").DesktopWindow[]>;
    desktopDisplays: () => Promise<import("./capabilities").DesktopDisplay[]>;
    desktopLessons: () => Promise<any[]>;
    forgetDesktopLessons: () => Promise<boolean>;
    telegramConfigure: (input: {
      token?: string;
      enabled: boolean;
    }) => Promise<any>;
    telegramPair: () => Promise<{ url: string; expiresAt: number }>;
    telegramStatus: () => Promise<any>;
    telegramDisconnect: () => Promise<any>;
    telegramTest: () => Promise<boolean>;
    captureScreen: (input: {
      conversationId: string;
      windowId?: string;
      displayId?: string;
    }) => Promise<import("./capabilities").Attachment>;
    stopDesktop: () => Promise<import("./capabilities").Capabilities>;
    testVision: (
      model: string,
    ) => Promise<{ status: string; checkedAt: number; detail?: string }>;
    setFileAccess: (value: "workspace" | "full-user") => Promise<string>;
    inspectProject: (input: {
      tool: "list_files" | "read_file" | "find_files";
      args: unknown;
      conversationId?: string;
    }) => Promise<any>;
    openUrl: (url: string) => Promise<void>;
    getActivity: (id: string) => Promise<any[]>;
    settingsGet: () => Promise<any>;
    setKey: (key: string) => Promise<boolean>;
    setModel: (m: string) => Promise<string>;
    setLanguage: (language: "en" | "sv") => Promise<boolean>;
    chooseWorkspace: () => Promise<string | null>;
    listModels: () => Promise<string[]>;
    listChats: (compact?: boolean) => Promise<any[]>;
    getChat: (id: string) => Promise<any>;
    taskStatus: (id: string) => Promise<{ text: string; state: string }>;
    deleteChat: (id: string) => Promise<void>;
    openPath: (p: string) => Promise<void>;
    send: (payload: {
      chatId: string;
      userText: string;
      model: string;
      clientRequestId?: string;
      attachmentIds?: string[];
    }) => Promise<string>;
    cancel: (id: string) => Promise<boolean>;
    control: (
      taskId: string,
      action: "pause" | "resume" | "retry",
    ) => Promise<boolean>;
    memoryList: () => Promise<any[]>;
    memorySearch: (query: string) => Promise<any[]>;
    memoryGet: (id: string) => Promise<any>;
    memoryUpdate: (input: any) => Promise<any>;
    memoryArchive: (id: string) => Promise<any>;
    memoryForget: (id: string) => Promise<boolean>;
    memoryGraph: (input?: any) => Promise<any>;
    openVault: () => Promise<string>;
    exportDiagnostics: (taskId: string) => Promise<string | null>;
    onEvent: (cb: (e: any) => void) => () => void;
  };
}
