import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronRight, Download, FileAudio, FileText, GraduationCap, Headphones, LoaderCircle, Mic, Pause, Plus, RefreshCw, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import { LessonRecorder, audioBase64 } from '../audioRecorder';
import { audioEnd, formatAudioTime, transcriptText, type AudioInput, type AudioLanguage, type CalendarStatus, type LessonSession, type LessonTask } from '../lesson';
import { speechModels } from '../speechModels';
import './lessons.css';
type Props = { initialMode: 'lesson' | 'transcription'; summaryModel: string; configured: boolean; onBack: () => void };
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
export default function LessonWorkspace({ initialMode, summaryModel, configured, onBack }: Props) {
  const [mode, setMode] = useState(initialMode), [language, setLanguage] = useState<AudioLanguage>('sv');
  const [sessions, setSessions] = useState<LessonSession[]>([]), [current, setCurrent] = useState<LessonSession | null>(null);
  const seenSessions = useRef(new Map<string, number>());
  const [title, setTitle] = useState(''), [recording, setRecording] = useState(false), [starting, setStarting] = useState(false);
  const [uploads, setUploads] = useState(0), [analysing, setAnalysing] = useState(false), [autoSummary, setAutoSummary] = useState(true);
  const [level, setLevel] = useState(0), [error, setError] = useState(''), [elapsed, setElapsed] = useState(0);
  const [calendar, setCalendar] = useState<CalendarStatus & {error?:string}>({ configured: false, connected: false, connecting: false, calendarId: 'primary' });
  const [showCalendar, setShowCalendar] = useState(false), [calendarTask, setCalendarTask] = useState<LessonTask | null>(null);
  const [calendarTitle, setCalendarTitle] = useState(''), [calendarDate, setCalendarDate] = useState(''), [calendarBusy, setCalendarBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const recorder = useRef<LessonRecorder | null>(null), queue = useRef<Promise<void>>(Promise.resolve()), queued = useRef(0);
  const selected = useRef<LessonSession | null>(null), mounted = useRef(true), lastAnalysis = useRef(0), analysisBusy = useRef(false);
  const startedAt = useRef(0), uploadInput = useRef<HTMLInputElement>(null), summaryModelRef = useRef(summaryModel);
  selected.current = current; summaryModelRef.current = summaryModel;
  const sv = language === 'sv', t = (svText: string, enText: string) => sv ? svText : enText;
  const locked = recording || starting || uploads > 0 || analysing || calendarBusy;
  const accept = (session: LessonSession) => {
    if (!mounted.current || (seenSessions.current.get(session.id) || 0) > session.updatedAt) return;
    seenSessions.current.set(session.id, session.updatedAt);
    setSessions(previous => [session, ...previous.filter(s => s.id !== session.id)].sort((a,b) => b.updatedAt - a.updatedAt));
    if (selected.current?.id === session.id || !selected.current) { selected.current = session; setCurrent(session); }
  };
  useEffect(() => {
    mounted.current = true;
    window.schoolwork.lessonList().then(s => { if(mounted.current) setSessions(s); }).catch(e => setError(errorText(e)));
    return () => { mounted.current = false; recorder.current?.stop(); recorder.current = null; };
  }, []);
  useEffect(() => {
    let active = true;
    const load = () => window.schoolwork.calendarStatus().then(s => { if(active) setCalendar(s); }).catch(e => { if(active) setError(errorText(e)); });
    void load(); const timer = setInterval(load, calendar.connecting ? 1200 : 8000);
    return () => { active = false; clearInterval(timer); };
  }, [calendar.connecting]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 500);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (!locked) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [locked]);
  const analyse = async () => {
    const session = selected.current;
    if (!session || analysisBusy.current) return;
    analysisBusy.current = true; lastAnalysis.current = Date.now(); setAnalysing(true);
    try { accept(await window.schoolwork.lessonAnalyse({ id: session.id, model: summaryModelRef.current })); }
    catch (e) { if(mounted.current) { setError(errorText(e)); try { const updated = (await window.schoolwork.lessonList()).find(s => s.id === session.id); if(updated) accept(updated); } catch { /* Preserve the last saved notes if the bridge is unavailable. */ } } }
    finally { analysisBusy.current = false; if(mounted.current) setAnalysing(false); }
  };
  useEffect(() => {
    if (!current || mode !== 'lesson' || !autoSummary || analysing || current.pending.length || current.analysisError || current.revision <= current.analysedRevision || !transcriptText(current).trim()) return;
    const timer = setTimeout(() => void analyse(), Math.max(1200, 60_000 - (Date.now() - lastAnalysis.current)));
    return () => clearTimeout(timer);
  }, [current, mode, autoSummary, analysing]);
  const create = async () => {
    const session = await window.schoolwork.lessonCreate({ mode, language, title: t(mode === 'lesson' ? 'Ny lektion' : 'Ny transkribering', mode === 'lesson' ? 'New lesson' : 'New transcription') });
    selected.current = session; accept(session); setTitle(session.title); setError(''); setElapsed(0); lastAnalysis.current = 0; return session;
  };
  const stop = () => { recorder.current?.stop(); recorder.current = null; setRecording(false); setStarting(false); };
  const enqueue = (input: AudioInput) => {
    queued.current++; setUploads(queued.current);
    if (queued.current >= 4) { stop(); setError(t('Inspelningen pausades för att hinna transkribera ljudet. Vänta och fortsätt sedan.', 'Recording paused to catch up with transcription. Wait, then continue.')); }
    queue.current = queue.current.then(async () => {
      try {
        const result = await window.schoolwork.lessonAudio(input); accept(result.session);
        if (result.error) { stop(); setError(result.error); }
      } catch (e) {
        stop(); setError(errorText(e));
        // A rejected upload may not be on disk yet: offer a local download instead of silently dropping it.
        const bytes = Uint8Array.from(atob(input.base64), c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: input.mime }));
        const link = document.createElement('a'); link.href = url; link.download = input.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } finally { queued.current--; if(mounted.current) setUploads(queued.current); }
    });
  };
  const start = async () => {
    setStarting(true); setError('');
    try {
      const session = selected.current || await create();
      if (session.pending.length) throw new Error(t('Försök igen eller ta bort väntande ljud innan du fortsätter.', 'Retry or discard pending audio before continuing.'));
      const captureLanguage = session.language;
      const next = new LessonRecorder(({buffer,start,duration}) => enqueue({ sessionId: session.id, id: crypto.randomUUID(),
        base64: audioBase64(buffer), mime: 'audio/wav', name: `recording-${Math.floor(start)}.wav`, start, duration, language: captureLanguage }),
        value => { if(mounted.current) setLevel(value); }, () => { setRecording(false); setError(t('Mikrofonen kopplades från. Inspelningen har pausats.', 'Microphone disconnected. Recording paused.')); }, audioEnd(session));
      recorder.current = next; await next.start();
      if (!mounted.current || recorder.current !== next) { next.stop(); return; }
      startedAt.current = Date.now(); setElapsed(0); setRecording(true);
    } catch (e) { stop(); setError(errorText(e)); }
    finally { if(mounted.current) setStarting(false); }
  };
  const importAudio = async (file?: File) => {
    if (!file) return; setError('');
    try {
      if(file.size > 25 * 1024 * 1024 || !file.size) throw new Error(t('Välj en ljudfil mellan 1 byte och 25 MB.', 'Choose an audio file between 1 byte and 25 MB.'));
      const mimes: Record<string,string> = { wav: 'audio/wav', mp3:'audio/mpeg', m4a:'audio/mp4', mp4:'audio/mp4', ogg:'audio/ogg', webm:'audio/webm', flac:'audio/flac' };
      const mime = mimes[file.name.split('.').pop()?.toLowerCase() || ''];
      if (!mime) throw new Error(t('Använd WAV, MP3, M4A, OGG, WebM eller FLAC.', 'Use WAV, MP3, M4A, OGG, WebM or FLAC.'));
      const session = selected.current || await create(), buffer = await file.arrayBuffer();
      let duration = 0; const context = new AudioContext();
      try { duration = (await context.decodeAudioData(buffer.slice(0))).duration; } catch { /* The provider may support a format Chromium cannot decode. */ } finally { await context.close(); }
      enqueue({ sessionId: session.id, id: crypto.randomUUID(), base64: audioBase64(buffer), mime, name: file.name, start: audioEnd(session), duration, language: session.language });
    } catch(e) { setError(errorText(e)); }
    finally { if(uploadInput.current) uploadInput.current.value = ''; }
  };
  const changeLanguage = async (next: AudioLanguage) => {
    try { if(current) accept(await window.schoolwork.lessonUpdate({ id:current.id,language:next })); setLanguage(next); } catch(e) { setError(errorText(e)); }
  };
  const select = (s: LessonSession) => { selected.current = s; setCurrent(s); setMode(s.mode); setLanguage(s.language); setTitle(s.title); setError(''); lastAnalysis.current = 0; };
  const perform = async (action: () => Promise<LessonSession>) => { try { accept(await action()); } catch(e) { setError(errorText(e)); } };
  const retry = async (audioId: string) => {
    if(!current) return; setUploads(1); setError('');
    try { const result = await window.schoolwork.lessonRetry({ id:current.id,audioId }); accept(result.session); if(result.error) setError(result.error); }
    catch(e) { setError(errorText(e)); } finally { setUploads(0); }
  };
  const exportNotes = () => {
    if(!current) return;
    const s = current, lines = [`# ${s.title}`, '', s.analysis.overview, '', ...s.analysis.sections.flatMap(section => [`## ${section.heading}`, ...section.points.map(p => '- ' + p), '']),
      `## ${t('Uppgifter', 'Tasks')}`, ...s.analysis.tasks.map(task => `- [${task.completed ? 'x' : ' '}] ${task.title}${task.dueDate ? ' · ' + task.dueDate : ''}\n  ${task.details}`), '',
      `## ${t('Transkript', 'Transcript')}`, ...s.segments.map(p => `[${formatAudioTime(p.start)}] ${p.text}`) ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = s.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0,80) + '.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const openCalendarTask = (task: LessonTask) => { setCalendarTask(task); setCalendarTitle(task.title); setCalendarDate(task.dueDate || ''); };
  const saveCalendarTask = async () => {
    if(!current || !calendarTask) return; setCalendarBusy(true); setError('');
    try { accept(await window.schoolwork.calendarAdd({id:current.id,taskId:calendarTask.id,title:calendarTitle,date:calendarDate})); setCalendarTask(null); }
    catch(e) { setError(errorText(e)); } finally { setCalendarBusy(false); }
  };
  const transcript = current ? transcriptText(current) : '', lessonTasks = current?.analysis.tasks.filter(t => t.kind === 'lesson') || [], assignments = current?.analysis.tasks.filter(t => t.kind === 'assignment') || [];
  const taskCard = (task: LessonTask) => <article className={'lesson-task ' + (task.completed ? 'complete' : '')} key={task.id}>
    <div className="lesson-task-top"><button className="lesson-check" aria-label={t('Markera uppgift: ', 'Complete task: ') + task.title} aria-pressed={Boolean(task.completed)} disabled={analysing || calendarBusy} onClick={() => void perform(() => window.schoolwork.lessonUpdate({id:current!.id,taskId:task.id,completed:!task.completed}))}>{task.completed && <Check size={14}/>}</button><strong>{task.title}</strong></div>
    <p>{task.details}</p><details><summary>{t('Vad läraren sa', 'What the teacher said')}</summary><blockquote>{task.evidence}</blockquote></details>
    {task.kind === 'assignment' && <><span className="lesson-due">{task.dueDate ? `${t('Datum', 'Date')}: ${task.dueDate}` : t('Datum behöver bekräftas', 'Date needs confirmation')}</span>
      {task.calendarEventId ? <button className="lesson-text-button" onClick={() => task.calendarUrl && void window.schoolwork.openUrl(task.calendarUrl)}><CheckCircle2 size={14}/>{t('Sparad i Calendar', 'Saved in Calendar')}</button> : <button className="lesson-text-button" onClick={() => openCalendarTask(task)}><CalendarDays size={14}/>{t('Lägg till i Calendar', 'Add to Calendar')}<ArrowUpRight size={13}/></button>}</>}
  </article>;
  return <div className="lesson-shell">
    <aside className="lesson-rail">
      <button className="lesson-back" disabled={locked} onClick={onBack}><ArrowLeft size={17}/><span>SchoolWork</span></button>
      <div className="lesson-brand"><span><Headphones size={24}/></span><div><strong>{t('Ditt lärande.', 'Your learning.')}<br/>{t('Samlat.', 'Together.')}</strong><small>{t('LYSSNA · FÖRSTÅ · GÖR', 'LISTEN · UNDERSTAND · DO')}</small></div></div>
      <button className={'lesson-mode ' + (mode === 'lesson' ? 'active' : '')} disabled={locked} onClick={() => {setMode('lesson');setCurrent(null);selected.current=null;}}><GraduationCap size={18}/>{t('Följ lektion', 'Follow a lesson')}</button>
      <button className={'lesson-mode ' + (mode === 'transcription' ? 'active' : '')} disabled={locked} onClick={() => {setMode('transcription');setCurrent(null);selected.current=null;}}><Mic size={18}/>{t('Transkribera', 'Transcribe')}</button>
      <div className="lesson-rail-label">{t('DINA SESSIONER', 'YOUR SESSIONS')}<button aria-label={t('Ny session', 'New session')} disabled={locked} onClick={() => void create().catch(e => setError(errorText(e)))}><Plus size={16}/></button></div>
      <div className="lesson-history">{sessions.map(s => <div className={'lesson-history-row ' + (s.id === current?.id ? 'selected' : '')} key={s.id}><button disabled={locked} onClick={() => select(s)}><span>{s.mode === 'lesson' ? <GraduationCap size={15}/> : <FileText size={15}/>}</span><div><strong>{s.title}</strong><small>{new Date(s.createdAt).toLocaleDateString(s.language === 'sv' ? 'sv-SE':'en-GB')} · {s.segments.length} {t('delar','segments')}</small></div></button><button className="lesson-delete" aria-label={t('Radera ', 'Delete ') + s.title} disabled={locked} onClick={() => setDeleteId(s.id)}><Trash2 size={13}/></button></div>)}</div>
      <button className="lesson-calendar-status" onClick={() => setShowCalendar(true)}><CalendarDays size={18}/><div><strong>Google Calendar</strong><small>{calendar.connected ? t('Ansluten', 'Connected') : t('Anslut ditt konto', 'Connect your account')}</small></div><ChevronRight size={15}/></button>
      <div className="lesson-local"><span className="lesson-dot"/>{t('Anteckningar sparas lokalt', 'Notes saved locally')}</div>
    </aside>
    <main className="lesson-main">
      <header className="lesson-topbar"><div><span>{t('LÄRANDE / ', 'LEARNING / ')}</span>{t(mode === 'lesson' ? 'LEKTIONSSTUDIO' : 'TRANSKRIBERING', mode === 'lesson' ? 'LESSON STUDIO' : 'TRANSCRIPTION')}</div><div className="lesson-language" aria-label="Whisper language"><button aria-pressed={sv} disabled={locked} onClick={() => void changeLanguage('sv')}>Svenska</button><button aria-pressed={!sv} disabled={locked} onClick={() => void changeLanguage('en')}>English</button></div></header>
      <section className="lesson-intro"><div><div className="lesson-eyebrow"><Sparkles size={13}/>{t('MER NÄRVARO. MINDRE ANTECKNANDE.', 'MORE PRESENCE. LESS NOTE-TAKING.')}</div>{current ? <input className="lesson-title" value={title} maxLength={160} aria-label={t('Sessionens namn', 'Session title')} onChange={e => setTitle(e.target.value)} onBlur={() => { if(title.trim() && title !== current.title) void perform(() => window.schoolwork.lessonUpdate({id:current.id,title:title.trim()})); else setTitle(current.title); }}/> : <h1>{t(mode === 'lesson' ? 'Var med i lektionen.' : 'Från tal till text.', mode === 'lesson' ? 'Be present in the lesson.' : 'From speech to text.')}</h1>}<p>{t(mode === 'lesson' ? 'Vi fångar orden, samlar det viktiga och hjälper dig vidare.' : 'Spela in eller ladda upp ljud. Läs, kopiera och spara ditt transkript.', mode === 'lesson' ? 'Capture the words, connect the ideas, and know what comes next.' : 'Record or upload audio. Read, copy, and save your transcript.')}</p></div><button className="lesson-outline" disabled={!current || locked} onClick={exportNotes}><Download size={15}/>{t('Exportera', 'Export')}</button></section>
      {!configured && <div className="lesson-notice">{t('Lägg till din TeachGPT-nyckel i SchoolWorks inställningar för att transkribera och sammanfatta.', 'Add your TeachGPT key in SchoolWork settings to transcribe and summarise.')}</div>}
      {error && <div className="lesson-error" role="alert"><span>{error}</span><button aria-label={t('Stäng meddelande', 'Dismiss message')} onClick={() => setError('')}><X size={15}/></button></div>}
      <div className="lesson-capture"><div className={'lesson-record-status ' + (recording ? 'live' : '')}><div className="lesson-mic-orb"><Mic size={21}/></div><div><strong>{recording ? t('Lyssnar på lektionen', 'Listening to the lesson') : starting ? t('Öppnar mikrofon…', 'Opening microphone…') : uploads ? t('Transkriberar ljud…', 'Transcribing audio…') : t('Redo när du är', 'Ready when you are')}</strong><small>{recording ? `${formatAudioTime(elapsed)} · ${t('Nya delar ungefär var 20:e sekund', 'New segments about every 20 seconds')}` : `${sv ? 'KB Whisper · Svenska' : 'Whisper · English'} · ${speechModels[language]}`}</small></div></div><div className="lesson-wave" aria-hidden="true">{Array.from({length:25},(_,i) => <i key={i} style={{height:`${recording ? 5 + level * (10 + Math.sin(i * 1.9) * 8 + i % 5 * 3) : 4 + Math.sin(i*.8)**2*9}px`}}/>)}</div><div className="lesson-capture-actions"><input ref={uploadInput} type="file" hidden accept=".wav,.mp3,.m4a,.mp4,.ogg,.webm,.flac" onChange={e => void importAudio(e.target.files?.[0])}/><button className="lesson-outline" disabled={locked || !configured} onClick={() => uploadInput.current?.click()}><FileAudio size={16}/>{t('Ljudfil', 'Audio file')}</button><button className={'lesson-primary ' + (recording ? 'pause' : '')} disabled={starting || (!recording && (uploads > 0 || !configured || Boolean(current?.pending.length)))} onClick={recording ? stop : () => void start()}>{starting ? <LoaderCircle className="spin" size={16}/> : recording ? <Pause size={16}/> : <Mic size={16}/>} {recording ? t('Pausa', 'Pause') : t(current?.segments.length ? 'Fortsätt' : 'Starta inspelning', current?.segments.length ? 'Continue' : 'Start recording')}</button></div></div>
      <div className="lesson-consent">{t('Spela in med lärarens och deltagarnas tillåtelse. Ljud skickas till skolans TeachGPT. Lyckade ljuddelar raderas efter transkribering; misslyckade delar sparas för nytt försök.', 'Record with the teacher’s and participants’ permission. Audio is sent to school TeachGPT. Successful audio segments are deleted after transcription; failed segments are retained for retry.')}</div>
      <div className={'lesson-columns ' + (mode === 'transcription' ? 'transcription-only' : '')}>
        <section className="lesson-card lesson-transcript"><div className="lesson-card-head"><div><FileText size={16}/><h2>{t('Transkript', 'Transcript')}</h2>{recording && <span className="lesson-live-pill">LIVE</span>}</div><span>{current?.segments.length || 0} {t('delar', 'segments')}</span></div><div className="lesson-scroll">
          {!transcript && <div className="lesson-empty"><div className="lesson-empty-icon"><Mic size={25}/></div><h3>{t('Orden landar här.', 'The words land here.')}</h3><p>{t('Starta mikrofonen eller välj en ljudfil. Ditt transkript växer medan du lyssnar.', 'Start the microphone or choose an audio file. Your transcript grows as you listen.')}</p></div>}
          {current?.segments.map(segment => <article className="lesson-segment" key={segment.id}><div><time>{formatAudioTime(segment.start)}</time><span>{segment.language === 'sv' ? 'SV' : 'EN'}</span></div><p>{segment.text || t('Ingen taltext i den här delen.', 'No speech text in this segment.')}</p></article>)}
          {current?.pending.map(p => <div className="lesson-pending" key={p.id}><strong>{formatAudioTime(p.start)} · {p.name}</strong><p>{p.error || t('Väntar på transkribering', 'Waiting for transcription')}</p><div><button disabled={uploads > 0} onClick={() => void retry(p.id)}><RefreshCw size={13}/>{t('Försök igen', 'Retry')}</button><button disabled={uploads > 0} onClick={() => void perform(() => window.schoolwork.lessonDiscard({id:current.id,audioId:p.id}))}><Trash2 size={13}/>{t('Ta bort ljud', 'Discard audio')}</button></div></div>)}
          {uploads > 0 && <div className="lesson-processing" role="status"><LoaderCircle className="spin" size={14}/>{t('Bearbetar', 'Processing')} {uploads} {t('ljuddel(ar)…', 'audio segment(s)…')}<button onClick={() => {stop(); if(current) void window.schoolwork.lessonCancel(current.id).catch(e => setError(errorText(e)));}}>{t('Avbryt begäran', 'Cancel request')}</button></div>}
        </div><div className="lesson-card-foot"><span>{t('Sparat på din dator', 'Saved on your computer')}</span><button disabled={!transcript} onClick={() => void navigator.clipboard.writeText(transcript).catch(e => setError(errorText(e)))}>{t('Kopiera text', 'Copy text')}</button></div></section>
        {mode === 'lesson' && <><section className="lesson-card lesson-summary"><div className="lesson-card-head"><div><Sparkles size={17}/><h2>{t('Det viktiga', 'The key ideas')}</h2></div><button className="lesson-refresh" title={t('Uppdatera sammanfattning', 'Update summary')} aria-label={t('Uppdatera sammanfattning', 'Update summary')} disabled={analysing || !transcript.trim()} onClick={() => void analyse()}><RefreshCw size={15} className={analysing ? 'spin' : ''}/></button></div><div className="lesson-scroll">
          {analysing && <div className="lesson-processing" role="status"><Sparkles size={14}/>{t('Samlar det viktigaste…', 'Connecting the key ideas…')}</div>}
          {!current?.analysis.overview ? <div className="lesson-empty"><div className="lesson-empty-icon"><Sparkles size={26}/></div><h3>{t('Förstå helheten.', 'See the bigger picture.')}</h3><p>{t('Efter de första orden samlar vi begrepp, förklaringar och nästa steg. Sammanfattningen uppdateras ungefär en gång i minuten.', 'After the first words, we organise concepts, explanations, and next steps. The summary updates about once a minute.')}</p><div className="lesson-placeholder-lines"><i/><i/><i/></div></div> : <><div className="lesson-overview"><div>{t('ÖVERBLICK', 'OVERVIEW')}</div><h3>{current.analysis.title}</h3><p>{current.analysis.overview}</p></div>{current.analysis.sections.map((s,i) => <div className="lesson-summary-section" key={i}><div className="lesson-section-number">{String(i+1).padStart(2,'0')}</div><div><h3>{s.heading}</h3><ul>{s.points.map((p,j) => <li key={j}>{p}</li>)}</ul></div></div>)}</>}
          {current?.analysisError && <div className="lesson-pending"><p>{current.analysisError}</p><button disabled={analysing} onClick={() => void analyse()}>{t('Försök sammanfatta igen', 'Retry summary')}</button></div>}
        </div><div className="lesson-card-foot"><label><input type="checkbox" checked={autoSummary} onChange={e => setAutoSummary(e.target.checked)}/>{t('Uppdatera automatiskt', 'Auto-update')}</label><span>{current?.analysisAt ? new Date(current.analysisAt).toLocaleTimeString(sv?'sv-SE':'en-GB',{hour:'2-digit',minute:'2-digit'}) : summaryModel}</span></div></section>
        <section className="lesson-card lesson-actions"><div className="lesson-card-head"><div><CheckCircle2 size={16}/><h2>{t('Ditt nästa steg', 'Your next step')}</h2></div><span>{lessonTasks.length + assignments.length}</span></div><div className="lesson-scroll"><div className="lesson-task-group"><div className="lesson-group-title"><span className="lesson-dot"/>{t('UNDER LEKTIONEN', 'DURING THE LESSON')}</div>{lessonTasks.length ? lessonTasks.map(taskCard) : <p className="lesson-muted">{t('Övningar och saker att göra nu dyker upp här.', 'Exercises and things to do now appear here.')}</p>}</div><div className="lesson-task-group"><div className="lesson-group-title"><CalendarDays size={13}/>{t('ATT LÄMNA IN & KOMMA IHÅG', 'DUE DATES & THINGS TO REMEMBER')}</div>{assignments.length ? assignments.map(taskCard) : <p className="lesson-muted">{t('Inlämningar och kommande uppgifter samlas här. Du granskar dem innan de läggs i kalendern.', 'Assignments and upcoming work collect here. You review them before they go into your calendar.')}</p>}</div></div><div className="lesson-card-foot"><span>{t('Kontrollera AI-anteckningarna', 'Check AI-generated notes')}</span></div></section></>}
      </div>
    </main>
    {showCalendar && <CalendarDialog swedish={sv} status={calendar} onStatus={setCalendar} onClose={() => setShowCalendar(false)} onError={setError}/>}
    {calendarTask && <div className="lesson-modal-backdrop"><form className="lesson-dialog" onSubmit={e => {e.preventDefault(); void saveCalendarTask();}}><button className="lesson-dialog-close" type="button" disabled={calendarBusy} aria-label={t('Stäng', 'Close')} onClick={() => setCalendarTask(null)}><X size={18}/></button><div className="lesson-dialog-icon"><CalendarDays size={26}/></div><h2>{t('Granska uppgiften', 'Review the assignment')}</h2><p>{t('Bekräfta titel och datum. Detta skapar en heldagshändelse i din anslutna Google-kalender.', 'Confirm the title and date. This creates an all-day event in your connected Google Calendar.')}</p><label>{t('Titel', 'Title')}<input required maxLength={240} value={calendarTitle} onChange={e => setCalendarTitle(e.target.value)}/></label><label>{t('Datum', 'Date')}<input type="date" required value={calendarDate} onChange={e => setCalendarDate(e.target.value)}/></label><blockquote>{calendarTask.evidence}</blockquote>{!calendar.connected ? <button type="button" className="lesson-primary" onClick={() => setShowCalendar(true)}>{t('Anslut Google Calendar', 'Connect Google Calendar')}</button> : <button className="lesson-primary" disabled={calendarBusy}>{calendarBusy ? <LoaderCircle className="spin" size={16}/> : <CalendarDays size={16}/>} {t('Bekräfta och spara', 'Confirm and save')}</button>}</form></div>}
    {deleteId && <div className="lesson-modal-backdrop"><div className="lesson-dialog"><h2>{t('Radera sessionen?', 'Delete this session?')}</h2><p>{t('Transkript, anteckningar och väntande ljud raderas från den här datorn. Redan skapade Google-händelser behålls.', 'Transcript, notes, and pending audio are deleted from this computer. Existing Google events are kept.')}</p><div className="lesson-dialog-actions"><button className="lesson-outline" onClick={() => setDeleteId(null)}>{t('Avbryt', 'Cancel')}</button><button className="lesson-primary" onClick={async () => { try { await window.schoolwork.lessonDelete(deleteId); setSessions(s => s.filter(x => x.id !== deleteId)); if(current?.id === deleteId) {setCurrent(null);selected.current=null;} setDeleteId(null); } catch(e) {setError(errorText(e));} }}>{t('Radera', 'Delete')}</button></div></div></div>}
  </div>;
}
function CalendarDialog({ swedish, status, onStatus, onClose, onError }: {swedish:boolean;status:CalendarStatus & {error?:string};onStatus:(s:CalendarStatus)=>void;onClose:()=>void;onError:(e:string)=>void}) {
  const [clientId,setClientId]=useState(''), [secret,setSecret]=useState(''), [calendarId,setCalendarId]=useState(status.calendarId), [busy,setBusy]=useState(false), [configure,setConfigure]=useState(!status.configured);
  const [localError,setLocalError]=useState('');
  const t=(sv:string,en:string)=>swedish?sv:en;
  const action=async (fn:()=>Promise<CalendarStatus>) => {setBusy(true);setLocalError('');try {onStatus(await fn());} catch(e) {setLocalError(errorText(e));onError(errorText(e));} finally {setBusy(false);} };
  return <div className="lesson-modal-backdrop calendar-dialog-layer"><div className="lesson-dialog"><button className="lesson-dialog-close" aria-label={t('Stäng','Close')} onClick={onClose}><X size={18}/></button><div className="lesson-dialog-icon"><CalendarDays size={26}/></div><h2>Google Calendar</h2><p>{t('Anslut ditt konto. SchoolWork skapar bara händelser när du granskar och bekräftar en uppgift.', 'Connect your account. SchoolWork creates events only when you review and confirm an assignment.')}</p>
    {(localError || status.error) && <p className="lesson-dialog-error" role="alert">{localError || status.error}</p>}
    {configure ? <form onSubmit={e=>{e.preventDefault();void action(async()=>{const result=await window.schoolwork.calendarConfigure({clientId,clientSecret:secret,calendarId});setSecret('');setConfigure(false);return result;});}}>
      <div className="lesson-oauth-help"><Settings2 size={17}/><div>{t('En Google OAuth-klient behövs för denna version.', 'This version needs a Google OAuth client.')}<ol><li>{t('Aktivera Google Calendar API i Google Cloud.', 'Enable Google Calendar API in Google Cloud.')}</li><li>{t('Skapa en OAuth-klient av typen Desktop app. Lägg till ditt konto som testanvändare om appen är i testläge.', 'Create an OAuth client of type Desktop app. Add your account as a test user if the app is in testing.')}</li><li>{t('Ange klientuppgifterna nedan. Klienthemligheten och kontots token krypteras på datorn.', 'Enter the client details below. The client secret and account token are encrypted on your computer.')}</li></ol><button type="button" onClick={()=>void window.schoolwork.openUrl('https://console.cloud.google.com/apis/credentials')}>{t('Öppna Google Cloud','Open Google Cloud')}<ArrowUpRight size={12}/></button></div></div>
      <label>OAuth client ID<input required value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="….apps.googleusercontent.com" autoComplete="off"/></label><label>OAuth client secret<input required type="password" value={secret} onChange={e=>setSecret(e.target.value)} autoComplete="new-password"/></label><label>{t('Kalender-ID','Calendar ID')}<input required value={calendarId} onChange={e=>setCalendarId(e.target.value)}/><small>{t('primary = din huvudkalender','primary = your main calendar')}</small></label><button className="lesson-primary" disabled={busy}>{t('Spara anslutningsinställningar','Save connection settings')}</button>
    </form> : <><div className="lesson-connected"><span className="lesson-dot"/><div><strong>{status.connected?t('Konto anslutet','Account connected'):status.connecting?t('Väntar på Google…','Waiting for Google…'):t('Redo att ansluta','Ready to connect')}</strong><small>{status.calendarId}</small></div></div><button className="lesson-primary" disabled={busy || status.connecting} onClick={()=>void action(()=>window.schoolwork.calendarConnect())}>{status.connecting?<LoaderCircle className="spin" size={16}/>:<CalendarDays size={16}/>} {status.connected?t('Anslut igen','Reconnect'):t('Logga in med Google','Sign in with Google')}</button>{status.connected && <button className="lesson-text-button" disabled={busy} onClick={()=>void action(()=>window.schoolwork.calendarDisconnect())}>{t('Koppla från konto','Disconnect account')}</button>}<button className="lesson-text-button" disabled={busy || status.connecting} onClick={()=>setConfigure(true)}>{t('Ändra OAuth-inställningar','Change OAuth settings')}</button></>}
  </div></div>;
}
