import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Workflow } from 'lucide-react';
import { buildTimeline, type TimelineEvent, type TimelineMessage } from '../timeline';
import MessageMarkdown from './MessageMarkdown';
import ImageAttachments from './ImageAttachments';

export default function ConversationTimeline({ conversationId, fallback, swedish, running, onUpdated }: {conversationId:string;fallback:TimelineMessage[];swedish:boolean;running:boolean;onUpdated:()=>void}) {
  const [snapshot,setSnapshot]=useState<{messages:TimelineMessage[];events:TimelineEvent[]}>({messages:[],events:[]});
  const [error,setError]=useState('');
  const owner=useRef(''),follow=useRef(onUpdated);follow.current=onUpdated;
  useLayoutEffect(()=>follow.current(),[snapshot]);
  useEffect(() => {
    let disposed=false, busy=false, dirty=false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if(owner.current!==conversationId) {owner.current=conversationId;setSnapshot({messages:[],events:[]});} setError('');
    const refresh=async () => {
      if(disposed) return;
      if(busy) { dirty=true; return; }
      busy=true;
      try {
        // Both are authoritative persisted records, not an independent optimistic event list.
        const [chat,events]=await Promise.all([window.schoolwork.getChat(conversationId),window.schoolwork.getActivity(conversationId)]);
        if(!disposed) {setSnapshot({messages:chat?.messages || [],events});setError('');}
      } catch {if(!disposed) setError(swedish?'Kunde inte läsa tidslinjen.':'Could not load the timeline.');}
      finally {busy=false; if(dirty&&!disposed) {dirty=false; void refresh();}}
    };
    const off=window.schoolwork.onEvent(event => {
      if(event.conversationId!==conversationId) return;
      if(['stream-progress','thinking-progress'].includes(event.type)) return;
      if(timer) clearTimeout(timer);
      timer=setTimeout(() => void refresh(),80);
    });
    void refresh();
    const focus=()=>void refresh();window.addEventListener('focus',focus);
    const reconciliation=running?setInterval(()=>void refresh(),3000):undefined;
    return () => {disposed=true;off();window.removeEventListener('focus',focus);if(timer)clearTimeout(timer);if(reconciliation)clearInterval(reconciliation);};
  },[conversationId,swedish,running]);
  const rows=buildTimeline(snapshot.messages.length?snapshot.messages:fallback,snapshot.events);
  return <>
    {error&&<p role="alert">{error}</p>}
    {rows.map(row => row.kind==='message' ? <div className={'message '+row.message.role} key={row.key} data-timeline="message">
      {row.message.role==='assistant'&&<div className="msg-avatar"><Workflow size={15}/></div>}
      <div className="msg-body">{row.message.role==='user' ? <div className="user-bubble">{row.message.content}<ImageAttachments attachments={row.message.attachments||[]}/></div> : <><div className="msg-meta">SchoolWork {row.message.model&&<span>· {row.message.model}</span>}</div><MessageMarkdown text={row.message.content}/></>}</div>
    </div> : <div className="execution-log" key={row.key} data-timeline="activity"><details className={row.end?.payload?.ok===false?'step-failed':row.end?'step-done':''}>
      <summary><span className="step-state" aria-hidden="true">{row.end?row.end.payload?.ok===false?'!':'✓':'›'}</span><span>{row.start.text.split('\n')[0]||row.start.type}</span><time>{row.end?.payload?.durationMs!==undefined?(row.end.payload.durationMs/1000).toFixed(1)+'s':new Date(row.start.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></summary>
      <pre>{row.end?.text||row.start.text}</pre>
    </details></div>)}
  </>;
}
