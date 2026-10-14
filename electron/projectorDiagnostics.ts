import fs from 'node:fs/promises';
import path from 'node:path';

declare const SCHOOLWORK_PROJECTOR_DEBUG: boolean;
export const projectorDebugBuild = typeof SCHOOLWORK_PROJECTOR_DEBUG !== 'undefined' && SCHOOLWORK_PROJECTOR_DEBUG;
const events = new Set(['connect.start','connect.phase','connect.navigation','connect.load','connect.execution','connect.cleanup','connect.finish','board.configure','board.refresh','board.view','board.capture','board.disconnect']);
export type ProjectorTrace = (event: string, details?: Record<string, unknown>) => void;
const strings: Record<string, Set<string>> = {
  phase: new Set(['loading','signin','joining','resolved','error']),
  outcome: new Set(['started','succeeded','failed','cancelled','timed_out','blocked','loaded','hidden','opened','closed','stale','not_ready']),
  target: new Set(['school','google','other']),
  reason: new Set(['network','navigation_context','invalid_state','lookup_rejected','deadline','user_cancel','window_closed','cleanup_failed','cleanup_timeout','invalid_input','parse_failed','http_error','stream_load','no_video_frame','empty_image','selection_changed']),
};
const numbers = new Set(['durationMs','httpStatus','netError','senderCount','videoCount','readyState']);
const booleans = new Set(['active','connections']);
function sanitize(event: string, details: Record<string, unknown> = {}) {
  if (!events.has(event)) return null;
  const safe: Record<string, unknown> = {};
  for (const [key,value] of Object.entries(details)) {
    if (Object.hasOwn(strings,key) && strings[key].has(String(value))) safe[key] = value;
    else if (numbers.has(key) && typeof value === 'number' && Number.isFinite(value)) safe[key] = Math.max(-10000,Math.min(3_600_000,Math.round(value)));
    else if (booleans.has(key) && typeof value === 'boolean') safe[key] = value;
    else if (key === 'attemptId' && typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value)) safe[key] = value;
  }
  return {event,details:safe};
}
/** Temporary beta diagnostics. No URLs, PINs, identities, page contents, cookies,
 * tokens, messages or console output enter this allowlisted journal. */
export class ProjectorDiagnostics {
  readonly enabled: boolean;
  readonly file: string;
  private pending = Promise.resolve();
  private recent: unknown[] = [];
  constructor(root: string, private version: string, requested = projectorDebugBuild) {
    this.enabled = requested && /-beta\.\d+$/.test(version);
    this.file = path.join(root,'projector-beta.jsonl');
  }
  record: ProjectorTrace = (event,details) => {
    if (!this.enabled) return;
    const safe = sanitize(event,details); if (!safe) return;
    const entry = {timestamp:new Date().toISOString(),...safe};
    this.recent.push(entry);this.recent=this.recent.slice(-500);
    this.pending = this.pending.then(async()=>{
      await fs.mkdir(path.dirname(this.file),{recursive:true,mode:0o700});
      const size = await fs.stat(this.file).then(s=>s.size).catch(()=>0);
      if(size>1_000_000) {try{await fs.rename(this.file,this.file+'.previous');}catch{return;}}
      await fs.appendFile(this.file,JSON.stringify(entry)+'\n',{mode:0o600});
    }).catch(()=>{}); // Diagnostics must never break the projector operation.
  };
  async export() {
    if(!this.enabled)throw new Error('Projector debug logging is available only in beta builds.');
    await this.pending;
    let records: unknown[] = this.recent;
    try {
      const text=await fs.readFile(this.file,'utf8');
      records=text.slice(-1_100_000).split('\n').slice(-501).flatMap(line=>{
        try {const raw=JSON.parse(line),safe=sanitize(raw.event,raw.details);return safe&&typeof raw.timestamp==='string'&&/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(raw.timestamp)?[{timestamp:raw.timestamp,...safe}]:[];}catch{return [];}
      });
    }catch{/* In-memory evidence is still exportable when disk writes fail. */}
    records=[...new Map([...records,...this.recent].map(record=>[JSON.stringify(record),record])).values()].slice(-500);
    return {schema:1,version:this.version,platform:process.platform,exportedAt:new Date().toISOString(),betaOnly:true,events:records};
  }
}
