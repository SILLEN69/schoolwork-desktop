import {useEffect,useRef,useState} from 'react';
import type {WorkQuestion,WorkAnswer} from '../workQuestion';
import {userError} from '../userError';
import {useLanguage} from './Language';
export default function QuestionCard({taskId,onStop}:{taskId:string|null;onStop:()=>Promise<void>}){
 const {language,t}=useLanguage();
 const [question,setQuestion]=useState<WorkQuestion|null>(null),[answer,setAnswer]=useState<WorkAnswer>({}),[custom,setCustom]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const questionId=useRef<string|null>(null);
 useEffect(()=>{
  let active=true;
  questionId.current=null;setQuestion(null);setAnswer({});setCustom({});setError('');
  const load=()=>{if(taskId)void window.schoolwork.getQuestion(taskId).then(q=>{if(active){if(questionId.current!==q?.id){setAnswer({});setCustom({});}questionId.current=q?.id||null;setQuestion(q);}}).catch(()=>{});};
  load();const timer=setInterval(load,1500);const off=window.schoolwork.onEvent(e=>{if(e.taskId===taskId&&['question','question-answered'].includes(e.type))load();});
  return()=>{active=false;clearInterval(timer);off();};
 },[taskId]);
 if(!question||!taskId)return null;
 const submit=async(cancel=false)=>{
  setBusy(true);setError('');
  try {
   const values={...answer};
   for(const field of question.fields)if(custom[field.key]?.trim())values[field.key]=field.type==='multiselect'?[...(Array.isArray(values[field.key])?values[field.key] as string[]:[]),custom[field.key].trim()]:custom[field.key].trim();
   await window.schoolwork.answerQuestion({taskId,questionId:question.id,answer:values,cancel});setQuestion(null);
  }catch(e){setError(userError(e,language));}finally{setBusy(false);}
 };
 return <form className="work-question" aria-label={t('Question from SchoolWork','Fråga från SchoolWork')} onSubmit={e=>{e.preventDefault();void submit();}}>
  {question.fields.map(field=><fieldset key={field.key}><legend>{field.description||field.title}</legend>
   {field.options?.map(option=><label key={option.value}><input type={field.type==='multiselect'?'checkbox':'radio'} name={field.key}
    checked={Array.isArray(answer[field.key])?(answer[field.key] as string[]).includes(option.value):answer[field.key]===option.value}
    onChange={e=>{setCustom(previous=>({...previous,[field.key]:''}));setAnswer(previous=>({...previous,[field.key]:field.type==='multiselect'?(e.target.checked?[...(Array.isArray(previous[field.key])?previous[field.key] as string[]:[]),option.value]:(previous[field.key] as string[]).filter(v=>v!==option.value)):option.value}));}}/>
    <span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span></label>)}
   {(field.custom||!field.options?.length)&&<textarea aria-label={field.title||field.description} placeholder={t('Your answer','Ditt svar')} maxLength={4000} value={custom[field.key]||''} onChange={e=>setCustom(previous=>({...previous,[field.key]:e.target.value}))}/>}
  </fieldset>)}
  {error&&<p role="alert">{error}</p>}<div><button type="button" disabled={busy} onClick={()=>{setBusy(true);void onStop().then(()=>setQuestion(null)).catch(e=>setError(userError(e,language))).finally(()=>setBusy(false));}}>{t('Stop task','Stoppa uppgift')}</button><button type="button" disabled={busy} onClick={()=>void submit(true)}>{t('Skip','Hoppa över')}</button><button type="submit" disabled={busy}>{t('Send answer','Skicka svar')}</button></div>
 </form>;
}
