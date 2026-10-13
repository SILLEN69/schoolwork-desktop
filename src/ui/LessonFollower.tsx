import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpenCheck, Check, ChevronLeft, ChevronRight, ClipboardList, Eye, FileText, Flag, Layers, LoaderCircle, Plus, RefreshCw, Repeat, RotateCcw, SkipForward, Sparkles, Trash2, X } from 'lucide-react';
import MessageMarkdown from './MessageMarkdown';
import type { FollowLesson, FollowSegment } from '../lessonFollower';
import type { ReviewDeckView, ReviewMark } from '../reviewDeck';
import './lessons.css';
type Props = {
  configured: boolean; model: string; swedish: boolean; onBack: () => void; onWork: (chatId: string) => void;
  onExam?: (lessonId: string) => void;
  target?: { lessonId: string; review: boolean } | null;
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
export default function LessonFollower({ configured, model, swedish, onBack, onWork, onExam, target }: Props) {
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const [lessons, setLessons] = useState<FollowLesson[]>([]);
  const [current, setCurrent] = useState<FollowLesson | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importLanguage, setImportLanguage] = useState<'sv' | 'en'>(swedish ? 'sv' : 'en');
  const [asking, setAsking] = useState(false);
  const [chat, setChat] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deck, setDeck] = useState<ReviewDeckView | null>(null);
  const [inReview, setInReview] = useState(false);
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState<'cards' | 'quiz' | 'done'>('cards');
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizPicked, setQuizPicked] = useState<number | null>(null);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [gotCards, setGotCards] = useState(0);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const mounted = useRef(true), selected = useRef<FollowLesson | null>(null), firstLoad = useRef(true), targetUsed = useRef(false);
  selected.current = current;
  const select = (lesson: FollowLesson) => { selected.current = lesson; setCurrent(lesson); setError(''); setNotice(''); setShowReport(Boolean(lesson.follow.report)); setDeck(null); setInReview(false); setConfirmRegen(false); };
  const accept = (lesson: FollowLesson) => {
    if (!mounted.current) return;
    setLessons(previous => [lesson, ...previous.filter(x => x.id !== lesson.id)]);
    if (selected.current?.id === lesson.id) setCurrent(lesson);
  };
  const load = async () => {
    try {
      const list = await window.schoolwork.followList();
      if (!mounted.current) return;
      setLessons(list);
      if (firstLoad.current && !selected.current) {
        const wanted = target ? list.find(x => x.id === target.lessonId) : undefined;
        if (wanted) select(wanted);
        else if (list.length) select(list[0]);
      }
      firstLoad.current = false;
    } catch (e) { if (mounted.current) setError(errorText(e)); }
  };
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!importing) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [importing]);
  const importLesson = async () => {
    if (!importText.trim() || importing) return;
    setImporting(true); setError(''); setNotice('');
    try {
      const lesson = await window.schoolwork.followImport({ text: importText, language: importLanguage, ...(importTitle.trim() ? { title: importTitle.trim() } : {}) });
      setImportText(''); setImportTitle('');
      select(lesson);
    } catch (e) { setError(errorText(e)); }
    finally { setImporting(false); }
  };
  const importFile = async () => {
    if (importing) return;
    setImporting(true); setError(''); setNotice('');
    try {
      const lesson = await window.schoolwork.followFile();
      if (lesson) select(lesson);
    } catch (e) { setError(errorText(e)); }
    finally { setImporting(false); }
  };
  const advance = async (index: number) => {
    const lesson = selected.current;
    if (!lesson || importing) return;
    try { accept(await window.schoolwork.followAdvance({ id: lesson.id, index })); }
    catch (e) { setError(errorText(e)); }
  };
  const explain = async () => {
    const lesson = selected.current;
    if (!lesson || importing) return;
    const segment = lesson.follow.segments[lesson.follow.current];
    if (!segment) return;
    if (!configured) {
      setNotice(t('Explanations need your TeachGPT API key. Add it in Settings to use “Explain more”.', 'Förklaringar behöver din TeachGPT API-nyckel. Lägg till den i Inställningar för att använda “Förklara mer”.'));
      return;
    }
    setAsking(true); setNotice(''); setError('');
    try {
      await window.schoolwork.followExplain({ id: lesson.id, segmentId: segment.id });
      accept(await window.schoolwork.followGet(lesson.id));
    } catch (e) { setError(errorText(e)); }
    finally { setAsking(false); }
  };
  const prepare = async () => {
    const lesson = selected.current;
    if (!lesson || importing || checking) return;
    const segment = lesson.follow.segments[lesson.follow.current];
    if (!segment || segment.questions.length) return;
    setChecking(true); setError('');
    try { accept(await window.schoolwork.followQuestions({ id: lesson.id, segmentId: segment.id, model })); }
    catch (e) { setError(errorText(e)); }
    finally { setChecking(false); }
  };
  const setDraftFor = (segment: FollowSegment, index: number, value: string) => {
    setDrafts(d => {
      const list = d[segment.id] ?? segment.questions.map(q => q.answer ?? '');
      return { ...d, [segment.id]: list.map((a, i) => (i === index ? value : a)) };
    });
  };
  const saveAnswers = async () => {
    const lesson = selected.current;
    if (!lesson || importing || saving) return;
    const segment = lesson.follow.segments[lesson.follow.current];
    if (!segment || !segment.questions.length) return;
    const answers = segment.questions.map((_, i) => (drafts[segment.id]?.[i] ?? '').trim().slice(0, 2000));
    if (!answers.some(a => a)) { setNotice(t('Write at least one answer, or skip the part.', 'Skriv minst ett svar, eller hoppa över delen.')); return; }
    setSaving(true); setError(''); setNotice('');
    try { accept(await window.schoolwork.followAnswer({ id: lesson.id, segmentId: segment.id, answers, model })); }
    catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  };
  const skipPart = async () => {
    const lesson = selected.current;
    if (!lesson || importing) return;
    const segment = lesson.follow.segments[lesson.follow.current];
    if (!segment || segment.status === 'answered') return;
    try { accept(await window.schoolwork.followSkip({ id: lesson.id, segmentId: segment.id })); }
    catch (e) { setError(errorText(e)); }
  };
  const finish = async () => {
    const lesson = selected.current;
    if (!lesson || importing) return;
    try { accept(await window.schoolwork.followFinish(lesson.id)); setShowReport(true); }
    catch (e) { setError(errorText(e)); }
  };
  const startDeck = (d: ReviewDeckView) => {
    setDeck(d); setInReview(true); setShowReport(false); setConfirmRegen(false);
    setStage(d.cards.length ? 'cards' : d.quiz.length ? 'quiz' : 'done');
    setCardIndex(0); setRevealed(false); setQuizIndex(0); setQuizPicked(null); setQuizCorrect(0); setGotCards(0);
  };
  /** Builds (or rebuilds) the lesson's single review deck through the model when a key is configured. */
  const buildDeck = async () => {
    const lesson = selected.current;
    if (!lesson || building) return;
    setBuilding(true); setError(''); setNotice('');
    try { startDeck(await window.schoolwork.followDeckGenerate({ id: lesson.id, model })); }
    catch (e) { setError(errorText(e)); }
    finally { setBuilding(false); }
  };
  const openDeck = async () => {
    const lesson = selected.current;
    if (!lesson) return;
    try {
      const d = await window.schoolwork.followDeck(lesson.id);
      if (!d) { setNotice(t('No review deck yet — build one first.', 'Ingen repeteringsdeck ännu — bygg en först.')); return; }
      startDeck(d);
    } catch (e) { setError(errorText(e)); }
  };
  const markCard = async (result: ReviewMark) => {
    const lesson = selected.current;
    if (!lesson || !deck) return;
    try {
      const res = await window.schoolwork.followReviewMark({ id: lesson.id, kind: 'card', itemIndex: cardIndex, result });
      setDeck(previous => (previous ? { ...previous, items: previous.items.map(it => (it.id === res.item.id ? res.item : it)) } : previous));
      if (result === 'got') setGotCards(n => n + 1);
      if (cardIndex + 1 < deck.cards.length) { setCardIndex(i => i + 1); setRevealed(false); }
      else if (deck.quiz.length) setStage('quiz');
      else setStage('done');
    } catch (e) { setError(errorText(e)); }
  };
  const pickQuiz = async (option: number) => {
    const lesson = selected.current;
    if (!lesson || !deck || quizPicked !== null) return;
    const question = deck.quiz[quizIndex];
    if (!question) return;
    const hit = option === question.answer;
    setQuizPicked(option);
    if (hit) setQuizCorrect(n => n + 1);
    try {
      const res = await window.schoolwork.followReviewMark({ id: lesson.id, kind: 'quiz', itemIndex: quizIndex, result: hit ? 'got' : 'still' });
      setDeck(previous => (previous ? { ...previous, items: previous.items.map(it => (it.id === res.item.id ? res.item : it)) } : previous));
    } catch (e) { setError(errorText(e)); }
  };
  const nextQuiz = () => {
    if (!deck) return;
    if (quizIndex + 1 < deck.quiz.length) { setQuizIndex(i => i + 1); setQuizPicked(null); }
    else setStage('done');
  };
  const exitReview = () => {
    const lesson = selected.current;
    setInReview(false); setConfirmRegen(false);
    setShowReport(Boolean(lesson?.follow.report));
  };
  useEffect(() => {
    const chatId = current?.follow.explainChatId;
    if (!chatId) { setChat(null); return; }
    let active = true;
    const loadChat = () => window.schoolwork.getChat(chatId).then(c => { if (active) setChat(c); }).catch(() => {});
    void loadChat();
    const timer = setInterval(() => void loadChat(), 2500);
    return () => { active = false; clearInterval(timer); };
  }, [current?.follow.explainChatId]);
  // Keep the footer in sync with the lesson's persisted deck, so an existing deck offers “Open review deck” instead of a rebuild.
  useEffect(() => {
    if (!current?.id) { setDeck(null); return; }
    let active = true;
    window.schoolwork.followDeck(current.id).then(d => { if (active) setDeck(d); }).catch(() => {});
    return () => { active = false; };
  }, [current?.id]);
  // Deep link from the due-review queue: open this lesson's review deck directly.
  useEffect(() => {
    if (targetUsed.current || !target?.review || !current || current.id !== target.lessonId) return;
    targetUsed.current = true;
    void window.schoolwork.followDeck(current.id).then(d => {
      if (mounted.current && d) startDeck(d);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);
  const doDelete = async () => {
    if (!deleteId) return;
    try {
      await window.schoolwork.followDelete(deleteId);
      if (current?.id === deleteId) { setCurrent(null); selected.current = null; }
      setDeleteId(null);
      await load();
    } catch (e) { setError(errorText(e)); }
  };
  const lesson = current, state = lesson?.follow ?? null, index = state ? Math.min(state.current, state.segments.length - 1) : 0;
  const segment = state?.segments[index], total = state?.segments.length ?? 0, done = segment ? index + 1 : 0;
  const busy = asking || Boolean(chat?.task && ['running', 'queued'].includes(chat.task.state));
  const replies = chat?.messages?.filter((m: any) => m.role === 'assistant' && m.content && !m.toolCalls?.length).slice(-1) ?? [];
  const report = state?.report ?? null;
  const flagged = new Set(report?.reviewSegmentIds ?? []);
  const firstFlagged = state ? state.segments.findIndex(s => flagged.has(s.id)) : -1;
  const reviewFirst = async () => {
    const l = selected.current;
    if (!l || firstFlagged < 0) return;
    try { accept(await window.schoolwork.followAdvance({ id: l.id, index: firstFlagged })); setShowReport(false); }
    catch (e) { setError(errorText(e)); }
  };
  return <div className="lesson-shell">
    <aside className="lesson-rail">
      <button className="lesson-back" disabled={importing} onClick={onBack}><ArrowLeft size={17}/><span>SchoolWork</span></button>
      <div className="lesson-brand"><span><BookOpenCheck size={24}/></span><div><strong>{t('Follow along.', 'Följ med.')}<br/>{t('Step by step.', 'Steg för steg.')}</strong><small>{t('IMPORT · FOLLOW · UNDERSTAND', 'IMPORTERA · FÖLJ · FÖRSTÅ')}</small></div></div>
      <button className={'lesson-mode ' + (!current ? 'active' : '')} disabled={importing} onClick={() => { setCurrent(null); selected.current = null; setImportText(''); setImportTitle(''); setError(''); setNotice(''); }}><Plus size={18}/>{t('Import a lesson', 'Importera en lektion')}</button>
      <div className="lesson-rail-label">{t('YOUR LESSONS', 'DINA LEKTIONER')}</div>
      <div className="lesson-history">{lessons.map(s => <div className={'lesson-history-row ' + (s.id === current?.id ? 'selected' : '')} key={s.id}>
        <button disabled={importing} onClick={() => select(s)}><div><strong>{s.title}</strong><small>{new Date(s.createdAt).toLocaleDateString('sv-SE')} · {s.follow.segments.length} {t('parts', 'delar')}</small></div></button>
        <button className="lesson-delete" aria-label={t('Delete ', 'Radera ') + s.title} disabled={importing} onClick={() => setDeleteId(s.id)}><Trash2 size={13}/></button>
      </div>)}</div>
      <div className="lesson-local"><span className="lesson-dot"/>{t('Lessons are saved on this computer', 'Lektionerna sparas på den här datorn')}</div>
    </aside>
    <main className="lesson-main">
      <header className="lesson-topbar"><div><span>{t('LESSON FOLLOWER / ', 'LEKTIONSFÖLJARE / ')}</span>{current ? t('FOLLOWING', 'FÖLJER') : t('IMPORT', 'IMPORTERA')}</div>
        <div className="lesson-language" aria-label={t('Lesson language', 'Lektionens språk')}><button aria-pressed={importLanguage === 'sv'} disabled={importing || Boolean(current)} onClick={() => setImportLanguage('sv')}>Svenska</button><button aria-pressed={importLanguage === 'en'} disabled={importing || Boolean(current)} onClick={() => setImportLanguage('en')}>English</button></div></header>
      {!current && <>
        <section className="lesson-intro"><div>
          <div className="lesson-eyebrow"><Sparkles size={13}/>{t('STUDY WITH A COMPANION', 'STUDERA MED EN FÖLJARE')}</div>
          <h1>{t('Bring a lesson along.', 'Ta en lektion med dig.')}</h1>
          <p>{t('Paste lesson text or choose a .txt/.md file. SchoolWork structures it into titled parts with key concepts, and you follow it one part at a time.', 'Klistra in lektionstext eller välj en .txt/.md-fil. SchoolWork delar in den i namngivna delar med nyckelbegrepp, och du följer med en del i taget.')}</p>
        </div></section>
        <div className="follow-banner"><FileText size={15}/><span>{configured ? t(`Structured with ${model}`, `Struktureras med ${model}`) : t('No API key configured — the lesson is structured offline on this computer.', 'Ingen API-nyckel — lektionen struktureras offline på den här datorn.')}</span></div>
        <div className="lesson-card"><div className="lesson-scroll">
          <div className="follow-field"><span>{t('TITLE (OPTIONAL)', 'TITEL (VALFRI)')}</span><input value={importTitle} maxLength={160} onChange={e => setImportTitle(e.target.value)} placeholder={t('Use the first heading if left empty', 'Använd den första rubriken om tomt')}/></div>
          <div className="follow-field"><span>{t('LESSON TEXT', 'LEKTIONSTEKST')}</span><textarea className="follow-textarea" value={importText} onChange={e => setImportText(e.target.value)} placeholder={t('Paste the lesson here, or choose a file below.', 'Klistra in lektionen här, eller välj en fil nedan.')}/></div>
          <div className="follow-actions">
            <button className="lesson-outline" disabled={importing} onClick={() => void importFile()}>{importing ? <LoaderCircle className="spin" size={16}/> : <FileText size={16}/>}{t('Choose a .txt/.md file…', 'Välj en .txt/.md-fil…')}</button>
            <button className="lesson-primary" disabled={importing || !importText.trim()} onClick={() => void importLesson()}>{importing ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>}{importing ? t('Structuring the lesson…', 'Strukturerar lektionen…') : t('Import and start following', 'Importera och börja följa')}</button>
          </div>
        </div></div>
      </>}
      {lesson && state && deck && inReview && (() => {
        const totalItems = deck.cards.length + deck.quiz.length;
        const doneItems = stage === 'cards' ? cardIndex : stage === 'quiz' ? deck.cards.length + quizIndex : totalItems;
        const card = deck.cards[cardIndex], question = deck.quiz[quizIndex];
        return <>
        <section className="lesson-intro"><div>
          <div className="lesson-eyebrow"><Repeat size={13}/>{stage === 'cards' ? t('REVIEW DECK / CARDS', 'REPIETERINGSDECK / KORT') : stage === 'quiz' ? t('REVIEW DECK / QUIZ', 'REPIETERINGSDECK / PROV') : t('REVIEW DECK / RESULTS', 'REPIETERINGSDECK / RESULTAT')}</div>
          <h1>{lesson.title}</h1>
          <p className="lesson-source">{deck.source === 'model' ? t(`Built with ${model}`, `Byggd med ${model}`) : t('Built offline from the lesson’s key concepts.', 'Byggd offline från lektionens nyckelbegrepp.')}{state.sourceName ? ` · ${state.sourceName}` : ''}</p>
        </div>
          <div className="follower-progress-row"><span className="follower-progress-label">{totalItems ? t(`Item ${stage === 'done' ? totalItems : doneItems + 1} of ${totalItems}`, `Post ${stage === 'done' ? totalItems : doneItems + 1} av ${totalItems}`) : t('EMPTY DECK', 'TOM DECK')}<span className="follow-progress"><span style={{ width: `${totalItems ? Math.round((doneItems / totalItems) * 100) : 0}%` }}/></span></span></div>
        </section>
        <div className="lesson-card follow-deck">
          {stage === 'cards' && card && <>
            <div className="lesson-card-head"><div><h2>{t('FLASHCARD', 'FLASHKORT')}</h2></div><span>{t('card', 'kort')} {cardIndex + 1}/{deck.cards.length}</span></div>
            <div className="lesson-scroll follow-deck-scroll">
              <p className="follow-card-front">{card.front}</p>
              {revealed ? <div className="follow-card-back">{card.back}</div> : <p className="follow-card-hint">{t('Think of your answer, then reveal it.', 'Tänk dig ditt svar, visa det sedan.')}</p>}
            </div>
            <div className="lesson-card-foot follow-deck-actions">
              {!revealed ? <button className="lesson-primary" onClick={() => setRevealed(true)}><Eye size={15}/> {t('Reveal answer', 'Visa svaret')}</button>
                : <><button className="lesson-outline" disabled={building} onClick={() => void markCard('still')}><RotateCcw size={15}/> {t('Still learning', 'Fortfarande lär mig')}</button>
                  <button className="lesson-primary" disabled={building} onClick={() => void markCard('got')}><Check size={15}/> {t('Got it', 'Klart')}</button></>}
            </div>
          </>}
          {stage === 'quiz' && question && <>
            <div className="lesson-card-head"><div><h2>{question.question}</h2></div><span>{t('question', 'fråga')} {quizIndex + 1}/{deck.quiz.length}</span></div>
            <div className="lesson-scroll follow-deck-scroll">
              <div className="follow-quiz-options">{question.options.map((opt, i) => {
                const cls = quizPicked === null ? '' : i === question.answer ? ' correct' : i === quizPicked ? ' wrong' : ' dim';
                return <button key={i} className={'follow-quiz-option' + cls} disabled={quizPicked !== null} onClick={() => void pickQuiz(i)}><span>{String.fromCharCode(65 + i)}</span>{opt}</button>;
              })}</div>
              {quizPicked !== null && <p className={'follow-quiz-result' + (quizPicked === question.answer ? ' correct' : ' wrong')}>{quizPicked === question.answer ? t('Correct — it now comes back in two days.', 'Rätt — den återkommer om två dagar.') : t(`Not quite. The correct answer is “${question.options[question.answer]}” — it comes back tomorrow.`, `Nej. Rätt svar är “${question.options[question.answer]}” — den kommer tillbaka imorgon.`)}</p>}
            </div>
            <div className="lesson-card-foot follow-deck-actions">
              <span className="follow-quiz-score">{t('SCORE', 'POÄNG')} {quizCorrect}/{quizIndex + (quizPicked !== null ? 1 : 0)}</span>
              {quizPicked !== null && <button className="lesson-primary" onClick={nextQuiz}>{quizIndex + 1 < deck.quiz.length ? t('Next question', 'Nästa fråga') : t('See my results', 'Se mitt resultat')}<ChevronRight size={15}/></button>}
            </div>
          </>}
          {stage === 'done' && <div className="lesson-scroll follow-done-scroll">
            <div className="follow-stats">
              <div className="follow-stat"><small>{t('CARDS GOT IT', 'KORT KLARA')}</small><strong>{gotCards}<span className="follow-stat-sub">of {deck.cards.length}</span></strong></div>
              <div className="follow-stat"><small>{t('QUIZ CORRECT', 'PROV RÄTT')}</small><strong>{quizCorrect}<span className="follow-stat-sub">of {deck.quiz.length}</span></strong></div>
            </div>
            <p className="follow-done-copy">{t('Everything you answered goes back into your due-review queue. Items marked “still learning” are due tomorrow; items you got right come back in two days and spread out further with each correct answer.', 'Allt du svarat på hamnar tillbaka i kön för att repetera. Poster markerade som “fortfarande lär mig” är aktuella imorgon; poster du fått rätt på återkommer om två dagar och sprids ut mer med varje rätt svar.')}</p>
          </div>}
          <div className="lesson-card-foot">
            <button className="lesson-outline" onClick={exitReview}><ChevronLeft size={16}/> {t('Back', 'Tillbaka')}</button>
            <button className="lesson-outline" disabled={building} onClick={() => { void (confirmRegen ? buildDeck() : setConfirmRegen(true)); }}>{building ? <LoaderCircle className="spin" size={14}/> : <RefreshCw size={14}/>}{confirmRegen ? t('Really regenerate? Progress resets.', 'Byggas om? Framstegen nollställs.') : t('Regenerate deck', 'Bygg om decken')}</button>
            {stage === 'done' && <button className="lesson-primary" onClick={exitReview}><Check size={15}/> {t('Done', 'Klart')}</button>}
          </div>
        </div>
        </>;
      })()}
      {lesson && state && showReport && report && !inReview && <>
        <section className="lesson-intro"><div>
          <div className="lesson-eyebrow"><Flag size={13}/>{t('GAP REPORT', 'LUCKRAPPORT')}</div>
          <h1>{t('What to review before the exam.', 'Att repetera inför provet.')}</h1>
          <p className="lesson-source">{state.finishedAt ? t(`Finished ${new Date(state.finishedAt).toLocaleDateString('sv-SE')}`, `Slutförd ${new Date(state.finishedAt).toLocaleDateString('sv-SE')}`) : ''}{state.sourceName ? ` · ${state.sourceName}` : ''}</p>
        </div></section>
        <div className="lesson-card follow-report"><div className="lesson-card-head"><div><h2>{lesson.title}</h2></div><span>{t('GAP REPORT', 'LUCKRAPPORT')}</span></div>
          <div className="lesson-scroll follow-report-scroll">
            <div className="follow-stats">
              <div className="follow-stat"><small>{t('SEGMENTS', 'DELAR')}</small><strong>{report.totalSegments}</strong></div>
              <div className="follow-stat"><small>{t('ANSWERED', 'BESVARADE')}</small><strong>{report.completedSegments}</strong></div>
              <div className="follow-stat"><small>{t('SKIPPED', 'HOPPADE ÖVER')}</small><strong>{report.skippedSegments}</strong></div>
              <div className="follow-stat"><small>{t('SELF-CHECK ANSWERED', 'SVAR GIVNA')}</small><strong>{report.answeredQuestions}<span className="follow-stat-sub">of {report.askedQuestions}</span></strong></div>
            </div>
            <div className="follow-report-section"><h3>{t('TO REVIEW', 'ATT REPETERA')}</h3>
              {report.reviewSegmentIds.length > 0 ? report.reviewSegmentIds.map(id => {
                const s = state.segments.find(x => x.id === id);
                if (!s) return null;
                const n = state.segments.indexOf(s) + 1;
                return <button key={id} className="follow-review-row" onClick={() => { void advance(n - 1); setShowReport(false); }}>
                  <span className="follow-part-number">{n}</span><span><strong>{s.heading}</strong>{s.status === 'skipped' && <small>{t('Skipped', 'Hoppad över')}</small>}{s.status === 'pending' && <small>{t('Not reached', 'Inte nådd')}</small>}</span>
                </button>;
              }) : <div className="lesson-notice">{t('Everything looks good — no weak parts.', 'Allt ser bra ut — inga svaga delar.')}</div>}
            </div>
            <div className="follow-report-section"><h3>{t('SELF-CHECK RESULTS', 'RESULTAT FRÅN SJÄLVKONTROLL')}</h3>
              {state.segments.filter(s => s.questions.length).map(s => {
                const n = state.segments.indexOf(s) + 1;
                const weak = s.questions.some(q => q.verdict === 'review');
                return <details key={s.id} className="follow-result"><summary><span className="follow-part-number">{n}</span><span>{s.heading}</span><span className={'follow-verdict ' + (weak ? 'review' : 'pass')}>{weak ? t('To review', 'Att repetera') : t('Pass', 'Klar')}</span></summary>
                  <div className="follow-result-body">{s.questions.map((q, i) => <div key={i} className="follow-answer"><div className="follow-answer-top"><span>{i + 1}. {q.text}</span></div><p className={'follow-answer-text' + (q.answer ? '' : ' muted')}>{q.answer || t('(no answer)', '(inga svar)')}</p>{q.feedback && <p className="follow-feedback">{q.feedback}</p>}</div>)}</div>
                </details>;
              })}
              {state.segments.every(s => !s.questions.length) && <p className="lesson-muted">{t('No self-check was run on this lesson.', 'Ingen självkontroll gjordes på denna lektion.')}</p>}
            </div>
          </div>
          <div className="lesson-card-foot follow-nav">
            <button className="lesson-outline" onClick={() => setShowReport(false)}><ChevronLeft size={15}/> {t('Back to lesson', 'Tillbaka till lektionen')}</button>
            {firstFlagged >= 0 ? <button className={deck ? 'lesson-primary' : 'lesson-outline'} onClick={() => void reviewFirst()}><Flag size={15}/> {t('Review weak segments', 'Repetera svaga delar')}</button> : <span>{t('Nothing to review', 'Inget att repetera')}</span>}
            {deck ? <button className="lesson-outline" onClick={() => void openDeck()}><Layers size={15}/> {t('Open review deck', 'Öppna repeteringsdeck')}</button>
              : <button className="lesson-primary" disabled={building} onClick={() => void buildDeck()}>{building ? <LoaderCircle className="spin" size={15}/> : <Layers size={15}/>}{building ? t('Building your review deck…', 'Bygger din repeteringsdeck…') : t('Build review deck', 'Bygg repeteringsdeck')}</button>}
            {onExam && <button className="lesson-outline" onClick={() => onExam(lesson.id)}><ClipboardList size={15}/> {t('Practice exam', 'Övningsprov')}</button>}
          </div>
        </div>
      </>}
      {lesson && state && !showReport && !inReview && segment && <>
        <section className="lesson-intro"><div>
          <div className="lesson-eyebrow"><BookOpenCheck size={13}/>{t(`SEGMENT ${done} OF ${total}`, `AVSNITT ${done} AV ${total}`)}</div>
          <h1>{lesson.title}</h1>
          <p className="lesson-source">{state.structured === 'model' ? t(`Structured with ${model}`, `Strukturerad med ${model}`) : t('Structured offline — no API key was available when this lesson was imported.', 'Strukturerad offline — ingen API-nyckel fanns tillgänglig när lektionen importerades.')}{state.sourceName ? ` · ${state.sourceName}` : ''}</p>
        </div>
          <div className="follower-progress-row"><span className="follower-progress-label">{t(`Segment ${done} of ${total}`, `Avsnitt ${done} av ${total}`)}<span className="follow-progress"><span style={{ width: `${Math.round((done / total) * 100)}%` }}/></span></span></div>
        </section>
        {state.structured === 'offline' && <div className="follow-banner"><FileText size={15}/><span>{t('Offline structure: parts follow the lesson’s headings and paragraphs. Add your TeachGPT API key and import again for model-structured parts.', 'Offline-struktur: delarna följer lektionens rubriker och stycken. Lägg till din TeachGPT API-nyckel och importera igen för modellstrukturerade delar.')}</span></div>}
        <div className="lesson-card follow-segment">
          <div className="lesson-card-head"><div><h2>{segment.heading}</h2></div>{segment.status !== 'pending' && <span className={'follow-verdict ' + (segment.status === 'skipped' ? 'skip' : segment.questions.some(q => q.verdict === 'review') ? 'review' : 'pass')}>{segment.status === 'skipped' ? t('Skipped', 'Hoppad över') : t('Answered', 'Besvarat')}</span>}<span>{t('part', 'del')} {done}/{total}</span></div>
          {segment.concepts.length > 0 && <div className="follower-concepts"><span>{t('KEY CONCEPTS', 'NYCKELBEGREPP')}</span>{segment.concepts.map((c, i) => <em key={i}>{c}</em>)}</div>}
          <div className="lesson-scroll follow-segment-scroll"><p>{segment.text}</p>{state.structured === 'offline' && <details className="follower-original"><summary>{t('Whole lesson text', 'Hela lektionstexten')}</summary><pre>{lesson.text}</pre></details>}</div>
          <div className="follower-explain">
            <div className="follower-explain-row">
              <button className="lesson-outline" disabled={busy || importing} onClick={() => void explain()}>{busy ? <LoaderCircle className="spin" size={15}/> : <Sparkles size={15}/>}{t('Explain more', 'Förklara mer')}</button>
              {!configured && <small>{t('Needs your TeachGPT API key — add it in Settings.', 'Behöver din TeachGPT API-nyckel — lägg till den i Inställningar.')}</small>}
            </div>
            {replies.map((m: any) => <div className="follower-reply" key={m.id || m.content}><MessageMarkdown text={m.content}/><div className="follower-reply-actions">{chat?.task && ['running', 'queued'].includes(chat.task.state) ? <p role="status">{t('Working on it…', 'Jobbar på det…')}</p> : state.explainChatId ? <button className="lesson-text-button" onClick={() => onWork(state.explainChatId!)}>{t('Open in Work', 'Öppna i Work')}<ArrowUpRight size={13}/></button> : null}</div></div>)}
          </div>
          <div className="follow-checkpoint"><div className="follow-check-body">
            {segment.questions.length === 0 ? <>
              <p className="follow-question-preview">{t('Check that you followed the part: SchoolWork asks 1-3 questions that you answer in plain text. You can skip it if you need to.', 'Kontrollera att du följde med: SchoolWork ställer 1-3 frågor som du svarar på med egna ord. Du kan hoppa över del.')}</p>
              <div className="follow-actions">
                <button className="lesson-primary" disabled={checking || busy || importing} onClick={() => void prepare()}>{checking ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>}{checking ? t('Preparing questions…', 'Förbereder frågor…') : t('Check myself', 'Kontrollera mig själv')}</button>
                {segment.status !== 'skipped' && <button className="lesson-outline" disabled={busy || importing} onClick={() => void skipPart()}><SkipForward size={15}/> {t('Skip this part', 'Hoppa över denna del')}</button>}
              </div>
            </> : <>
              {segment.questions.map((q, i) => <div key={i} className={'follow-answer' + (q.verdict === 'review' ? ' review' : '')}>
                <div className="follow-answer-top"><span>{i + 1}. {q.text}</span>{q.verdict && <span className={'follow-verdict ' + q.verdict}>{q.verdict === 'pass' ? t('Pass', 'Klar') : t('To review', 'Att repetera')}</span>}</div>
                <textarea value={drafts[segment.id]?.[i] ?? q.answer ?? ''} disabled={saving || importing} maxLength={2000} placeholder={t('Write your answer…', 'Skriv ditt svar…')} onChange={e => setDraftFor(segment, i, e.target.value)}/>
                {q.feedback && <p className="follow-feedback">{q.feedback}</p>}
              </div>)}
              <div className="follow-actions">
                <button className="lesson-primary" disabled={saving || busy || importing} onClick={() => void saveAnswers()}>{saving ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>}{saving ? t('Reviewing your answers…', 'Granskar dina svar…') : segment.status === 'answered' ? t('Save new answers', 'Spara nya svar') : t('Save my answers', 'Spara mina svar')}</button>
                {segment.status !== 'answered' && <button className="lesson-outline" disabled={busy || importing} onClick={() => void skipPart()}><SkipForward size={15}/> {t('Skip this part', 'Hoppa över denna del')}</button>}
              </div>
            </>}
          </div></div>
          <div className="lesson-card-foot">
            <button className="lesson-outline" disabled={index === 0 || importing} onClick={() => void advance(index - 1)}><ChevronLeft size={16}/>{t('Previous', 'Föregående')}</button>
            {index === total - 1
              ? <button className="lesson-primary" disabled={importing} onClick={() => void finish()}><Flag size={15}/> {report ? t('Refresh gap report', 'Uppdatera luckrapport') : t('Finish & get my gap report', 'Slutför och få min luckrapport')}</button>
              : <button className="lesson-primary" disabled={importing} onClick={() => void advance(index + 1)}>{t('Next', 'Nästa')}<ChevronRight size={16}/></button>}
          </div>
        </div>
        <nav className="follower-jump" aria-label={t('Jump to a segment', 'Gå till ett avsnitt')}>{state.segments.map((s, i) => <button key={s.id} className={report && flagged.has(s.id) ? 'flagged' : undefined} title={s.heading} aria-label={`${t('Go to segment', 'Gå till avsnitt')} ${i + 1}: ${s.heading}`} aria-current={i === index ? 'true' : undefined} disabled={importing} onClick={() => void advance(i)}>{i + 1}</button>)}</nav>
      </>}
      {notice && <div className="lesson-notice">{notice}</div>}
      {error && <div className="lesson-error" role="alert"><span>{error}</span><button aria-label={t('Dismiss message', 'Stäng meddelande')} onClick={() => setError('')}><X size={15}/></button></div>}
    </main>
    {deleteId && <div className="lesson-modal-backdrop"><div className="lesson-dialog"><h2>{t('Delete this lesson?', 'Radera denna lektion?')}</h2><p>{t('The imported lesson text, its parts and your reading position are deleted from this computer.', 'Den importerade lektionstexten, dess delar och din läsplansposition raderas från den här datorn.')}</p><div className="lesson-dialog-actions"><button className="lesson-outline" onClick={() => setDeleteId(null)}>{t('Cancel', 'Avbryt')}</button><button className="lesson-primary" onClick={() => void doDelete()}>{t('Delete', 'Radera')}</button></div></div></div>}
  </div>;
}
