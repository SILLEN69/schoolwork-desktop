/// <reference types="vite/client" />
interface Window { schoolwork: {
 getActivity:(id:string)=>Promise<any[]>;
 settingsGet:()=>Promise<any>;setKey:(key:string)=>Promise<boolean>;setModel:(m:string)=>Promise<string>;setLanguage:(language:'en'|'sv')=>Promise<boolean>;
 chooseWorkspace:()=>Promise<string|null>;listModels:()=>Promise<string[]>;listChats:()=>Promise<any[]>;getChat:(id:string)=>Promise<any>;deleteChat:(id:string)=>Promise<void>;openPath:(p:string)=>Promise<void>;
 send:(payload:{chatId:string;userText:string;model:string;clientRequestId?:string})=>Promise<string>;cancel:(id:string)=>Promise<boolean>;
 control:(taskId:string,action:'pause'|'resume'|'retry')=>Promise<boolean>;
 memoryList:()=>Promise<any[]>;memorySearch:(query:string)=>Promise<any[]>;memoryGet:(id:string)=>Promise<any>;memoryUpdate:(input:any)=>Promise<any>;memoryArchive:(id:string)=>Promise<any>;memoryForget:(id:string)=>Promise<boolean>;memoryGraph:(input?:any)=>Promise<any>;openVault:()=>Promise<string>;exportDiagnostics:(taskId:string)=>Promise<string|null>;
 onEvent:(cb:(e:any)=>void)=>()=>void
} }
