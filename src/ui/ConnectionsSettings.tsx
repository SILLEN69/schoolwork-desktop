import {useEffect,useState} from 'react';
import {Plug,Plus,Trash2,CheckCircle2} from 'lucide-react';
import {CalendarDialog} from './LessonWorkspace';
import type {CalendarStatus} from '../lesson';
import './connections.css';
export default function ConnectionsSettings({swedish}:{swedish:boolean}){
  const [items,setItems]=useState<any[]>([]),[name,setName]=useState(''),[url,setUrl]=useState(''),[token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [google,setGoogle]=useState(false),[calendar,setCalendar]=useState<CalendarStatus>({configured:false,connected:false,connecting:false,calendarId:'primary'});
  const t=(sv:string,en:string)=>swedish?sv:en;
  useEffect(()=>{window.schoolwork.connectionList().then(setItems).catch(e=>setError(e.message));},[]);
  useEffect(()=>{if(!google)return;let alive=true;const load=()=>window.schoolwork.calendarStatus().then(s=>{if(alive)setCalendar(s);});void load();const timer=setInterval(load,1500);return()=>{alive=false;clearInterval(timer);};},[google]);
  return <section className="connections-settings"><h3><Plug size={17}/> {t('Anslutna appar','Connected apps')}</h3><p>{t('Använd direkta anslutningar i stället för skärmklick när det går.','Use direct connections instead of screen clicks where available.')}</p>
    <button className="tool-pill" onClick={()=>setGoogle(true)}>Google Calendar {t('& Drive','& Drive')}</button>
    <p>{t('MCP: lägg till en server du litar på. När den är aktiverad får agenten använda dess verktyg för dina uppgifter. Servern kan läsa eller ändra data enligt sitt konto.','MCP: add a server you trust. Enabling it lets the agent use its tools for your tasks. It may read or change data using its connected account.')}</p>
    {items.map(c=><div className="connection-row" key={c.id}><label><input type="checkbox" checked={c.enabled} onChange={async e=>{try{setItems(await window.schoolwork.connectionSave({...c,enabled:e.target.checked}));}catch(e:any){setError(e.message);}}}/>{c.name}</label><button className="tool-pill" disabled={busy || !c.enabled} onClick={async()=>{setBusy(true);setError('');try{const tools=await window.schoolwork.connectionTest(c.id);setNotice(`${c.name}: ${tools.length} ${t('verktyg tillgängliga','tools available')}`);}catch(e:any){setError(e.message);}finally{setBusy(false);}}}><CheckCircle2 size={13}/>{t('Testa','Test')}</button><button className="icon" aria-label={t('Ta bort ','Remove ')+c.name} onClick={()=>void window.schoolwork.connectionRemove(c.id).then(setItems).catch(e=>setError(e.message))}><Trash2 size={14}/></button></div>)}
    <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{setItems(await window.schoolwork.connectionSave({name,url,token,enabled:true}));setName('');setUrl('');setToken('');}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>
      <label>{t('Namn','Name')}<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80}/></label><label>MCP URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…/mcp" required/></label><label>{t('Token (valfri, krypteras lokalt)','Token (optional, encrypted locally)')}<input type="password" autoComplete="new-password" value={token} onChange={e=>setToken(e.target.value)}/></label><button className="tool-pill" disabled={busy}><Plus size={14}/>{t('Lägg till anslutning','Add connection')}</button>
    </form><small>{t('Streamable HTTP. Publika servrar eller bearer-token. Full MCP OAuth och lokala stdio-servrar ingår inte ännu.','Streamable HTTP. Public servers or bearer-token auth. Full MCP OAuth and local stdio servers are not included yet.')}</small>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {google && <CalendarDialog swedish={swedish} status={calendar} onStatus={setCalendar} onClose={()=>setGoogle(false)} onError={setError}/>}
  </section>;
}
