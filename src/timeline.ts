import type { Attachment } from './capabilities';
export type TimelineMessage = { id?: string; sequence?: number; createdAt?: number; role: string; content: string; model?: string; attachments?: Attachment[] };
export type TimelineEvent = { id: string; taskId?: string; createdAt: number; type: string; text: string; payload?: { afterMessageSequence?: number; callId?: string; ok?: boolean; durationMs?: number } };
export type TimelineItem = { key: string; position: number; time: number } & ({ kind: 'message'; message: TimelineMessage } | { kind: 'activity'; start: TimelineEvent; end?: TimelineEvent });

/** Sequence anchors disambiguate messages and tool events written in the same millisecond.
 * Older records use their original timestamp; nothing is rewritten in the database. */
export function buildTimeline(messages: TimelineMessage[], events: TimelineEvent[]): TimelineItem[] {
  const rows: TimelineItem[] = [];
  const ordered = messages.map((message, i) => ({ ...message, sequence: message.sequence ?? i }));
  for (const message of ordered) {
    if (!['user','assistant'].includes(message.role) || !(message.content.trim() || message.attachments?.length)) continue;
    rows.push({kind:'message',key:message.id || 'message:'+message.sequence,position:message.sequence,time:message.createdAt || 0,message});
  }
  const groups = new Map<string, { start: TimelineEvent; end?: TimelineEvent }>();
  const visible = new Set(['tool-start','tool-result','retry','verification']);
  for (const event of [...new Map(events.map(e => [e.id,e])).values()].sort((a,b) => a.createdAt-b.createdAt)) {
    if (!visible.has(event.type)) continue;
    const key = event.payload?.callId ? `${event.taskId}:${event.payload.callId}` : event.id;
    const group = groups.get(key);
    if (!group) groups.set(key,{start:event,end:event.type==='tool-result' ? event : undefined});
    else if (event.type==='tool-result') group.end=event;
    else if (event.type==='tool-start') group.start=event;
  }
  for (const [key,group] of groups) {
    const {start} = group;
    const anchor = start.payload?.afterMessageSequence ?? ordered.reduce((previous,message) => (message.createdAt || 0)<=start.createdAt ? message.sequence : previous,-1);
    rows.push({kind:'activity',key:'event:'+key,position:anchor+0.5,time:start.createdAt,...group});
  }
  return rows.sort((a,b) => a.position-b.position || a.time-b.time);
}
