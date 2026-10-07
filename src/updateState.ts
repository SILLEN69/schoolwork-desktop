export type UpdateState = {
  phase: 'idle'|'checking'|'available'|'downloading'|'ready'|'installing'|'error'|'unsupported';
  currentVersion: string;
  version?: string;
  percent?: number;
  message?: string;
  errorCode?: string;
  notify?: boolean;
};
