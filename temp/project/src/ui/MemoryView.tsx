import { useEffect, useState } from 'react';
import { Brain, ExternalLink, Link2, Search, X } from 'lucide-react';

type Note = { id: string; title: string; type: string; status: string; body: string; updatedAt: number; relativePath: string; revision?: number };

export default function MemoryView({ close, language }: { close: () => void; language: 'en' | 'sv' }) {
  const sv = language === 'sv';
  const [notes, setNotes] = useState<Note[]>([]); const [selected, setSelected] = useState<Note | null>(null);
  const [query, setQuery] = useState(''); const [body, setBody] = useState(''); const [title, setTitle] = useState('');
  const [graph, setGraph] = useState<any>({ nodes: [], edges: [] }); const [error, setError] = useState('');
  const graphNodes = graph.nodes?.slice(0, 32) || [];
  const positions = new Map(graphNodes.map((node: any, i: number) => [node.id, { x: 42 + (i % 4) * 145, y: 28 + Math.floor(i / 4) * 54 }]));
  const refresh = async (q = query) => { try { const next = q.trim() ? await window.schoolwork.memorySearch(q) : await window.schoolwork.memoryList(); setNotes(next); } catch (e: any) { setError(e.message); } };
  useEffect(() => { void refresh(''); void window.schoolwork.memoryGraph().then(setGraph).catch((e: any) => setError(e.message)); }, []);
  const choose = async (note: Note) => { const full = await window.schoolwork.memoryGet(note.id); setSelected(full); setTitle(full.title); setBody(full.body); };
  const save = async () => { if (!selected) return; try { await window.schoolwork.memoryUpdate({ noteId: selected.id, revision: selected.revision || 0, changes: { title, body } }); await choose({ ...selected, title, body }); await refresh(); setError(''); } catch (e: any) { setError(e.message); } };
  const archive = async () => { if (!selected) return; try { await window.schoolwork.memoryArchive(selected.id); setSelected(null); await refresh(); } catch (e: any) { setError(e.message); } };
  const forget = async () => { if (!selected || !window.confirm(sv ? 'Glöm den här minnesanteckningen?' : 'Forget this memory note?')) return; try { await window.schoolwork.memoryForget(selected.id); setSelected(null); await refresh(); } catch (e: any) { setError(e.message); } };
  return <div className="memory-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="memory-window" aria-label={sv ? 'Långtidsminne' : 'Long-term memory'}>
    <header><div><Brain size={18}/><div><b>{sv ? 'Långtidsminne' : 'Long-term memory'}</b><small>{sv ? 'Lokala Markdown-anteckningar · Obsidian-kompatibelt' : 'Local Markdown notes · Obsidian-compatible'}</small></div></div><button className="icon" onClick={close} aria-label="Close"><X size={17}/></button></header>
    <div className="memory-tools"><label><Search size={15}/><input value={query} onChange={e => { setQuery(e.target.value); void refresh(e.target.value); }} placeholder={sv ? 'Sök i minnet' : 'Search memory'}/></label><button className="folder-choose" onClick={() => window.schoolwork.openVault()}><ExternalLink size={14}/>{sv ? 'Öppna valvet' : 'Open vault folder'}</button></div>
    {error && <div className="memory-error">{error}</div>}
    <div className="memory-content"><nav className="memory-notes" aria-label={sv ? 'Minnesanteckningar' : 'Memory notes'}>{notes.map(note => <button key={note.id} className={selected?.id === note.id ? 'selected' : ''} onClick={() => void choose(note)}><b>{note.title}</b><small>{note.status} · {note.type}</small></button>)}{notes.length === 0 && <p>{sv ? 'Inga matchande anteckningar.' : 'No matching notes.'}</p>}</nav>
      <div className="memory-editor">{selected ? <><div className="memory-meta"><span>{selected.status}</span><span>{selected.relativePath}</span></div><input className="memory-title" value={title} onChange={e => setTitle(e.target.value)} aria-label="Memory title"/><textarea value={body} onChange={e => setBody(e.target.value)} aria-label="Memory note Markdown"/><div className="memory-actions"><button onClick={save}>{sv ? 'Spara' : 'Save'}</button><button onClick={archive}>{sv ? 'Arkivera' : 'Archive'}</button><button className="danger" onClick={forget}>{sv ? 'Glöm' : 'Forget'}</button></div></> : <div className="memory-empty"><Brain size={22}/><span>{sv ? 'Välj en anteckning för att läsa eller redigera.' : 'Select a note to read or edit it.'}</span></div>}
      <div className="memory-graph"><div><Link2 size={14}/>{sv ? 'Länkad graf' : 'Linked graph'} <small>{sv ? 'Endast uttryckliga länkar' : 'Explicit links only'}</small></div><svg className="memory-graph-svg" viewBox="0 0 500 470" role="img" aria-label={sv ? 'Anteckningsgraf' : 'Memory note graph'}>{(graph.edges || []).map((edge: any, i: number) => { const a: any = positions.get(edge.source); const b: any = positions.get(edge.target); return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#778365" strokeWidth="1.5"/> : null; })}{graphNodes.map((node: any) => { const point: any = positions.get(node.id); return <g key={node.id} aria-hidden="true"><circle cx={point.x} cy={point.y} r="5" fill={node.status === 'verified' ? '#cbe59b' : '#939b85'}/><text x={point.x + 9} y={point.y + 4} fill="#ccd1c5" fontSize="10">{String(node.title).slice(0, 18)}</text></g>; })}</svg><div className="graph-list" aria-label={sv ? 'Tillgänglig anteckningslista' : 'Accessible note list'}>{graphNodes.map((node: any) => <button key={node.id} onClick={() => { void choose(node); }}>{node.title}</button>)}</div></div></div>
    </div>
  </section></div>;
}
