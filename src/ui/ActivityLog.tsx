import { useEffect, useState } from 'react';
type Entry = { id: string; taskId?: string; createdAt: number; type: string; text: string; payload?: { ok?: boolean; callId?: string; durationMs?: number } };
const visible = new Set(['tool-start', 'tool-output', 'tool-result', 'plan', 'retry', 'error', 'paused', 'cancelled', 'verification']);
export default function ActivityLog({ conversationId, swedish, compact = false }: { conversationId: string; swedish: boolean; compact?: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    setEntries([]); setError('');
    const merge = (rows: Entry[]) => setEntries(previous => {
      const unique = new Map([...rows, ...previous].map(row => [row.id, row]));
      return [...unique.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-120);
    });
    const off = window.schoolwork.onEvent(event => {
      if (event.conversationId === conversationId && visible.has(event.type)) merge([event]);
    });
    window.schoolwork.getActivity(conversationId).then(rows => { if (!disposed) merge(rows); }).catch(() => { if (!disposed) setError(swedish ? 'Kunde inte läsa tidigare aktivitet.' : 'Could not load earlier activity.'); });
    return () => { disposed = true; off(); };
  }, [conversationId, swedish]);
  const groups: { key: string; start: Entry; end?: Entry; output?: Entry }[] = [];
  for (const entry of entries) {
    const key = entry.payload?.callId ? `${entry.taskId}:${entry.payload.callId}` : entry.id;
    let group = groups.find(g => g.key === key);
    if (!group) { group = { key, start: entry }; groups.push(group); }
    if (entry.type === 'tool-result') group.end = entry;
    if (entry.type === 'tool-output') group.output = entry;
  }
  if (compact && !entries.length && !error) return null;
  return <div className="execution-log" aria-label={swedish ? 'Utförda arbetssteg' : 'Task activity'}>
    {error && <p role="alert">{error}</p>}
    {!entries.length && <p>{swedish ? 'Filer, kommandon och resultat visas här när arbetet börjar.' : 'Files, commands and results appear here as work starts.'}</p>}
    {groups.map(({ key, start, end, output }) => <details key={key} className={start.type === 'error' || end?.payload?.ok === false ? 'step-failed' : end ? 'step-done' : ''}>
      <summary><span className="step-state" aria-hidden="true">{end ? end.payload?.ok === false ? '!' : '✓' : '›'}</span><span>{start.text.split('\n')[0] || start.type}</span><time>{end?.payload?.durationMs !== undefined ? (end.payload.durationMs / 1000).toFixed(1) + 's' : new Date(start.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></summary>
      <pre>{start.text}{end && end !== start ? '\n\n' + end.text : !end && output ? '\n\n' + output.text : ''}</pre>
    </details>)}
  </div>;
}
