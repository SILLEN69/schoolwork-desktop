import {useEffect, useRef, useState} from 'react';
import startupVideo from '../assets/schoolwork-startup.mp4';
import startupPoster from '../assets/schoolwork-startup-poster.jpg';
import './startup-intro.css';

/** Prerendered Remotion branding; no Remotion runtime or network request at startup. */
export default function StartupIntro({onComplete,swedish=false,preview=false}:{onComplete:()=>void;swedish?:boolean;preview?:boolean}){
  // Explicit playback is user-requested; automatic startup still honors reduced motion.
  const [reduced,setReduced]=useState(()=>!preview&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [leaving,setLeaving]=useState(false);
  const ended=useRef(false),fade=useRef<ReturnType<typeof setTimeout>>(undefined);
  const complete=useRef(onComplete);complete.current=onComplete;
  const finish=()=>{
    if(ended.current)return;
    ended.current=true;setLeaving(true);
    fade.current=setTimeout(()=>complete.current(),180);
  };
  const finishRef=useRef(finish);finishRef.current=finish;
  useEffect(()=>{
    // The hard deadline never resets when settings, progress or language changes.
    const timer=window.setTimeout(()=>finishRef.current(),4200);
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed=()=>setReduced(!preview&&media.matches);media.addEventListener('change',changed);
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();finishRef.current();}};
    window.addEventListener('keydown',escape);
    return()=>{window.clearTimeout(timer);if(fade.current)clearTimeout(fade.current);media.removeEventListener('change',changed);window.removeEventListener('keydown',escape);};
  },[preview]);
  useEffect(()=>{if(!reduced)return;const timer=setTimeout(()=>finishRef.current(),220);return()=>clearTimeout(timer);},[reduced]);
  return <div className={'startup-splash'+(leaving?' leaving':'')} role="dialog" aria-modal="true" aria-label={swedish?'SchoolWork startar':'SchoolWork is starting'}>
    {reduced?<img className="startup-media" src={startupPoster} alt="SchoolWork"/>:<video className="startup-media" src={startupVideo} autoPlay muted playsInline onEnded={finish} onError={finish} aria-hidden="true"/>}
    <button className="startup-skip" onClick={finish} autoFocus>{swedish?'Hoppa över':'Skip intro'} <kbd>Esc</kbd></button>
  </div>;
}
