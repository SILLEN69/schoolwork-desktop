import { useEffect, useState } from 'react';
type Entry = { id: string; createdAt: number; type: string; text: string; payload?: { ok?: boolean } };
const visible = new Set(['tool-start', 'tool-result', 'retry', 'error', 'paused', 'cancelled', 'verification']);
export default function ActivityLog({ conversationId, swedish }: { conversationId: string; swedish: boolean }) {
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
  return <div className="execution-log" aria-label={swedish ? 'Utförda arbetssteg' : 'Task activity'}>
    {error && <p role="alert">{error}</p>}
    {!entries.length && <p>{swedish ? 'Filer, kommandon och resultat visas här när arbetet börjar.' : 'Files, commands and results appear here as work starts.'}</p>}
    {entries.map(entry => <details key={entry.id} className={entry.type === 'error' || entry.payload?.ok === false ? 'step-failed' : ''}>
      <summary><time>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time> {entry.text.split('\n')[0] || entry.type}</summary>
      <pre>{entry.text}</pre>
    </details>)}
  </div>;
}
