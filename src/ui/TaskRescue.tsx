import { useEffect, useState } from 'react';
import { ChevronDown, LifeBuoy, RotateCcw, X } from 'lucide-react';
import { buildRescueReport, isRescueReport, RESUME_NOTES, type RescueReport, type RescueStepKind, type RescueStepState } from '../taskRescue';
import './rescue.css';

const KIND_LABELS: Record<RescueStepKind, { en: string; sv: string }> = {
  queued: { en: 'Task queued', sv: 'Uppgift köad' },
  'plan-step': { en: 'Plan step', sv: 'Plansteg' },
  tool: { en: 'Tool step', sv: 'Verktygssteg' },
  checkpoint: { en: 'Progress saved', sv: 'Framsteg sparade' },
  error: { en: 'Error', sv: 'Fel' },
  retry: { en: 'Retrying', sv: 'Försöker igen' },
  paused: { en: 'Paused', sv: 'Pausad' },
  cancelled: { en: 'Stopped', sv: 'Stoppad' },
  recovery: { en: 'Interrupted — the app closed before the task finished', sv: 'Avbruten — appen stängdes innan uppgiften var klar' },
  verification: { en: 'Verification note', sv: 'Verifikationsanteckning' },
  answer: { en: 'Final answer', sv: 'Svar' },
  steering: { en: 'You added context', sv: 'Du lade till sammanhang' },
};
const STATE_GLYPHS: Record<RescueStepState, string> = { done: '✓', running: '›', waiting: '…', failed: '!', paused: '⏸', info: '•' };
const STATUS_LABELS: Record<string, { en: string; sv: string }> = {
  interrupted: { en: 'Interrupted — the app closed mid-task', sv: 'Avbruten — appen stängdes under uppgiften' },
  paused: { en: 'Paused — progress saved', sv: 'Pausad — framsteg sparade' },
  waiting_retry: { en: 'A failed step is waiting to be retried', sv: 'Ett misslyckat steg väntar på nytt försök' },
  waiting_user: { en: 'Waiting for your input', sv: 'Väntar på din inmatning' },
  failed: { en: 'Task failed', sv: 'Uppgiften misslyckades' },
  running: { en: 'Task is running', sv: 'Uppgiften pågår' },
  queued: { en: 'Task is queued', sv: 'Uppgiften köas' },
  completed: { en: 'Task completed', sv: 'Uppgiften slutförd' },
  cancelled: { en: 'Task stopped', sv: 'Uppgiften stoppad' },
};

export default function TaskRescue({ taskId, swedish, canClose, onResume, onClose }: {
  taskId: string;
  swedish: boolean;
  canClose: boolean;
  onResume: () => void;
  onClose?: () => void;
}) {
  const [report, setReport] = useState<RescueReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [resuming, setResuming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const t = (en: string, sv: string) => (swedish ? sv : en);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (disposed) return;
      try {
        const data = await window.schoolwork.taskRescue(taskId);
        if (disposed) return;
        setReport(data ? buildRescueReport(data.task, data.events) : null);
        setLoadError('');
      } catch {
        if (!disposed) setLoadError(t('Could not load the task history.', 'Kunde inte läsa upgiftshistoriken.'));
      }
    };
    const off = window.schoolwork.onEvent((event: any) => {
      if (event.taskId !== taskId) return;
      if (['stream-progress', 'thinking-progress'].includes(event.type)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 80);
    });
    void refresh();
    const reconciliation = setInterval(() => void refresh(), 3000);
    return () => { disposed = true; off(); if (timer) clearTimeout(timer); clearInterval(reconciliation); };
  }, [taskId, swedish]);
  const rescue = report ? isRescueReport(report) : false;
  useEffect(() => { if (rescue) setCollapsed(false); }, [rescue]);
  const resume = async () => {
    if (resuming) return;
    setResuming(true);
    setActionError('');
    try {
      // App performs the single control(taskId,'resume') call and tracks the new state.
      await onResume();
    } catch (error: any) {
      setActionError(error.message);
      setResuming(false);
    }
  };
  if (!report)
    return <section className="task-rescue" data-rescue="loading" aria-busy="true">
      <header className="task-rescue-head">
        <span className="task-rescue-icon"><LifeBuoy size={15} /></span>
        <b>{t('What happened to this task?', 'Vad hände med uppgiften?')}</b>
      </header>
      {loadError ? <p role="alert" className="task-rescue-errorbox">{loadError}</p> : <p className="task-rescue-sub">{t('Reading saved task state…', 'Läser sparat upgiftstillstånd…')}</p>}
    </section>;
  const statusKey = report.interrupted ? 'interrupted' : report.state;
  const statusLabel = STATUS_LABELS[statusKey] || STATUS_LABELS.queued;
  const note = report.resumeNoteKey ? RESUME_NOTES[report.resumeNoteKey] : null;
  return <section className={'task-rescue' + (rescue ? ' task-rescue-alarm' : '') + (collapsed ? ' task-rescue-collapsed' : '')} data-rescue-state={statusKey}>
    <header className="task-rescue-head" role="button" tabIndex={0} aria-expanded={!collapsed} onClick={() => setCollapsed(c => !c)} onKeyDown={e => { if (e.key === 'Enter') setCollapsed(c => !c); }}>
      <span className="task-rescue-icon"><LifeBuoy size={15} /></span>
      <b>{t('What happened to this task?', 'Vad hände med uppgiften?')}</b>
      <span className={'task-rescue-status' + (rescue ? ' task-rescue-status-alarm' : '')}>{t(statusLabel.en, statusLabel.sv)}</span>
      {canClose && <button className="icon task-rescue-close" onClick={(e) => { e.stopPropagation(); onClose?.(); }} aria-label={t('Close task rescue', 'Stäng upgiftsräddning')}><X size={13} /></button>}
      <ChevronDown size={14} className={'task-rescue-chevron' + (collapsed ? ' task-rescue-chevron-up' : '')} />
    </header>
    {collapsed ? null : <div className="task-rescue-body">
      {report.objective && <p className="task-rescue-objective" title={report.objective}>{report.objective}</p>}
      {rescue && report.resumePointLabel && <p className="task-rescue-point"><b>{t('Resumes from:', 'Återupptas från:')}</b> {report.resumePointLabel}</p>}
      {rescue && !report.resumePointLabel && <p className="task-rescue-point">{t('No completed steps yet — it will start from the beginning.', 'Inga slutförda steg än — den börjar från början.')}</p>}
      {rescue && report.error && <p className="task-rescue-errorbox">{report.error}</p>}
      <ol className="task-rescue-steps">
        {report.steps.map(step => <li key={step.key} className={'task-rescue-step task-rescue-step-' + step.state}>
          <span className="step-state" aria-hidden="true">{STATE_GLYPHS[step.state]}</span>
          <span className="task-rescue-step-main" title={step.detail || step.label}>
            {step.label || t(KIND_LABELS[step.kind].en, KIND_LABELS[step.kind].sv)}
            {report.resumable && step.key === report.resumePointKey && <em className="task-rescue-flag">{t('resumes from here', 'återupptas härifrån')}</em>}
          </span>
          <time>{new Date(step.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{step.durationMs !== undefined ? ' · ' + (step.durationMs / 1000).toFixed(1) + 's' : ''}</time>
        </li>)}
        {report.steps.length === 0 && <li className="task-rescue-step task-rescue-step-info"><span className="step-state" aria-hidden="true">•</span><span>{t('No recorded steps yet.', 'Inga inskrivna steg ännu.')}</span></li>}
      </ol>
      {note && <div className="task-rescue-action">
        <button className="task-rescue-resume" onClick={() => void resume()} disabled={resuming}>
          <RotateCcw size={13} />{resuming ? t('Resuming…', 'Återupptar…') : t('Resume task', 'Återuppta uppgift')}
        </button>
        <small>{t(note.en, note.sv)}</small>
        {actionError && <p role="alert" className="task-rescue-errorbox">{actionError}</p>}
      </div>}
    </div>}
  </section>;
}
