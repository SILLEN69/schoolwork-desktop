export function validateWorkspaceRelativePath(relativePath:string){
  const value=relativePath||'.';if(value.includes('\0')||/^(?:[a-z]:[\\/]|[\\/]{2}|[\\/])/i.test(value)||value.split(/[\\/]+/).includes('..'))throw new Error('Path is outside the selected workspace.');return value;
}

export function parseModelIds(payload:unknown):string[]{
  if(!payload||typeof payload!=='object')return[];const p=payload as {data?:unknown;models?:unknown};const list=Array.isArray(p.data)?p.data:Array.isArray(p.models)?p.models:[];
  return [...new Set(list.map(x=>typeof x==='string'?x:x&&typeof x==='object'&&'id'in x?String((x as {id:unknown}).id):'').filter(Boolean))];
}

export function retainRecentMessages<T>(messages:T[],limit=24){return messages.slice(-Math.max(1,limit));}
export function commandSucceeded(exitCode:number|null|undefined,timedOut=false){return exitCode===0&&!timedOut;}
export class FailedActionGuard {
  private previous = '';
  key(tool: string, args: unknown): string { return tool + ':' + JSON.stringify(args); }
  isDuplicate(tool: string, args: unknown): boolean { return this.previous !== '' && this.previous === this.key(tool, args); }
  failed(tool: string, args: unknown): void { this.previous = this.key(tool, args); }
  succeeded(): void { this.previous = ''; }
}

export function parseFallbackAction(text:string):{tool:string;arguments:Record<string,unknown>}|null{
  const candidate=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{const parsed=JSON.parse(candidate);const action=parsed?.action;if(action&&typeof action.tool==='string'&&action.arguments&&typeof action.arguments==='object'&&!Array.isArray(action.arguments))return{tool:action.tool,arguments:action.arguments};}catch{}return null;
}
