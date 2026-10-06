import { expect, it } from 'vitest';
import { buildTimeline, type TimelineMessage, type TimelineEvent } from './timeline';
const msg=(sequence:number,content:string,createdAt=100):TimelineMessage=>({id:'m'+sequence,sequence,content,role:'assistant',createdAt});
const event=(id:string,type:string,sequence?:number,time=100):TimelineEvent=>({id,type,createdAt:time,text:type,taskId:'t',payload:{callId:'call'+id.replace(/end$/,''),afterMessageSequence:sequence}});
it('interleaves commentary and tool groups before final even in the same millisecond', () => {
  const messages=[msg(0,'on it'),{...msg(1,''),role:'tool'},msg(2,'saved it'),{...msg(3,''),role:'tool'},msg(4,'done')];
  const events=[event('a','tool-start',0),event('aend','tool-result',1),event('b','tool-start',2),event('bend','tool-result',3)];
  const rows=buildTimeline(messages,events);
  expect(rows.map(r=>r.kind==='message'?r.message.content:r.start.id)).toEqual(['on it','a','saved it','b','done']);
  expect(rows.filter(r=>r.kind==='activity').every(r=>r.end)).toBe(true);
});
it('restores old timestamp-only events without moving them below the final', () => {
  const rows=buildTimeline([msg(0,'on it',10),msg(1,'done',30)],[event('a','tool-start',undefined,20),event('aend','tool-result',undefined,25)]);
  expect(rows.map(r=>r.kind)).toEqual(['message','activity','message']);
});
it('deduplicates replayed events and hides raw tool messages', () => {
  const e=event('a','tool-start',0);
  expect(buildTimeline([{...msg(0,'{}'),role:'tool'}],[e,e])).toHaveLength(1);
});
