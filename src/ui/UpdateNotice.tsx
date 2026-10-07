import { useEffect, useState } from 'react';
import type { UpdateState } from '../updateState';
import './updates.css';

export default function UpdateNotice({settings=false,swedish=false}:{settings?:boolean;swedish?:boolean}) {
  const [state,setState]=useState<UpdateState>();
  const [dismissed,setDismissed]=useState(false);
  const [error,setError]=useState('');
  const t=(en:string,sv:string)=>swedish?sv:en;
  useEffect(()=>{
    let alive=true;
    window.schoolwork.updateStatus().then(s=>{if(alive)setState(s);}).catch(()=>{});
    const off=window.schoolwork.onUpdate(s=>{setState(s);if(s.phase==='available'||s.phase==='ready')setDismissed(false);});
    return ()=>{alive=false;off();};
  },[]);
  if(!state || (!settings && (dismissed || !['available','downloading','ready','installing','error'].includes(state.phase) || (state.phase==='error'&&!state.notify))))return null;
  const action=async (name:'check'|'download'|'install')=>{setError('');try{setState(await window.schoolwork.updateAction(name));}catch{setError(t('Could not update. Try again.','Kunde inte uppdatera. Försök igen.'));}};
  return <section className="update-notice" aria-label={t('SchoolWork updates','SchoolWork-uppdateringar')}>
    <div aria-live="polite"><strong>{state.phase==='available'?t(`SchoolWork ${state.version} is available. Update now?`,`SchoolWork ${state.version} finns. Uppdatera nu?`):state.phase==='downloading'?t(`Downloading update · ${state.percent||0}%`,`Hämtar uppdatering · ${state.percent||0}%`):state.phase==='ready'?t('Update ready — restart when you’re ready.','Uppdateringen är klar — starta om när det passar.'):t(`SchoolWork ${state.currentVersion}`,`SchoolWork ${state.currentVersion}`)}</strong>
    {(state.message||error)&&<p>{error||state.message}</p>}
    {state.phase==='checking'&&<p>{t('Checking for updates…','Söker efter uppdateringar…')}</p>}
    {state.phase==='downloading'&&<progress max={100} value={state.percent||0}/>}</div>
    <div className="update-actions">
      {['idle','error'].includes(state.phase)&&<button onClick={()=>void action('check')}>{t('Check for updates','Sök uppdateringar')}</button>}
      {state.phase==='available'&&<button onClick={()=>void action('download')}>{t('Update now','Uppdatera nu')}</button>}
      {state.phase==='ready'&&<button onClick={()=>void action('install')}>{t('Restart and install','Starta om och installera')}</button>}
      {['unsupported','error'].includes(state.phase)&&<button onClick={()=>void window.schoolwork.openUrl('https://github.com/SILLEN69/schoolwork-desktop/releases/latest')}>{t('Download from GitHub','Hämta från GitHub')}</button>}
      {!settings&&state.phase!=='installing'&&<button onClick={()=>setDismissed(true)}>{t('Later','Senare')}</button>}
    </div>
  </section>;
}
