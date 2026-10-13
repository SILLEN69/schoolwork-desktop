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
  Search,
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
  filterWorkbenchTree,
  formatBytes,
  isMarkdownName,
  languageForPath,
  type RecentFile,
  type WorkbenchEntry,
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
type Props = { workspace: string; swedish: boolean; onBack: () => void };

// Only the grammars the extension map can request are registered, keeping the
// preview lightweight while reusing the highlighter the markdown stack already ships.
const grammars: Record<string, LanguageFn> = {
  c, cpp, csharp, css, diff, dockerfile, go, ini, java, javascript, json,
  less, makefile, markdown, python, ruby, rust, scss, shell, sql, typescript, xml, yaml,
};
for (const [name, grammar] of Object.entries(grammars)) hljs.registerLanguage(name, grammar);

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

export default function ProjectWorkbench({ workspace, swedish, onBack }: Props) {
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const [tree, setTree] = useState<{ entries: WorkbenchEntry[]; truncated: boolean } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<FileView | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [error, setError] = useState('');
  const [recents, setRecents] = useState<RecentFile[]>(() => [...recentFiles]);
  const mounted = useRef(true);
  const firstTree = useRef(true);

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
    const off = window.schoolwork.onProjectChanged(ws => {
      if (mounted.current && ws === workspace) void load();
    });
    void load();
    void window.schoolwork.projectWatchStart().catch(() => {});
    return () => {
      mounted.current = false;
      off();
      void window.schoolwork.projectWatchStop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  const openFile = async (relPath: string) => {
    if (opening) return;
    setOpening(true);
    setOpenError('');
    try {
      const file = await window.schoolwork.projectRead({ path: relPath });
      if (!mounted.current) return;
      rememberRecent(file);
      setRecents([...recentFiles]);
      setOpen(file);
    } catch (e) {
      if (mounted.current) {
        setOpen(null);
        setOpenError(errorText(e));
      }
    } finally {
      if (mounted.current) setOpening(false);
    }
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
                className="wb-close"
                onClick={() => {
                  setOpen(null);
                  setOpenError('');
                }}
                aria-label={t('Close preview', 'Stäng förhandsvisning')}
              >
                <X size={15} />
              </button>
            </header>
            <div className="wb-preview-body">
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
