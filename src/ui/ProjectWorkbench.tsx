import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  FileCode2,
  FileQuestion,
  FileText,
  Files,
  Folder,
  FolderOpen,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
  Square,
  Terminal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import less from 'highlight.js/lib/languages/less';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import MessageMarkdown from './MessageMarkdown';
import {
  buildExplainFileRequest,
  filterWorkbenchTree,
  formatBytes,
  isMarkdownName,
  isRunnableName,
  languageForPath,
  runCommandLabel,
  type RecentFile,
  type WorkbenchEntry,
  type WorkbenchRunResult,
} from '../workbench';
import './workbench.css';
type FileView = {
  path: string;
  name: string;
  size: number;
  text?: string;
  binary?: boolean;
  tooLarge?: boolean;
};
type RunState =
  | { status: 'running'; runId: string; command: string; stdout: string; stderr: string }
  | { status: 'done'; result: WorkbenchRunResult }
  | { status: 'error'; command: string; error: string };
type Props = {
  workspace: string;
  swedish: boolean;
  onBack: () => void;
  /** Sends the composed explain message through the app's existing send path; false when guarded or refused. */
  onExplain: (text: string) => Promise<boolean> | boolean;
};

// Only the grammars the extension map can request are registered, keeping the
// preview lightweight while reusing the highlighter the markdown stack already ships.
const grammars: Record<string, LanguageFn> = {
  c, cpp, csharp, css, diff, dockerfile, go, ini, java, javascript, json,
  less, makefile, markdown, python, ruby, rust, scss, shell, sql, typescript, xml, yaml,
};
for (const [name, grammar] of Object.entries(grammars)) hljs.registerLanguage(name, grammar);

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const formatRunTime = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

// Files opened this app session, newest first (in memory, not persisted).
const recentFiles: RecentFile[] = [];
const rememberRecent = (file: FileView) => {
  const at = recentFiles.findIndex(r => r.path === file.path);
  if (at >= 0) recentFiles.splice(at, 1);
  recentFiles.unshift({ path: file.path, name: file.name });
  if (recentFiles.length > 8) recentFiles.pop();
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const highlightCode = (text: string, name: string): { html: string; language: string | null } => {
  const language = languageForPath(name);
  if (language && hljs.getLanguage(language)) {
    try {
      return { html: hljs.highlight(text, { language }).value, language };
    } catch {
      /* unexpected grammar failure: fall back to plain text */
    }
  }
  return { html: escapeHtml(text), language: language || null };
};

export default function ProjectWorkbench({ workspace, swedish, onBack, onExplain }: Props) {
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const [tree, setTree] = useState<{ entries: WorkbenchEntry[]; truncated: boolean } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<FileView | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [error, setError] = useState('');
  const [recents, setRecents] = useState<RecentFile[]>(() => [...recentFiles]);
  const [run, setRun] = useState<RunState | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [selectionText, setSelectionText] = useState('');
  const mounted = useRef(true);
  const firstTree = useRef(true);
  const runIdRef = useRef<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const runBodyRef = useRef<HTMLPreElement | null>(null);

  const load = async () => {
    try {
      setError('');
      const result = await window.schoolwork.projectTree();
      if (!mounted.current) return;
      setTree({ entries: result.entries, truncated: result.truncated });
      if (firstTree.current) {
        // Open top-level folders so the project surface is visible at once.
        firstTree.current = false;
        setExpanded(
          Object.fromEntries(
            result.entries.filter(e => e.type === 'dir' && !e.path.includes('/')).map(e => [e.path, true]),
          ),
        );
      }
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    }
  };

  useEffect(() => {
    mounted.current = true;
    firstTree.current = true;
    setTree(null);
    setExpanded({});
    setFilter('');
    setOpen(null);
    setOpenError('');
    setError('');
    setRun(null);
    setExplaining(false);
    setSelectionText('');
    const off = window.schoolwork.onProjectChanged(ws => {
      if (mounted.current && ws === workspace) void load();
    });
    void load();
    void window.schoolwork.projectWatchStart().catch(() => {});
    return () => {
      mounted.current = false;
      off();
      void window.schoolwork.projectWatchStop().catch(() => {});
      // A run belongs to its file: never keep a child process alive after the view goes.
      if (runIdRef.current) void window.schoolwork.projectRunStop(runIdRef.current).catch(() => {});
      runIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  // Live output and the final result for the run started from this view.
  useEffect(() => {
    const offOutput = window.schoolwork.onProjectRunOutput(data => {
      if (!mounted.current || data.runId !== runIdRef.current) return;
      setRun(prev => {
        if (!prev || prev.status !== 'running' || prev.runId !== data.runId) return prev;
        return data.stream === 'stdout'
          ? { ...prev, stdout: prev.stdout + data.data }
          : { ...prev, stderr: prev.stderr + data.data };
      });
    });
    const offResult = window.schoolwork.onProjectRunResult(data => {
      if (!mounted.current || data.runId !== runIdRef.current) return;
      runIdRef.current = null;
      setRun(data.error ? { status: 'error', command: '', error: data.error } : { status: 'done', result: data.result! });
    });
    return () => {
      offOutput();
      offResult();
    };
  }, []);

  // Track a text selection inside the preview so "Explain this" can explain the selection.
  useEffect(() => {
    const update = () => {
      const root = previewRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.isCollapsed) return;
      const node = sel.anchorNode;
      if (!node || node === root || !root.contains(node)) {
        setSelectionText('');
        return;
      }
      const text = sel.toString();
      setSelectionText(prev => (text === prev ? prev : text));
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  // Keep the output area pinned to the newest bytes.
  useEffect(() => {
    const el = runBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run]);

  const abortRun = () => {
    if (runIdRef.current) void window.schoolwork.projectRunStop(runIdRef.current).catch(() => {});
    runIdRef.current = null;
  };

  const openFile = async (relPath: string) => {
    if (opening) return;
    abortRun();
    setOpening(true);
    setOpenError('');
    try {
      const file = await window.schoolwork.projectRead({ path: relPath });
      if (!mounted.current) return;
      rememberRecent(file);
      setRecents([...recentFiles]);
      setOpen(file);
      setSelectionText('');
    } catch (e) {
      if (mounted.current) {
        setOpen(null);
        setOpenError(errorText(e));
      }
    } finally {
      if (mounted.current) setOpening(false);
    }
  };

  const explain = async () => {
    if (!open || open.text == null || explaining) return;
    const selection = selectionText.trim() || undefined;
    const text = buildExplainFileRequest({
      path: open.path,
      name: open.name,
      language: swedish ? 'sv' : 'en',
      selection,
      content: open.text,
    });
    setExplaining(true);
    try {
      const sent = await onExplain(text);
      if (!sent && mounted.current)
        setError(t('The explanation could not be sent.', 'Förklaringen kunde inte skickas.'));
    } finally {
      if (mounted.current) setExplaining(false);
    }
  };

  const startRun = async () => {
    if (!open || !isRunnableName(open.name) || runIdRef.current) return;
    const file = open;
    try {
      const started = await window.schoolwork.projectRun({ path: file.path });
      if (!mounted.current) {
        void window.schoolwork.projectRunStop(started.runId).catch(() => {});
        return;
      }
      runIdRef.current = started.runId;
      setSelectionText('');
      setRun({ status: 'running', runId: started.runId, command: started.command, stdout: '', stderr: '' });
    } catch (e) {
      if (mounted.current)
        setRun({ status: 'error', command: runCommandLabel(file.name, file.path), error: errorText(e) });
    }
  };

  const stopRun = () => {
    if (runIdRef.current) void window.schoolwork.projectRunStop(runIdRef.current).catch(() => {});
  };

  const filtering = filter.trim().length > 0;
  const visible = useMemo(
    () => (tree ? filterWorkbenchTree(tree.entries, filter) : new Set<string>()),
    [tree, filter],
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string, WorkbenchEntry[]>();
    if (tree)
      for (const e of tree.entries) {
        const i = e.path.lastIndexOf('/');
        const parent = i < 0 ? '' : e.path.slice(0, i);
        const list = map.get(parent) || [];
        list.push(e);
        map.set(parent, list);
      }
    return map;
  }, [tree]);
  const isExpanded = (p: string) => (filtering ? true : Boolean(expanded[p]));
  const toggle = (p: string) => setExpanded(prev => ({ ...prev, [p]: !prev[p] }));

  const renderRows = (parent: string, depth: number): ReactNode[] => {
    const rows: ReactNode[] = [];
    const kids = (childrenOf.get(parent) || []).filter(e => visible.has(e.path));
    for (const e of kids) {
      if (e.type === 'dir') {
        const openState = isExpanded(e.path);
        rows.push(
          <button
            key={e.path}
            type="button"
            className="wb-row"
            style={{ paddingLeft: 12 + depth * 14 }}
            onClick={() => toggle(e.path)}
            aria-expanded={openState}
            data-dir={e.path}
          >
            <ChevronRight size={13} className={'wb-chevron' + (openState ? ' open' : '')} />
            {openState ? <FolderOpen size={14} className="wb-dir-icon" /> : <Folder size={14} className="wb-dir-icon" />}
            <span className="wb-name">{e.name}</span>
          </button>,
        );
        if (openState) rows.push(...renderRows(e.path, depth + 1));
      } else {
        rows.push(
          <button
            key={e.path}
            type="button"
            className={'wb-row' + (open?.path === e.path ? ' selected' : '')}
            style={{ paddingLeft: 25 + depth * 14 }}
            onClick={() => void openFile(e.path)}
            data-file={e.path}
          >
            <FileText size={14} className="wb-file-icon" />
            <span className="wb-name">{e.name}</span>
          </button>,
        );
      }
    }
    return rows;
  };

  const highlighted = useMemo(
    () => (open?.text != null && !isMarkdownName(open.name) ? highlightCode(open.text, open.name) : null),
    [open],
  );
  const showMarkdown = Boolean(open?.text != null && !open.tooLarge && !open.binary && isMarkdownName(open.name));
  const showCode = Boolean(open?.text != null && !open.tooLarge && !open.binary && !isMarkdownName(open.name));

  return (
    <div className="workbench">
      <aside className="wb-rail">
        <button type="button" className="wb-back" onClick={onBack}>
          <ArrowLeft size={15} />
          {t('Back', 'Tillbaka')}
        </button>
        <div className="wb-brand">
          <Files size={20} />
          <div>
            <strong>{t('Project', 'Projekt')}</strong>
            <small>{t('PROJECT WORKBENCH', 'PROJEKTARBETSPLATSEN')}</small>
          </div>
        </div>
        <label className="wb-search">
          <Search size={13} />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={t('Filter files...', 'Filtrera filer...')}
          />
          {filter && (
            <button
              type="button"
              className="wb-search-clear"
              onClick={() => setFilter('')}
              aria-label={t('Clear filter', 'Rensa filter')}
            >
              <X size={12} />
            </button>
          )}
        </label>
        <div className="wb-tree" role="tree" aria-label={t('File tree', 'Filträd')}>
          {error && <div className="wb-notice error">{error}</div>}
          {!error && tree && tree.entries.length === 0 && (
            <div className="wb-empty">{t('No files in this workspace.', 'Inga filer i den här arbetsytan.')}</div>
          )}
          {!error && filtering && tree && visible.size === 0 && (
            <div className="wb-empty">{t('No files match the filter.', 'Inga filer matchar filtret.')}</div>
          )}
          {!error && !filtering && tree?.truncated && (
            <div className="wb-truncated">
              {t('Large workspace: showing the first part of the tree.', 'Stor arbetsyta: visar en början av trädet.')}
            </div>
          )}
          {!error && renderRows('', 0)}
        </div>
        {recents.length > 0 && (
          <div className="wb-recent-block">
            <div className="wb-rail-label">
              <Clock3 size={11} />
              <span>{t('RECENT', 'SENAST ÖPPNAT')}</span>
            </div>
            {recents.slice(0, 6).map(r => (
              <button
                key={r.path}
                type="button"
                className={'wb-row recent' + (open?.path === r.path ? ' selected' : '')}
                onClick={() => void openFile(r.path)}
                title={r.path}
              >
                <FileText size={13} className="wb-file-icon" />
                <span className="wb-name">{r.name}</span>
                <span className="wb-recent-path">{r.path}</span>
              </button>
            ))}
          </div>
        )}
        <div className="wb-rail-foot" title={workspace}>
          {workspace}
        </div>
      </aside>
      <section className="wb-main">
        {open ? (
          <>
            <header className="wb-preview-bar">
              <span className="wb-preview-path" title={open.path}>
                {open.path}
              </span>
              {highlighted?.language && <span className="wb-lang">{highlighted.language}</span>}
              <span className="wb-size">{formatBytes(open.size)}</span>
              {opening && <LoaderCircle size={14} className="spin" />}
              <button
                type="button"
                className="wb-action"
                disabled={open.text == null || explaining}
                title={
                  open.tooLarge
                    ? t('File too large to explain: it is above the 1 MB preview limit.', 'Filen är för stor att förklara: över gränsen på 1 MB för förhandsvisning.')
                    : open.binary
                      ? t('Binary files can not be explained here.', 'Binärfiler kan inte förklaras här.')
                      : t('Ask the current conversation to explain this file', 'Bea den aktuella konversationen att förklara denna fil')
                }
                onClick={() => void explain()}
              >
                <Sparkles size={13} />
                <span>
                  {explaining
                    ? t('Sending…', 'Skickar…')
                    : selectionText.trim()
                      ? t('Explain selection', 'Förklara markeringen')
                      : t('Explain this', 'Förklara det här')}
                </span>
              </button>
              {isRunnableName(open.name) && (
                <button
                  type="button"
                  className="wb-action"
                  disabled={run?.status === 'running'}
                  title={t('Run this file in the workspace and show its output', 'Kör filen i arbetsytan och visa utdatan')}
                  onClick={() => void startRun()}
                >
                  <Play size={13} />
                  <span>{t('Run this file', 'Kör filen')}</span>
                </button>
              )}
              <button
                type="button"
                className="wb-close"
                onClick={() => {
                  abortRun();
                  setOpen(null);
                  setOpenError('');
                }}
                aria-label={t('Close preview', 'Stäng förhandsvisning')}
              >
                <X size={15} />
              </button>
            </header>
            <div className="wb-preview-body" ref={previewRef}>
              {open.tooLarge && (
                <div className="wb-state">
                  <FileQuestion size={30} />
                  <h2>{t('File too large to preview', 'Filen är för stor att visa')}</h2>
                  <p>
                    {t('This file is ', 'Filen är ')}
                    {formatBytes(open.size)}
                    {t(', above the 1 MB preview limit. Open it from your editor instead.', ', över gränsen på 1 MB för förhandsvisning. Öppna den i din editor istället.')}
                  </p>
                </div>
              )}
              {open.binary && !open.tooLarge && (
                <div className="wb-state">
                  <FileQuestion size={30} />
                  <h2>{t('Binary file', 'Binärfil')}</h2>
                  <p>
                    {t(
                      'Binary and unsupported files can not be previewed in the workbench.',
                      'Binärfiler och filer med okänd typ kan inte visas i arbetsytan.',
                    )}
                  </p>
                  <small>
                    {open.name} · {formatBytes(open.size)}
                  </small>
                </div>
              )}
              {showMarkdown && (
                <div className="wb-md">
                  <MessageMarkdown text={open.text!} />
                </div>
              )}
              {showCode && (
                <pre className="wb-code">
                  <code dangerouslySetInnerHTML={{ __html: highlighted?.html || escapeHtml(open.text!) }} />
                </pre>
              )}
            </div>
            {run && (
              <section className="wb-run" aria-live="polite">
                <header className="wb-run-bar">
                  <Terminal size={13} />
                  <code className="wb-run-cmd" title={run.status === 'done' ? run.result.command : run.command}>
                    {(run.status === 'done' ? run.result.command : run.command) || '—'}
                  </code>
                  <span
                    className={
                      'wb-run-state ' +
                      (run.status === 'running'
                        ? 'running'
                        : run.status === 'error'
                          ? 'error'
                          : run.result.exitCode === 0
                            ? 'ok'
                            : 'warn')
                    }
                  >
                    {run.status === 'running' && (
                      <>
                        <LoaderCircle size={12} className="spin" />
                        {t('Running…', 'Körs…')}
                      </>
                    )}
                    {run.status === 'done' &&
                      (run.result.timedOut
                        ? t('Timed out', 'Tidsgräns nåddes')
                        : run.result.stopped
                          ? t('Stopped', 'Stoppad')
                          : run.result.exitCode === 0
                            ? t('Exit code 0', 'Avslutningskod 0')
                            : t('Exit code ' + (run.result.exitCode ?? 'signal'), 'Avslutningskod ' + (run.result.exitCode ?? 'signal')))}
                    {run.status === 'error' && t('Failed to start', 'Kunde inte starta')}
                  </span>
                  {run.status === 'done' && (
                    <span className="wb-run-time">{formatRunTime(run.result.durationMs)}</span>
                  )}
                  {run.status === 'running' && (
                    <button type="button" className="wb-run-stop" onClick={stopRun}>
                      <Square size={11} />
                      <span>{t('Stop', 'Stoppa')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="wb-run-clear"
                    onClick={() => {
                      abortRun();
                      setRun(null);
                    }}
                    aria-label={t('Clear output', 'Rensa utdata')}
                  >
                    <X size={13} />
                  </button>
                </header>
                {run.status === 'error' ? (
                  <p className="wb-run-error">{run.error}</p>
                ) : (
                  <pre className="wb-run-body" ref={runBodyRef}>
                    {run.status === 'running' ? (
                      <>
                        {run.stdout && <span className="wb-run-out">{run.stdout}</span>}
                        {run.stderr && <span className="wb-run-err">{run.stderr}</span>}
                        {!run.stdout && !run.stderr && (
                          <span className="wb-run-wait">{t('Waiting for output…', 'Väntar på utdata…')}</span>
                        )}
                      </>
                    ) : (
                      <>
                        {run.result.stdout && <span className="wb-run-out">{run.result.stdout}</span>}
                        {run.result.stderr && <span className="wb-run-err">{run.result.stderr}</span>}
                        {!run.result.stdout && !run.result.stderr && (
                          <span className="wb-run-wait">{t('The run produced no output.', 'Körningen gav ingen utdata.')}</span>
                        )}
                      </>
                    )}
                  </pre>
                )}
              </section>
            )}
          </>
        ) : (
          <div className="wb-state wb-idle">
            {openError ? (
              <p className="wb-error">{openError}</p>
            ) : (
              <>
                <FileCode2 size={30} />
                <h2>{t('Open a file to preview it', 'Öppna en fil för att se den')}</h2>
                <p>
                  {t(
                    'Choose a file in the tree on the left. Code is highlighted, Markdown is rendered, and everything stays inside your workspace.',
                    'Välj en fil i trädet till vänster. Kod färgsätts, Markdown renderas och allt håller sig inom din arbetsyta.',
                  )}
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
