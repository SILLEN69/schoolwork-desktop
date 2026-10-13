import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ClipboardList, Flag, LoaderCircle, Plus, Timer, Trash2, X } from 'lucide-react';
import { examClock, formatExamClock, MIN_NOTES_CHARS } from '../examPrep';
import type { ExamAnswer, ExamDocument, ExamQuestion, ExamSummary } from '../examPrep';
import './exam.css';

type LessonSource = { id: string; title: string; language: 'sv' | 'en'; updatedAt: number };
type Props = {
  configured: boolean; model: string; swedish: boolean; onBack: () => void;
  target?: { examId?: string; lessonId?: string } | null;
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const kindLabel = (swedish: boolean, kind: ExamQuestion['kind']) =>
  kind === 'mc' ? t2('MULTIPLE CHOICE', 'FELVAL', swedish) : kind === 'short' ? t2('SHORT ANSWER', 'KORTSVAR', swedish) : t2('EXPLAIN', 'FÖRKLARA', swedish);
const t2 = (en: string, sv: string, swedish: boolean) => (swedish ? sv : en);

export default function ExamPrepView({ configured, model, swedish, onBack, target }: Props) {
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [current, setCurrent] = useState<ExamDocument | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<'lesson' | 'notes'>('lesson');
  const [lessonSources, setLessonSources] = useState<LessonSource[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteLanguage, setNoteLanguage] = useState<'sv' | 'en'>(swedish ? 'sv' : 'en');
  const [building, setBuilding] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [now, setNow] = useState(() => Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  const targetUsed = useRef(false);
  const submitInFlight = useRef(false);
  const textTimers = useRef<Record<string, number>>({});
  const currentRef = useRef<ExamDocument | null>(null);
  const answersRef = useRef(answers);
  currentRef.current = current;
  answersRef.current = answers;

  const refreshList = async () => {
    const list = await window.schoolwork.examList();
    if (mounted.current) setExams(list);
    return list;
  };
  const selectExam = (id: string) => {
    setBuilderOpen(false); setError(''); setNotice(''); setConfirmSubmit(false);
    void window.schoolwork.examGet(id).then(doc => {
      if (!mounted.current) return;
      setCurrent(doc);
      setIndex(0);
      setAnswers(doc.state.answers);
    }).catch(e => { if (mounted.current) setError(errorText(e)); });
  };
  const loadSources = async () => {
    try {
      const srcs = await window.schoolwork.examLessonSources();
      if (!mounted.current) return;
      setLessonSources(srcs);
      setSelectedLessonId(previous => previous || (srcs.some(s => s.id === target?.lessonId) ? target!.lessonId! : srcs[0]?.id || ''));
    } catch (e) { if (mounted.current) setError(errorText(e)); }
  };
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const list = await window.schoolwork.examList();
        if (!mounted.current) return;
        setExams(list);
        if (target?.examId && list.some(x => x.id === target.examId)) {
          targetUsed.current = true;
          selectExam(target.examId);
        } else if (target?.lessonId) {
          // Deep link from a finished lesson: open the builder with that lesson preselected.
          targetUsed.current = true;
          setBuilderOpen(true); setBuilderMode('lesson');
          await loadSources();
        }
      } catch (e) { if (mounted.current) setError(errorText(e)); }
    })();
    return () => {
      mounted.current = false;
      Object.values(textTimers.current).forEach(window.clearTimeout);
    };
  }, []);

  const openBuilder = (mode: 'lesson' | 'notes') => {
    setCurrent(null); setBuilderOpen(true); setBuilderMode(mode); setError(''); setNotice('');
    if (mode === 'lesson' && !lessonSources.length) void loadSources();
  };
  const switchMode = (mode: 'lesson' | 'notes') => {
    setBuilderMode(mode);
    if (mode === 'lesson' && !lessonSources.length) void loadSources();
  };
  const build = async () => {
    if (building || (builderMode === 'lesson' ? !selectedLessonId : noteText.trim().length < MIN_NOTES_CHARS)) return;
    setBuilding(true); setError(''); setNotice('');
    try {
      const doc = builderMode === 'lesson'
        ? await window.schoolwork.examBuild({ kind: 'lesson', lessonId: selectedLessonId }, model)
        : await window.schoolwork.examBuild({ kind: 'notes', text: noteText.trim(), language: noteLanguage, ...(noteTitle.trim() ? { title: noteTitle.trim() } : {}) }, model);
      if (!mounted.current) return;
      setBuilderOpen(false); setNoteText(''); setNoteTitle('');
      void refreshList();
      setCurrent(doc); setIndex(0); setAnswers(doc.state.answers);
    } catch (e) { if (mounted.current) setError(errorText(e)); }
    finally { setBuilding(false); }
  };
  const start = async () => {
    const doc = currentRef.current;
    if (!doc) return;
    try {
      const updated = await window.schoolwork.examStart(doc.id);
      if (!mounted.current) return;
      setCurrent(updated); setAnswers(updated.state.answers); setIndex(0);
      setNow(Date.now());
    } catch (e) { if (mounted.current) setError(errorText(e)); }
  };
  const persist = (questionId: string, entry: ExamAnswer) => {
    const doc = currentRef.current;
    if (!doc || doc.state.status !== 'in_progress') return;
    void window.schoolwork.examAnswer({ id: doc.id, questionId, answer: entry }).catch(e => { if (mounted.current) setError(errorText(e)); });
  };
  const pickOption = (question: ExamQuestion, optionIndex: number) => {
    const entry: ExamAnswer = { ...answers[question.id], optionIndex };
    setAnswers(prev => ({ ...prev, [question.id]: entry }));
    persist(question.id, entry);
  };
  const toggleFlag = (question: ExamQuestion) => {
    const entry: ExamAnswer = { ...answers[question.id], flagged: !answers[question.id]?.flagged };
    setAnswers(prev => ({ ...prev, [question.id]: entry }));
    persist(question.id, entry);
  };
  const changeText = (question: ExamQuestion, text: string) => {
    setAnswers(prev => ({ ...prev, [question.id]: { ...prev[question.id], text } }));
    const doc = currentRef.current;
    if (!doc || doc.state.status !== 'in_progress') return;
    window.clearTimeout(textTimers.current[question.id]);
    textTimers.current[question.id] = window.setTimeout(() => {
      persist(question.id, { ...answersRef.current[question.id], text });
    }, 500);
  };
  const isAnswered = (q: ExamQuestion) => {
    const a = answers[q.id];
    if (!a) return false;
    return q.kind === 'mc' ? a.optionIndex !== undefined : Boolean((a.text ?? '').trim());
  };
  const doSubmit = async (auto = false) => {
    const doc = currentRef.current;
    if (!doc || doc.state.status !== 'in_progress' || submitInFlight.current) return;
    submitInFlight.current = true;
    setConfirmSubmit(false);
    try {
      const updated = await window.schoolwork.examSubmit({ id: doc.id, answers: answersRef.current });
      if (!mounted.current) return;
      setCurrent(updated);
      setAnswers(updated.state.answers);
      if (auto) setNotice(t('Time is up — the exam was submitted with the answers you had saved.', 'Tiden är ute — provet lämnades in med de svar du hade sparade.'));
      void refreshList();
    } catch (e) { if (mounted.current) setError(errorText(e)); }
    finally { submitInFlight.current = false; }
  };
  const requestSubmit = () => {
    const doc = currentRef.current;
    if (!doc) return;
    if (doc.questions.some(q => !isAnswered(q))) setConfirmSubmit(true);
    else void doSubmit(false);
  };
  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await window.schoolwork.examDelete(deleteId);
      if (current?.id === deleteId) setCurrent(null);
      setDeleteId(null);
      await refreshList();
    } catch (e) { if (mounted.current) setError(errorText(e)); }
  };

  const doc = current;
  const endsAt = doc && doc.state.status === 'in_progress' && doc.state.startedAt ? doc.state.startedAt + doc.durationMin * 60_000 : null;
  useEffect(() => {
    if (endsAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  useEffect(() => {
    if (!doc || doc.state.status !== 'in_progress' || endsAt === null) return;
    if (examClock(endsAt, now).expired) void doSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, endsAt, doc]);

  const question = doc?.questions[Math.min(index, (doc?.questions.length ?? 1) - 1)];
  const remainingMs = endsAt !== null ? examClock(endsAt, now).remainingMs : 0;
  const modeLabel = builderOpen
    ? t('NEW EXAM', 'NYTT PROV')
    : !doc ? t('CHOOSE', 'VÄLJ')
    : doc.state.status === 'in_progress' ? t('IN PROGRESS', 'PÅGÅR')
    : doc.state.status === 'submitted' ? t('SUBMITTED', 'LÄMNAT IN')
    : t('READY', 'KLAR');
  const statusChip = (s: ExamSummary) => s.status === 'submitted'
    ? t('Taken', 'Klart') : s.status === 'in_progress' ? t('In progress', 'Pågår') : t('Ready', 'Klar');
  const sourceLine = (d: Pick<ExamDocument, 'sourceKind' | 'sourceTitle' | 'builtWith'>) =>
    (d.sourceKind === 'lesson' ? t(`From lesson “${d.sourceTitle}”`, `Från lektionen “${d.sourceTitle}”`) : t('From your notes', 'Från dina anteckningar'))
    + (d.builtWith === 'model' ? (configured ? t(` · built with ${model}`, ` · byggd med ${model}`) : t(' · built with the model', ' · byggd med modellen')) : t(' · built offline from the key concepts (multiple choice only)', ' · byggd offline från nyckelbegreppen (endast flervalsfrågor)'));

  return <div className="lesson-shell exam-shell">
    <aside className="lesson-rail">
      <button className="lesson-back" disabled={building} onClick={onBack}><ArrowLeft size={17}/><span>SchoolWork</span></button>
      <div className="lesson-brand"><span><ClipboardList size={24}/></span><div><strong>{t('Practice exams.', 'Övningsprov.')}<br/>{t('Built to be taken.', 'Skapade att läggas.')}</strong><small>{t('BUILD · TAKE · SUBMIT', 'BYGG · LÄGG · LÄMNA IN')}</small></div></div>
      <button className="lesson-mode" disabled={building} onClick={() => openBuilder('lesson')}><Plus size={18}/>{t('New practice exam', 'Nytt övningsprov')}</button>
      <div className="lesson-rail-label">{t('YOUR EXAMS', 'DINA PROV')}</div>
      <div className="lesson-history">{exams.map(s => <div className={'lesson-history-row ' + (s.id === doc?.id ? 'selected' : '')} key={s.id}>
        <button disabled={building} onClick={() => selectExam(s.id)}><div><strong>{s.title}</strong><small>{new Date(s.createdAt).toLocaleDateString('sv-SE')} · {s.questionCount} {t('questions', 'frågor')}{s.builtWith === 'offline' ? ' · ' + t('offline', 'offline') : ''}{s.status !== 'ready' ? ' · ' + statusChip(s) : ''}</small></div></button>
        <button className="lesson-delete" aria-label={t('Delete ', 'Radera ') + s.title} disabled={building} onClick={() => setDeleteId(s.id)}><Trash2 size={13}/></button>
      </div>)}</div>
      <div className="lesson-local"><span className="lesson-dot"/>{t('Exams are saved on this computer', 'Proven sparas på den här datorn')}</div>
    </aside>
    <main className="lesson-main">
      <header className="lesson-topbar"><div><span>{t('PRACTICE EXAMS / ', 'ÖVNINGSPROV / ')}</span>{modeLabel}</div></header>
      {builderOpen && <>
        <section className="lesson-intro"><div>
          <div className="lesson-eyebrow exam-eyebrow"><ClipboardList size={13}/>{t('BUILD A PRACTICE EXAM', 'BYGG ETT ÖVNINGSPROV')}</div>
          <h1>{t('One source, a full exam.', 'En källa, ett helt prov.')}</h1>
          <p>{t('Pick a finished lesson or paste your notes. SchoolWork builds 8-12 mixed questions — multiple choice, short answer and one explanation question — with a timed taking flow.', 'Välj en slutförd lektion eller klistra in dina anteckningar. SchoolWork bygger 8-12 blandade frågor — flervalsfrågor, kortsvar och en förklaringsfråga — med en timad provrättning.')}</p>
        </div></section>
        <div className="follow-banner"><Timer size={15}/><span>{configured ? t(`Questions are built with ${model}`, `Frågorna byggs med ${model}`) : t('No API key configured — the exam is built offline from the key concepts (multiple choice only).', 'Ingen API-nyckel — provet byggs offline från nyckelbegreppen (endast flervalsfrågor).')}</span></div>
        <div className="lesson-card exam-builder-card">
          <div className="exam-tabs" role="tablist" aria-label={t('Exam source', 'Provkälla')}>
            <button role="tab" aria-selected={builderMode === 'lesson'} className={builderMode === 'lesson' ? 'active' : ''} onClick={() => switchMode('lesson')}>{t('A finished lesson', 'En slutförd lektion')}</button>
            <button role="tab" aria-selected={builderMode === 'notes'} className={builderMode === 'notes' ? 'active' : ''} onClick={() => switchMode('notes')}>{t('My own notes', 'Mina anteckningar')}</button>
          </div>
          <div className="lesson-scroll exam-builder-scroll">
            {builderMode === 'lesson' && (
              lessonSources.length
                ? <div className="exam-source-list">{lessonSources.map(s => <button key={s.id} className={'exam-source-row' + (s.id === selectedLessonId ? ' selected' : '')} onClick={() => setSelectedLessonId(s.id)}>
                    <span className="exam-source-check"><Check size={13}/></span>
                    <span><strong>{s.title}</strong><small>{new Date(s.updatedAt).toLocaleDateString('sv-SE')}</small></span>
                  </button>)}</div>
                : <div className="lesson-notice">{t('No finished lessons yet — follow a lesson to the end first.', 'Inga slutförda lektioner ännu — följ en lektion till slutet först.')}</div>
            )}
            {builderMode === 'notes' && <>
              <div className="follow-field"><span>{t('TITLE (OPTIONAL)', 'TITEL (VALFRI)')}</span><input value={noteTitle} maxLength={160} onChange={e => setNoteTitle(e.target.value)} placeholder={t('Use the first heading if left empty', 'Använd den första rubriken om tomt')}/></div>
              <div className="follow-field"><span>{t('NOTES', 'ANTECKNINGAR')}</span><textarea className="follow-textarea" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder={t('Paste the notes here.', 'Klistra in anteckningarna här.')}/></div>
              {noteText.trim().length > 0 && noteText.trim().length < MIN_NOTES_CHARS && <p className="lesson-muted">{t(`At least ${MIN_NOTES_CHARS} characters are needed.`, `Minst ${MIN_NOTES_CHARS} tecken krävs.`)}</p>}
            </>}
          </div>
          {builderMode === 'notes' && <div className="exam-lang" aria-label={t('Notes language', 'Anteckningarnas språk')}><button aria-pressed={noteLanguage === 'sv'} onClick={() => setNoteLanguage('sv')}>Svenska</button><button aria-pressed={noteLanguage === 'en'} onClick={() => setNoteLanguage('en')}>English</button></div>}
          <div className="lesson-card-foot">
            <button className="lesson-outline" onClick={() => { setBuilderOpen(false); setCurrent(null); }}><ChevronLeft size={16}/> {t('Back', 'Tillbaka')}</button>
            <button className="lesson-primary" data-exam-build disabled={building || (builderMode === 'lesson' ? !selectedLessonId : noteText.trim().length < MIN_NOTES_CHARS)} onClick={() => void build()}>{building ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>}{building ? t('Building the exam…', 'Bygger provet…') : t('Build practice exam', 'Bygg övningsprov')}</button>
          </div>
        </div>
      </>}
      {!builderOpen && !doc && (
        <section className="lesson-intro"><div>
          <div className="lesson-eyebrow exam-eyebrow"><ClipboardList size={13}/>{t('PRACTICE BEFORE THE REAL THING', 'ÖVA INFÖR DET ÄKTA PROVET')}</div>
          <h1>{t('Test yourself the honest way.', 'Testa dig själv på ärligt vis.')}</h1>
          <p>{t('A practice exam mixes multiple choice, short answers and one explanation question, runs on a countdown timer, and remembers every answer you submit.', 'Ett övningsprov blandar flervalsfrågor, kortsvar och en förklaringsfråga, körs med en nedräkning och minns varje svar du lämnar in.')}</p>
        </div></section>
      )}
      {!builderOpen && doc && doc.state.status === 'ready' && (
        <div className="lesson-card exam-ready-card">
          <div className="lesson-card-head"><div><h2>{doc.title}</h2><p className="lesson-source">{sourceLine(doc)}</p></div><span>{t('READY', 'KLAR')}</span></div>
          <div className="lesson-scroll exam-ready-scroll">
            <div className="follow-stats">
              <div className="follow-stat"><small>{t('QUESTIONS', 'FRÅGOR')}</small><strong>{doc.questions.length}</strong></div>
              <div className="follow-stat"><small>{t('TIME', 'TID')}</small><strong>{doc.durationMin} {t('min', 'min')}</strong></div>
              <div className="follow-stat"><small>{t('TYPES', 'TYPER')}</small><strong>{doc.questions.filter(q => q.kind === 'mc').length}<span className="follow-stat-sub">{t('mc', 'fl')} · {doc.questions.filter(q => q.kind === 'short').length} {t('short', 'k')} · {doc.questions.filter(q => q.kind === 'explain').length} {t('explain', 'f')}</span></strong></div>
            </div>
            <p className="follow-done-copy">{t('When you start, the countdown runs from the default duration. You can move freely between questions and flag them, and submitting locks your answers.', 'När du startar räknar nedräkningen från standardtiden. Du kan fritt växla mellan frågorna och markera dem, och inlämning låser svaren.')}</p>
          </div>
          <div className="lesson-card-foot">
            <button className="lesson-outline" onClick={() => setCurrent(null)}><ChevronLeft size={16}/> {t('Back', 'Tillbaka')}</button>
            <button className="lesson-primary" data-exam-start onClick={() => void start()}><Timer size={16}/> {t('Start the exam', 'Starta provet')}</button>
          </div>
        </div>
      )}
      {!builderOpen && doc && doc.state.status === 'in_progress' && question && <>
        <section className="lesson-intro"><div>
          <div className="lesson-eyebrow exam-eyebrow"><Timer size={13}/>{t('EXAM IN PROGRESS', 'PROV PÅGÅR')}</div>
          <h1>{doc.title}</h1>
          <div className="exam-timer-row"><span className={'exam-timer' + (remainingMs < 60_000 ? ' low' : '')} data-exam-timer><Timer size={14}/>{formatExamClock(remainingMs)}</span><span className="follower-progress-row"><span className="follower-progress-label">{t(`Question ${index + 1} of ${doc.questions.length}`, `Fråga ${index + 1} av ${doc.questions.length}`)}<span className="follow-progress"><span style={{ width: `${Math.round(((index + 1) / doc.questions.length) * 100)}%` }}/></span></span></span></div>
        </div></section>
        <div className="lesson-card exam-question-card">
          <div className="lesson-card-head"><div><h2>{question.prompt}</h2></div><span className={'exam-kind ' + question.kind}>{kindLabel(swedish, question.kind)}</span></div>
          <div className="lesson-scroll exam-question-scroll">
            {question.kind === 'mc' && question.options ? (
              <div className="follow-quiz-options">{question.options.map((opt, i) => (
                <button key={i} data-exam-option={i} className={'follow-quiz-option' + (answers[question.id]?.optionIndex === i ? ' correct' : '')} onClick={() => pickOption(question, i)}><span>{String.fromCharCode(65 + i)}</span>{opt}</button>
              ))}</div>
            ) : (
              <textarea data-exam-answer className="follow-answer-textarea exam-answer-textarea" value={answers[question.id]?.text ?? ''} maxLength={4000} rows={question.kind === 'explain' ? 8 : 4} placeholder={question.kind === 'explain'
                ? t('Explain it in a few sentences…', 'Förklara det på några meningar…')
                : t('Write your answer…', 'Skriv ditt svar…')} onChange={e => changeText(question, e.target.value)}/>
            )}
          </div>
          <div className="lesson-card-foot exam-take-foot">
            <button className={'lesson-outline exam-flag' + (answers[question.id]?.flagged ? ' flagged' : '')} data-exam-flag aria-pressed={Boolean(answers[question.id]?.flagged)} onClick={() => toggleFlag(question)}><Flag size={15}/> {answers[question.id]?.flagged ? t('Flagged', 'Markerad') : t('Flag', 'Markera')}</button>
            <button className="lesson-outline" data-exam-prev disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}><ChevronLeft size={16}/> {t('Previous', 'Föregående')}</button>
            {index + 1 < doc.questions.length
              ? <button className="lesson-primary" data-exam-next onClick={() => setIndex(i => Math.min(doc.questions.length - 1, i + 1))}>{t('Next', 'Nästa')}<ChevronRight size={16}/></button>
              : <button className="lesson-primary" data-exam-submit onClick={requestSubmit}><Check size={15}/> {t('Submit exam', 'Lämna in provet')}</button>}
          </div>
        </div>
        <nav className="follower-jump exam-jump" aria-label={t('Jump to a question', 'Gå till en fråga')}>{doc.questions.map((q, i) => (
          <button key={q.id} title={q.prompt} aria-label={`${t('Go to question', 'Gå till fråga')} ${i + 1}`} aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)} className={(answers[q.id]?.flagged ? ' flagged' : '') + (isAnswered(q) ? ' answered' : '')}>{i + 1}</button>
        ))}</nav>
      </>}
      {!builderOpen && doc && doc.state.status === 'submitted' && (
        <div className="lesson-card exam-submitted-card">
          <div className="lesson-card-head"><div><h2>{doc.title}</h2><p className="lesson-source">{sourceLine(doc)}</p></div><span className="exam-submitted-chip">{t('SUBMITTED', 'LÄMNAT IN')}</span></div>
          <div className="lesson-scroll exam-submitted-scroll">
            <div className="exam-submitted-banner"><Timer size={15}/><span>{t(`Submitted ${new Date(doc.state.submittedAt ?? doc.updatedAt).toLocaleString('sv-SE')} · took ${formatExamClock(doc.state.timeUsedMs ?? 0)}`, `Lämnad in ${new Date(doc.state.submittedAt ?? doc.updatedAt).toLocaleString('sv-SE')} · tog ${formatExamClock(doc.state.timeUsedMs ?? 0)}`)}{doc.state.autoSubmitted ? ` · ${t('time ran out', 'tiden gick ut')}` : ''}</span></div>
            {doc.questions.map((q, i) => {
              const a = doc.state.answers[q.id];
              const answered = a && (a.optionIndex !== undefined || (a.text ?? '').trim());
              const answerText = q.kind === 'mc'
                ? (a?.optionIndex !== undefined && q.options ? String.fromCharCode(65 + a.optionIndex) + ' — ' + q.options[a.optionIndex] : t('(no answer)', '(inga svar)'))
                : (a?.text || t('(no answer)', '(inga svar)'));
              return <div key={q.id} className="exam-review-row">
                <div className="follow-answer-top"><span>{i + 1}. {q.prompt}</span>{a?.flagged && <Flag size={12} className="exam-flag-icon" aria-label={t('Flagged', 'Markerad')}/>}<span className={'exam-kind ' + q.kind}>{kindLabel(swedish, q.kind)}</span></div>
                <p className={'follow-answer-text' + (answered ? '' : ' muted')}>{answerText}</p>
              </div>;
            })}
            <p className="follow-done-copy">{t('Your answers are stored with the exam. Grading and a mistake review come in the next phase.', 'Dina svar sparas med provet. Rättning och felgenomgång kommer i nästa fas.')}</p>
          </div>
          <div className="lesson-card-foot">
            <button className="lesson-outline" onClick={() => setCurrent(null)}><ChevronLeft size={16}/> {t('Back to my exams', 'Tillbaka till mina proven')}</button>
          </div>
        </div>
      )}
      {notice && <div className="lesson-notice">{notice}</div>}
      {error && <div className="lesson-error" role="alert"><span>{error}</span><button aria-label={t('Dismiss message', 'Stäng meddelande')} onClick={() => setError('')}><X size={15}/></button></div>}
    </main>
    {confirmSubmit && <div className="lesson-modal-backdrop"><div className="lesson-dialog"><h2>{t('Submit the exam?', 'Lämna in provet?')}</h2><p>{t(`You still have ${doc?.questions.filter(q => !isAnswered(q)).length ?? 0} unanswered question${(doc?.questions.filter(q => !isAnswered(q)).length ?? 0) === 1 ? '' : 's'}. Submitted answers can no longer be changed.`, `Du har fortfarande ${doc?.questions.filter(q => !isAnswered(q)).length ?? 0} obesvarad(e) fråga(er). Lämnade in svar kan inte ändras längre.`)}</p><div className="lesson-dialog-actions"><button className="lesson-outline" onClick={() => setConfirmSubmit(false)}>{t('Keep working', 'Fortsätt arbeta')}</button><button className="lesson-primary" data-exam-submit-confirm onClick={() => void doSubmit(false)}>{t('Submit now', 'Lämna in nu')}</button></div></div></div>}
    {deleteId && <div className="lesson-modal-backdrop"><div className="lesson-dialog"><h2>{t('Delete this exam?', 'Radera detta prov?')}</h2><p>{t('The exam, its questions and your saved answers are deleted from this computer.', 'Provet, dess frågor och dina sparade svar raderas från den här datorn.')}</p><div className="lesson-dialog-actions"><button className="lesson-outline" onClick={() => setDeleteId(null)}>{t('Cancel', 'Avbryt')}</button><button className="lesson-primary" onClick={() => void doDelete()}>{t('Delete', 'Radera')}</button></div></div></div>}
  </div>;
}
