import {useEffect,useRef,useState} from 'react';
import './notifications.css';

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
      <strong>{swedish?(notice.outcome==='completed'?'Uppgiften är klar':'Uppgiften behöver hjälp'):(notice.outcome==='completed'?'Task complete':'Task needs attention')}</strong>
      <p>{swedish?(notice.outcome==='completed'?'Resultatet är sparat.':'Ett fel stoppade uppgiften. Framstegen är sparade.'):(notice.outcome==='completed'?'Your result is saved.':'An error stopped the task. Progress is saved.')}</p>
      <button onClick={()=>{open.current(notice.conversationId);setNotices(items=>items.filter(item=>item.id!==notice.id));}}>{swedish?'Visa uppgift':'View task'}</button>
      <button className="notice-dismiss" aria-label={swedish?'Stäng notis':'Dismiss notification'} onClick={()=>setNotices(items=>items.filter(item=>item.id!==notice.id))}>×</button>
    </section>)}
  </div>;
}

export function NotificationsSettings({swedish}:{swedish:boolean}){
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const test=async()=>{
    setBusy(true);
    try{const result=await window.schoolwork.testNotifications();setMessage(swedish?(result.requested?'Testnotisen har skickats till Windows. Om ingen banner syns, kontrollera Windows-notiser och Stör ej.':'Windows-notisen kunde inte skickas. Notiser i appen fungerar ändå.'):(result.requested?'Test notification requested. If no banner appears, check Windows notifications and Do Not Disturb.':'The system notification could not be requested. In-app notices still work.'));}
    catch{setMessage(swedish?'Testnotisen kunde inte skickas.':'The test notification could not be requested.');}
    finally{setBusy(false);}
  };
  return <div className="setting-block">
    <label>{swedish?'Notiser':'Notifications'}</label>
    <p>{swedish?'Visas när en uppgift är klar eller stoppas av ett fel. Windows kan dölja banners med Stör ej; en notis finns också i appen.':'Shown when a task completes or stops with an error. Windows may suppress banners with Do Not Disturb; an in-app notice is also shown.'}</p>
    <button onClick={()=>void test()} disabled={busy}>{swedish?'Testa Windows-notis':'Test Windows notification'}</button>{' '}
    <button onClick={()=>void window.schoolwork.openNotificationSettings().then(opened=>{if(!opened)setMessage(swedish?'Tillgängligt i Windows-appen.':'Available in the Windows app.');}).catch(()=>setMessage(swedish?'Kunde inte öppna Windows-inställningar.':'Could not open Windows settings.'))}>{swedish?'Öppna Windows-inställningar':'Open Windows settings'}</button>
    {message&&<p role="status">{message}</p>}
  </div>;
}
