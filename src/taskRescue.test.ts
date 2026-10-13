import { describe, expect, it } from 'vitest';
import { buildRescueReport, isRescueReport, RESUME_NOTES, type RescueEvent, type RescueTask } from './taskRescue';

let at = 1_700_000_000_000;
const tick = (ms = 1000) => (at += ms);
function event(type: string, payload: any = {}, overrides: Partial<RescueEvent> = {}): RescueEvent {
  return { id: crypto.randomUUID(), sequence: undefined, type, payload, createdAt: at, ...overrides };
}
function task(state: string, patch: Partial<RescueTask> = {}): RescueTask {
  return {
    id: crypto.randomUUID(),
    objective: 'Build a practice website',
    state,
    error: null,
    createdAt: at,
    updatedAt: at + 60_000,
    ...patch,
  };
}
const stateOf = (report: ReturnType<typeof buildRescueReport>, key: string) =>
  report.steps.find((step) => step.key === key)?.state;

describe('task rescue report', () => {
  it('orders steps from stored events and marks finished tools done', () => {
    const a = event('queued', { text: 'Task queued.' });
    tick();
    const start = event('tool-start', { callId: 'c1', text: 'Reading file notes.txt\nmore detail' });
    tick();
    const result = event('tool-result', { callId: 'c1', text: 'Found 3 lines', ok: true, durationMs: 420 });
    tick();
    const report = buildRescueReport(task('running'), [result, a, start]);
    expect(report.steps.map((step) => step.kind)).toEqual(['queued', 'tool']);
    expect(report.steps[1]).toMatchObject({ state: 'done', label: 'Reading file notes.txt', durationMs: 420 });
    expect(report.steps.map((step) => step.at)).toEqual([a.createdAt, start.createdAt]);
  });

  it('flags failed tool results and exact stored errors as failed', () => {
    const start = event('tool-start', { callId: 'c9', text: 'Running npm test' });
    tick();
    const result = event('tool-result', { callId: 'c9', text: '2 tests failed', ok: false });
    tick();
    const error = event('error', { text: 'HTTP 503 — upstream gateway timeout', retry: true });
    const report = buildRescueReport(
      task('waiting_retry', { error: 'HTTP 503 — upstream gateway timeout' }),
      [start, result, error],
    );
    expect(stateOf(report, 'tool:c9')).toBe('failed');
    const failed = report.steps.filter((step) => step.state === 'failed');
    expect(failed.map((step) => step.kind)).toEqual(['tool', 'error']);
    expect(failed[1].label).toBe('HTTP 503 — upstream gateway timeout');
    expect(report.error).toBe('HTTP 503 — upstream gateway timeout');
    expect(report.resumable).toBe(true);
    expect(report.resumeNoteKey).toBe('waiting_retry');
    expect(RESUME_NOTES.waiting_retry.sv).toBeTruthy();
  });

  it('shows an interrupted task as paused with the recovery event and no silent running state', () => {
    const start = event('tool-start', { callId: 'c2', text: 'Writing file index.html' });
    tick();
    const recovery = event('recovery_required', { message: 'Inspect any interrupted tool operation before retrying.' });
    const report = buildRescueReport(
      task('paused', { error: 'Application closed before task completion. Review the last tool operation before resuming.' }),
      [start, recovery],
    );
    expect(report.interrupted).toBe(true);
    expect(isRescueReport(report)).toBe(true);
    expect(stateOf(report, 'tool:c2')).toBe('paused');
    expect(report.steps.some((step) => step.kind === 'recovery' && step.state === 'paused')).toBe(true);
    expect(report.resumable).toBe(true);
    expect(report.resumeNoteKey).toBe('interrupted');
  });

  it('keeps tools running while the task is live and does not mark them interrupted', () => {
    const start = event('tool-start', { callId: 'c3', text: 'Checking preview' });
    const report = buildRescueReport(task('running'), [event('queued', { text: 'Task queued.' }), start]);
    expect(stateOf(report, 'tool:c3')).toBe('running');
    expect(report.interrupted).toBe(false);
    expect(report.resumable).toBe(false);
    expect(report.resumeNoteKey).toBeNull();
  });

  it('uses the last checkpoint as the resumable point and honors pause order', () => {
    const start = event('tool-start', { callId: 'c1', text: 'Writing file app.js' });
    tick();
    const result = event('tool-result', { callId: 'c1', text: 'Saved app.js', ok: true });
    tick();
    const checkpoint = event('checkpoint', { text: 'hey, I stopped here — Paused by you.\nLast saved result: app.js written', state: 'paused' });
    tick();
    const report = buildRescueReport(task('paused'), [start, result, checkpoint]);
    expect(stateOf(report, 'tool:c1')).toBe('done');
    expect(report.resumePointLabel).toContain('I stopped here');
    const flagged = report.steps.filter((step) => step.key === report.resumePointKey);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].kind).toBe('checkpoint');
    expect(report.resumeNoteKey).toBe('paused');
  });

  it('points the resume point at the last completed work, never at the recovery notice', () => {
    const events: RescueEvent[] = [
      event('queued', { text: 'Task queued.' }),
      event('tool-start', { callId: 'w', text: 'Writing file app.js' }),
      event('tool-result', { callId: 'w', text: 'Existing file: read first', ok: false }),
      event('checkpoint', { text: 'hey, I stopped here — Paused by you.' }),
      event('paused', { text: 'Progress saved.' }),
      event('queued', { text: 'Resuming from saved evidence.' }),
    ];
    const readStart = event('tool-start', { callId: 'r', text: 'Reading file app.js' });
    events.push(readStart);
    events.push(event('tool-result', { callId: 'r', text: 'read_file completed.', ok: true }));
    events.push(event('recovery_required', { message: 'Inspect any interrupted tool operation before retrying.' }));
    const report = buildRescueReport(
      task('paused', { error: 'Application closed before task completion. Review the last tool operation before resuming.' }),
      events,
    );
    expect(report.interrupted).toBe(true);
    expect(report.resumePointLabel).toBe('Reading file app.js');
    expect(report.resumePointKey).toBe('tool:r');
    const flagged = report.steps.filter((step) => step.key === report.resumePointKey);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].kind).toBe('tool');
    // The interrupted write (ok:false) must read as failed, and the recovery row as a paused notice.
    expect(stateOf(report, 'tool:w')).toBe('failed');
    expect(report.steps.some((step) => step.kind === 'recovery' && step.state === 'paused' && step.key !== report.resumePointKey)).toBe(true);
  });

  it('expands the newest plan into ordered steps with per-step states', () => {
    event('queued', { text: 'Task queued.' });
    tick();
    const plan = event('plan', {
      text: 'done: Set up\nrunning: Build\npending: Verify',
      steps: [
        { title: 'Set up', status: 'done', acceptance: 'x' },
        { title: 'Build', status: 'running', acceptance: 'y' },
        { title: 'Verify', status: 'pending', acceptance: 'z' },
      ],
    });
    tick();
    const report = buildRescueReport(task('running'), [plan]);
    const planSteps = report.steps.filter((step) => step.kind === 'plan-step');
    expect(planSteps.map((step) => [step.label, step.state])).toEqual([
      ['Set up', 'done'],
      ['Build', 'running'],
      ['Verify', 'waiting'],
    ]);
  });

  it('only keeps the newest plan view, not every plan update', () => {
    const oldPlan = event('plan', { steps: [{ title: 'Old step', status: 'pending', acceptance: 'x' }] });
    tick(5000);
    const newPlan = event('plan', { steps: [{ title: 'Current step', status: 'done', acceptance: 'y' }] });
    const rebuilt = buildRescueReport(task('running'), [oldPlan, newPlan]);
    const titles = rebuilt.steps.filter((step) => step.kind === 'plan-step').map((step) => step.label);
    expect(titles).toEqual(['Current step']);
  });

  it('never offers resume for completed or cancelled tasks', () => {
    const completed = buildRescueReport(task('completed'), [event('queued', { text: 'Task queued.' }), event('answer', { text: 'Done — here is the site.' })]);
    expect(completed.resumable).toBe(false);
    expect(completed.resumeNoteKey).toBeNull();
    expect(completed.steps[completed.steps.length - 1]).toMatchObject({ kind: 'answer', state: 'done' });
    const cancelled = buildRescueReport(task('cancelled'), [event('queued', { text: 'Task queued.' }), event('cancelled', { text: 'Stopped by you.' })]);
    expect(cancelled.resumable).toBe(false);
    expect(isRescueReport(cancelled)).toBe(false);
  });

  it('handles an empty event history with a resumable note and no resume point', () => {
    const report = buildRescueReport(task('waiting_retry', { error: 'No key configured.' }), []);
    expect(report.steps).toEqual([]);
    expect(report.resumePointLabel).toBeNull();
    expect(report.resumable).toBe(true);
    expect(report.resumeNoteKey).toBe('waiting_retry');
  });
});
