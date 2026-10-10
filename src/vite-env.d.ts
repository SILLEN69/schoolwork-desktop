/// <reference types="vite/client" />
interface Window {
  schoolwork: {
    connectionList:()=>Promise<any[]>;
    connectionSave:(input:{id?:string;name:string;url:string;token?:string;enabled:boolean})=>Promise<any[]>;
    connectionRemove:(id:string)=>Promise<any[]>;
    connectionTest:(id:string)=>Promise<any[]>;
    calendarDrive:(enabled:boolean)=>Promise<import('./lesson').CalendarStatus>;
    steer: (input:{taskId:string;chatId:string;userText:string;clientRequestId:string;attachmentIds?:string[]})=>Promise<string>;
    lessonRefine: (input:{id:string;model:string})=>Promise<import('./lesson').LessonSession>;
    lessonChat: (input:{id:string;model:string;question:string})=>Promise<{chatId:string;taskId:string}>;
    calendarCheck: ()=>Promise<import('./lesson').CalendarStatus>;
    calendarImport: ()=>Promise<import('./lesson').CalendarStatus|null>;
    lessonList: () => Promise<import('./lesson').LessonSession[]>;
    lessonCreate: (input: {mode:'lesson'|'transcription';language:'sv'|'en';title:string}) => Promise<import('./lesson').LessonSession>;
    lessonUpdate: (input: {id:string;title?:string;language?:'sv'|'en';subject?:string;taskId?:string;completed?:boolean}) => Promise<import('./lesson').LessonSession>;
    lessonDelete: (id:string) => Promise<void>;
    lessonAudio: (input: import('./lesson').AudioInput) => Promise<{session:import('./lesson').LessonSession;error?:string}>;
    lessonRetry: (input: {id:string;audioId:string}) => Promise<{session:import('./lesson').LessonSession;error?:string}>;
    lessonDiscard: (input: {id:string;audioId:string}) => Promise<import('./lesson').LessonSession>;
    lessonCancel: (id:string) => Promise<boolean>;
    lessonAnalyse: (input: {id:string;model:string}) => Promise<import('./lesson').LessonSession>;
    calendarStatus: () => Promise<import('./lesson').CalendarStatus & {error?:string}>;
    calendarConfigure: (input:{clientId:string;clientSecret:string;calendarId?:string}) => Promise<import('./lesson').CalendarStatus>;
    calendarConnect: () => Promise<import('./lesson').CalendarStatus>;
    calendarDisconnect: () => Promise<import('./lesson').CalendarStatus>;
    calendarAdd: (input:{id:string;taskId:string;title:string;date:string}) => Promise<import('./lesson').LessonSession>;
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
