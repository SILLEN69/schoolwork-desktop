import {useEffect,useRef,useState} from 'react';
import './notifications.css';
import AtomWorking from './AtomWorking';

type Notice={id:string;conversationId:string;outcome:'completed'|'error'};
export default function TaskNotices({swedish,onOpen}:{swedish:boolean;onOpen:(conversationId:string)=>void}){
  const [notices,setNotices]=useState<Notice[]>([]);
  const open=useRef(onOpen);open.current=onOpen;
  useEffect(()=>{
    const seen=new Set<string>();
    return window.schoolwork.onNotification(event=>{
      if(event.kind==='open'){
        open.current(event.conversationId);
        setNotices(items=>items.filter(item=>item.conversationId!==event.conversationId));return;
      }
      if(!event.id||!event.outcome||seen.has(event.id))return;
      seen.add(event.id);if(seen.size>256)seen.delete(seen.values().next().value!);
      setNotices(items=>[...items.filter(item=>item.conversationId!==event.conversationId),{id:event.id!,conversationId:event.conversationId,outcome:event.outcome!}].slice(-3));
    });
  },[]);
  return <div className="task-notices" aria-label={swedish?'Uppgiftsnotiser':'Task notifications'}>
    {notices.map(notice=><section className="task-notice" key={notice.id} role={notice.outcome==='error'?'alert':'status'}>
      <div className="task-notice-head">
        <span className="notice-badge"><AtomWorking size={22} animated={false} /></span>
        <strong>{swedish?(notice.outcome==='completed'?'Uppgiften är klar':'Uppgiften behöver hjälp'):(notice.outcome==='completed'?'Task complete':'Task needs attention')}</strong>
      </div>
      <p>{swedish?(notice.outcome==='completed'?'Resultatet är sparat.':'Ett fel stoppade uppgiften. Framstegen är sparade.'):(notice.outcome==='completed'?'Your result is saved.':'An error stopped the task. Progress is saved.')}</p>
      <button onClick={()=>{open.current(notice.conversationId);setNotices(items=>items.filter(item=>item.id!==notice.id));}}>{swedish?'Visa uppgift':'View task'}</button>
      <button className="notice-dismiss" aria-label={swedish?'Stäng notis':'Dismiss notification'} onClick={()=>setNotices(items=>items.filter(item=>item.id!==notice.id))}>×</button>
    </section>)}
  </div>;
}
