// Task Rescue: builds the visible recovery timeline for a task purely from
// stored state (task row + task_events). No inference, no IPC — everything a
// student needs after the app was closed, paused or failed is already on disk.

export type RescueTask = {
  id: string;
  objective: string;
  state: string;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type RescueEvent = {
  id: string;
  sequence?: number;
  type: string;
  payload?: any;
  createdAt: number;
};

export type RescueStepState = 'done' | 'running' | 'waiting' | 'failed' | 'paused' | 'info';

export type RescueStepKind =
  | 'queued'
  | 'plan-step'
  | 'tool'
  | 'checkpoint'
  | 'error'
  | 'retry'
  | 'paused'
  | 'cancelled'
  | 'recovery'
  | 'verification'
  | 'answer'
  | 'steering';

export type RescueStep = {
  key: string;
  state: RescueStepState;
  kind: RescueStepKind;
  /** Raw stored text when it is meaningful (tool text, plan title, error text). */
  label?: string;
  /** Full raw stored detail for the title attribute / expansion. */
  detail?: string;
  at: number;
  durationMs?: number;
};

/** Kinds whose 'done' state is verifiable saved work — candidates for the resume point. */
const DONE_WORK_KINDS: ReadonlySet<RescueStepKind> = new Set(['tool', 'checkpoint', 'answer']);

export type ResumeNoteKey = 'interrupted' | 'paused' | 'waiting_retry' | 'waiting_user' | 'failed';

export type RescueReport = {
  taskId: string;
  objective: string;
  state: string;
  /** True when the task was interrupted by an app close (recovery_required event). */
  interrupted: boolean;
  resumable: boolean;
  resumeNoteKey: ResumeNoteKey | null;
  /** Exact stored error from the task row. */
  error: string | null;
  steps: RescueStep[];
  /** Key of the single step a resume continues from (last completed work). */
  resumePointKey: string | null;
  resumePointLabel: string | null;
  updatedAt: number;
};

/** States from which the existing control path (controlTask resume/retry) accepts the task. */
const RESUMABLE_STATES = ['paused', 'waiting_retry', 'waiting_user', 'failed'];
/** States that automatically surface the rescue panel in the conversation. */
const RESCUE_STATES = ['paused', 'waiting_retry', 'failed'];

export const RESUME_NOTES: Record<ResumeNoteKey, { en: string; sv: string }> = {
  interrupted: {
    en: 'Resumes from the last saved step. Finished work is kept; the interrupted step is redone carefully and nothing is repeated automatically.',
    sv: 'Återupptas från det sista sparade steget. Klarat arbete bevaras; det avbrutna steget görs om noggrant och inget upprepas automatiskt.',
  },
  paused: {
    en: 'Continues from the saved checkpoint. Completed steps are kept; only the remaining work is redone.',
    sv: 'Fortsätter från sparad kontrollpunkt. Slutförda steg bevaras; endast det kvarvarande arbetet görs om.',
  },
  waiting_retry: {
    en: 'Retries the step that failed, with the same saved context.',
    sv: 'Försöker det misslyckade steget igen med samma sparade sammanhang.',
  },
  waiting_user: {
    en: 'Continues with the saved context.',
    sv: 'Fortsätter med det sparade sammanhanget.',
  },
  failed: {
    en: 'Retries from the last saved step; the recorded error is included in the context.',
    sv: 'Försöker igen från det sista sparade steget; det sparade felet ingår i sammanhanget.',
  },
};

const firstLine = (text: unknown) => (text === undefined || text === null ? undefined : String(text).split('\n')[0].slice(0, 200));

export function isRescueReport(report: Pick<RescueReport, 'state' | 'interrupted'>): boolean {
  return report.interrupted || RESCUE_STATES.includes(report.state);
}

export function buildRescueReport(task: RescueTask, events: RescueEvent[]): RescueReport {
  const ordered = [...events].sort(
    (a, b) => a.createdAt - b.createdAt || (a.sequence ?? 0) - (b.sequence ?? 0),
  );
  const steps: RescueStep[] = [];
  const openTools = new Map<string, RescueStep>();
  let interrupted = false;
  let lastPlan: { id: string; at: number; steps: any[] } | null = null;

  const closeOpenTools = (state: RescueStepState, detail?: string) => {
    for (const step of openTools.values()) {
      step.state = state;
      if (detail && !step.detail) step.detail = detail;
    }
    openTools.clear();
  };

  for (const event of ordered) {
    const payload = event.payload || {};
    switch (event.type) {
      case 'queued':
        steps.push({ key: event.id, state: 'info', kind: 'queued', label: firstLine(payload.text), detail: payload.text, at: event.createdAt });
        break;
      case 'plan':
        // Only the newest plan reflects the current view of the work.
        lastPlan = { id: event.id, at: event.createdAt, steps: Array.isArray(payload.steps) ? payload.steps : [] };
        break;
      case 'tool-start': {
        const key = String(payload.callId || event.id);
        const step: RescueStep = {
          key: 'tool:' + key,
          state: 'running',
          kind: 'tool',
          label: firstLine(payload.text),
          detail: payload.text,
          at: event.createdAt,
        };
        openTools.set(key, step);
        steps.push(step);
        break;
      }
      case 'tool-result': {
        const key = String(payload.callId || '');
        const open = openTools.get(key);
        if (open) {
          open.state = payload.ok === false ? 'failed' : 'done';
          if (typeof payload.durationMs === 'number') open.durationMs = payload.durationMs;
          if (payload.text) open.detail = String(payload.text);
          openTools.delete(key);
        } else {
          steps.push({
            key: event.id,
            state: payload.ok === false ? 'failed' : 'done',
            kind: 'tool',
            label: firstLine(payload.text),
            detail: payload.text,
            at: event.createdAt,
            durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : undefined,
          });
        }
        break;
      }
      case 'checkpoint':
        steps.push({ key: event.id, state: 'done', kind: 'checkpoint', label: firstLine(payload.text), detail: payload.text, at: event.createdAt });
        break;
      case 'error':
        steps.push({ key: event.id, state: 'failed', kind: 'error', label: firstLine(payload.text), detail: payload.text, at: event.createdAt });
        break;
      case 'retry':
        steps.push({ key: event.id, state: 'waiting', kind: 'retry', label: firstLine(payload.text), detail: payload.text, at: event.createdAt });
        break;
      case 'paused':
        closeOpenTools('paused', 'Stopped before this step finished.');
        steps.push({ key: event.id, state: 'paused', kind: 'paused', label: firstLine(payload.text), detail: payload.text, at: event.createdAt });
        break;
      case 'cancelled':
        closeOpenTools('info');
        steps.push({ key: event.id, state: 'info', kind: 'cancelled', label: firstLine(payload.text), detail: payload.text, at: event.createdAt });
        break;
      case 'recovery_required':
        interrupted = true;
        closeOpenTools('paused', 'The app closed before this step finished.');
        // A recovery notice, not a saved point — the resume point stays on the last completed work.
        steps.push({ key: event.id, state: 'paused', kind: 'recovery', detail: payload.message, at: event.createdAt });
        break;
      case 'verification':
        steps.push({ key: event.id, state: 'info', kind: 'verification', label: firstLine(payload.text), detail: payload.text, at: event.createdAt });
        break;
      case 'answer':
        closeOpenTools('done');
        steps.push({ key: event.id, state: 'done', kind: 'answer', detail: payload.text, at: event.createdAt });
        break;
      case 'steering-queued':
        steps.push({ key: event.id, state: 'info', kind: 'steering', at: event.createdAt });
        break;
      default:
        break;
    }
  }
  // Tool calls without a stored result: still running on a live task, stopped otherwise.
  if (openTools.size) {
    const live = ['running', 'queued'].includes(task.state);
    closeOpenTools(live ? 'running' : 'paused', live ? undefined : 'Stopped before this step finished.');
  }
  if (lastPlan && lastPlan.steps.length) {
    const planSteps: RescueStep[] = lastPlan.steps.map((step: any, index: number) => ({
      key: 'plan:' + lastPlan.id + ':' + index,
      state: step.status === 'done' ? 'done' : step.status === 'running' ? 'running' : 'waiting',
      kind: 'plan-step',
      label: firstLine(step.title),
      detail: step.acceptance ? String(step.acceptance) : undefined,
      at: lastPlan.at,
    }));
    let insertAt = steps.findIndex((step) => step.at > lastPlan.at);
    if (insertAt === -1) insertAt = steps.length;
    steps.splice(insertAt, 0, ...planSteps);
  }
  const resumable = RESUMABLE_STATES.includes(task.state);
  const resumeNoteKey: ResumeNoteKey | null = !resumable
    ? null
    : interrupted
      ? 'interrupted'
      : task.state === 'paused'
        ? 'paused'
        : task.state === 'failed'
          ? 'failed'
          : task.state === 'waiting_user'
            ? 'waiting_user'
            : 'waiting_retry';
  // The single point a resume continues from: the last verifiably completed work
  // (a finished tool, a saved checkpoint or the final answer). A mid-flight tool
  // or a recovery notice never claims to be it.
  const point = steps.filter((step) => step.state === 'done' && DONE_WORK_KINDS.has(step.kind)).pop();
  return {
    taskId: task.id,
    objective: task.objective,
    state: task.state,
    interrupted,
    resumable,
    resumeNoteKey,
    error: task.error ? String(task.error) : null,
    steps,
    resumePointKey: point ? point.key : null,
    resumePointLabel: point ? point.label || (point.detail ? String(point.detail).split('\n')[0].slice(0, 200) : null) : null,
    updatedAt: task.updatedAt,
  };
}
