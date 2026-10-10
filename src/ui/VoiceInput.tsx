import {useEffect,useRef,useState} from 'react';
import {Mic,Square,LoaderCircle,RefreshCw} from 'lucide-react';
import {LessonRecorder,audioBase64} from '../audioRecorder';
import {transcriptText,audioEnd,type LessonSession} from '../lesson';

/** Dictation inserts text into the normal editable composer. Never auto-sends. */
export default function VoiceInput({chatId,language,onText,onError}:{chatId:string;language:'sv'|'en';onText:(text:string)=>void;onError:(text:string)=>void}) {
  const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  const recorder=useRef<LessonRecorder|null>(null),session=useRef<LessonSession|null>(null),queue=useRef(Promise.resolve()),pending=useRef(0),inserted=useRef('');
  const alive=useRef(true),callbacks=useRef({onText,onError});callbacks.current={onText,onError};
  const stop=()=>{recorder.current?.stop();recorder.current=null;if(alive.current)setRecording(false);void queue.current.then(()=>cleanup()).catch(()=>{});};
  const accept=(s:LessonSession)=>{
    session.current=s;const text=transcriptText(s);
    const added=text.startsWith(inserted.current)?text.slice(inserted.current.length).trim():s.segments.at(-1)?.text || '';
    if(added && alive.current)callbacks.current.onText(added);inserted.current=text;
  };
  useEffect(()=>{alive.current=true;let active=true;void window.schoolwork.lessonList().then(sessions=>{
    if(!active || session.current)return;
    const saved=sessions.find(s=>s.mode==='transcription' && s.title==='Work dictation '+chatId);
    if(saved){accept(saved);setFailed(Boolean(saved.pending.length));void cleanup().catch(()=>{});}
  }).catch(()=>{});return ()=>{active=false;alive.current=false;stop();};},[chatId]);
  const cleanup=async()=>{if(alive.current && session.current && !pending.current && !session.current.pending.length && !recorder.current){const id=session.current.id;await window.schoolwork.lessonDelete(id);if(session.current?.id===id){session.current=null;inserted.current='';}}};
  const start=async()=>{
    setBusy(true);setFailed(false);
    try {
      session.current ||= await window.schoolwork.lessonCreate({mode:'transcription',language,title:'Work dictation '+chatId});
      if(!alive.current)return;
      const s=session.current;
      if(s.pending.length)throw new Error(language==='sv'?'Försök igen med det sparade ljudet först.':'Retry the saved audio first.');
      const next=new LessonRecorder(({buffer,start,duration})=>{
        pending.current++;setBusy(true);
        if(pending.current>=3)stop();
        queue.current=queue.current.then(async()=>{
          try{const result=await window.schoolwork.lessonAudio({sessionId:s.id,id:crypto.randomUUID(),language,mime:'audio/wav',name:'dictation.wav',base64:audioBase64(buffer),start,duration});accept(result.session);if(result.error){stop();setFailed(true);callbacks.current.onError(result.error);}}
          catch(e){stop();setFailed(true);callbacks.current.onError(String(e)+' — audio could not be saved in the app; a WAV backup is offered.');const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'})),link=document.createElement('a');link.href=url;link.download='work-dictation.wav';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
          finally{pending.current--;if(alive.current)setBusy(pending.current>0);await cleanup().catch(()=>{});}
        });
      },()=>{},stop,audioEnd(s));
      recorder.current=next;await next.start();if(alive.current)setRecording(true);else next.stop();
    }catch(e){stop();callbacks.current.onError(String(e));}finally{if(alive.current)setBusy(pending.current>0);}
  };
  const retry=async()=>{setBusy(true);try{for(const p of session.current?.pending || []){const result=await window.schoolwork.lessonRetry({id:session.current!.id,audioId:p.id});accept(result.session);if(result.error)throw new Error(result.error);}setFailed(false);await cleanup();}catch(e){callbacks.current.onError(String(e));}finally{setBusy(false);}};
  const label=recording?(language==='sv'?'Avsluta diktering':'Finish dictation'):failed?(language==='sv'?'Försök diktera igen':'Retry dictation'):(language==='sv'?'Diktera':'Dictate');
  return <button type="button" className={'tool-pill voice-input '+(recording?'recording':'')} title={language==='sv'?'Tal blir text här. Granska innan du skickar.':'Speech becomes editable text here. Review before sending.'} aria-label={label} aria-pressed={recording} disabled={busy && !recording} onClick={()=>recording?stop():void(failed?retry():start())}>{recording?<Square size={14}/>:busy?<LoaderCircle className="spin" size={14}/>:failed?<RefreshCw size={14}/>:<Mic size={14}/>}<span>{busy&&!recording?(language==='sv'?'Transkriberar…':'Transcribing…'):label}</span></button>;
}
