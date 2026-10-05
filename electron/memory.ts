import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { FSWatcher } from 'node:fs';
import type { SchoolWorkStore } from './storage';

export type MemoryStatus = 'provisional' | 'verified' | 'stale' | 'superseded' | 'archived';
export type MemoryScope = 'user' | 'project' | 'machine';
export type MemoryNote = {
  id: string; title: string; type: string; scope: MemoryScope; projectId?: string; status: MemoryStatus;
  tags: string[]; body: string; createdAt: number; updatedAt: number; lastVerified?: number; relativePath: string; revision?: number;
};

const MAX_NOTE_BYTES = 16_000;
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*[^\s,;]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
];

export function redactMemoryText(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted secret]'), value);
}

export function projectIdForWorkspace(workspace: string): string {
  return crypto.createHash('sha256').update(path.resolve(workspace).toLowerCase()).digest('hex').slice(0, 16);
}

function quote(value: string): string { return JSON.stringify(value); }
function slug(value: string): string { return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44) || 'note'; }
function noteDirectory(scope: MemoryScope, projectId?: string): string {
  if (scope === 'project') return path.join('projects', projectId || 'unassigned');
  return scope;
}
function parseFrontmatter(markdown: string): { metadata: Record<string, string>; body: string } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, body: markdown };
  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const divider = line.indexOf(':');
    if (divider < 1) continue;
    const key = line.slice(0, divider).trim();
    const value = line.slice(divider + 1).trim();
    try { metadata[key] = JSON.parse(value); } catch { metadata[key] = value.replace(/^['"]|['"]$/g, ''); }
  }
  return { metadata, body: match[2] };
}
function renderMarkdown(note: MemoryNote): string {
  const tags = JSON.stringify(note.tags);
  return [
    '---', `id: ${quote(note.id)}`, `title: ${quote(note.title)}`,
    `type: ${quote(note.type)}`, `scope: ${quote(note.scope)}`,
    `project_id: ${quote(note.projectId || '')}`, `status: ${quote(note.status)}`,
    `tags: ${tags}`, `created_at: ${note.createdAt}`, `updated_at: ${note.updatedAt}`,
    `last_verified: ${note.lastVerified || ''}`, '---', note.body.trim(), '',
  ].join('\n');
}
function safeRelative(value: string): string {
  const normalized = path.normalize(value);
  if (path.isAbsolute(value) || normalized === '..' || normalized.startsWith('..' + path.sep) || value.includes('\0')) throw new Error('Memory path is outside the vault.');
  return normalized;
}
function linksIn(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g), match => match[1].trim()))];
}
function parseTags(metadata: Record<string, string>): string[] {
  try { const value = JSON.parse(metadata.tags || '[]'); return Array.isArray(value) ? value.map(String) : []; } catch { return []; }
}

export class MemoryVault {
  readonly root: string;
  readonly projectId: string;
  private watcher?: FSWatcher;
  private reconcileTimer?: ReturnType<typeof setTimeout>;
  constructor(private store: SchoolWorkStore, userDataPath: string, defaultWorkspace: string) {
    this.root = path.join(userDataPath, 'memory-vault');
    this.projectId = projectIdForWorkspace(defaultWorkspace);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    for (const folder of ['user', 'machine', 'archive', path.join('projects', this.projectId, 'facts'), path.join('projects', this.projectId, 'decisions'), path.join('projects', this.projectId, 'lessons'), path.join('projects', this.projectId, 'procedures')]) {
      await fs.mkdir(path.join(this.root, folder), { recursive: true });
    }
    const pending = this.store.db.prepare('SELECT id,relative_path,markdown FROM memory_outbox WHERE applied_at IS NULL').all() as any[];
    for (const operation of pending) await this.applyOutbox(operation.id, operation.relative_path, operation.markdown);
    await this.reconcile();
    await this.writeIndex();
    try {
      this.watcher = require('node:fs').watch(this.root, { recursive: true }, (_event: string, filename: string | Buffer | null) => {
        const changed = String(filename || '').replace(/\\/g, '/');
        if (changed.endsWith('MEMORY.md') || changed.endsWith('.tmp')) return;
        clearTimeout(this.reconcileTimer);
        this.reconcileTimer = setTimeout(() => { void this.reconcile().then(() => this.writeIndex()).catch(() => {}); }, 300);
      });
      this.watcher?.unref();
    } catch { /* Startup reconciliation remains available on filesystems without recursive watching. */ }
  }

  async create(input: { title: string; type: string; scope: MemoryScope; projectId?: string; status?: MemoryStatus; tags?: string[]; body: string; source?: string; lastVerified?: number }): Promise<MemoryNote> {
    const title = redactMemoryText(String(input.title || '').trim()).slice(0, 140);
    const body = redactMemoryText(String(input.body || '')).trim();
    if (!title || !body) throw new Error('Memory title and note body are required.');
    if (Buffer.byteLength(body, 'utf8') > MAX_NOTE_BYTES) throw new Error('Memory note is too large. Keep it under 16 KB.');
    const scope = input.scope;
    const projectId = scope === 'project' ? (input.projectId || this.projectId) : undefined;
    if (scope === 'project' && !/^[a-z0-9_-]{1,80}$/i.test(projectId!)) throw new Error('Invalid project memory identifier.');
    const id = crypto.randomUUID();
    const now = Date.now();
    const relativePath = safeRelative(path.join(noteDirectory(scope, projectId), `${slug(title)}-${id.slice(0, 8)}.md`));
    const note: MemoryNote = { id, title, type: input.type, scope, projectId, status: input.status || 'provisional', tags: (input.tags || []).map(String).slice(0, 12), body, createdAt: now, updatedAt: now, lastVerified: input.lastVerified, relativePath };
    await this.persist(note, input.source || 'agent');
    return note;
  }

  async update(noteId: string, expectedRevision: number, changes: Partial<Pick<MemoryNote, 'title' | 'body' | 'status' | 'tags' | 'lastVerified'>>): Promise<MemoryNote> {
    const existing = this.get(noteId);
    if (!existing) throw new Error('Memory note not found.');
    const revision = Number((this.store.db.prepare('SELECT COALESCE(MAX(revision),0) AS n FROM memory_revisions WHERE note_id=?').get(noteId) as any).n);
    if (revision !== expectedRevision) throw new Error('Memory note changed elsewhere. Reload it before saving.');
    const note = { ...existing, ...changes, title: redactMemoryText(changes.title ?? existing.title).slice(0, 140), body: redactMemoryText(changes.body ?? existing.body).trim(), updatedAt: Date.now() };
    if (Buffer.byteLength(note.body, 'utf8') > MAX_NOTE_BYTES) throw new Error('Memory note is too large. Keep it under 16 KB.');
    await this.persist(note, 'user-edit');
    return note;
  }

  get(noteId: string): MemoryNote | undefined {
    const row = this.store.db.prepare('SELECT * FROM memory_notes WHERE id=?').get(noteId) as any;
    if (!row) return undefined;
    const relativePath = safeRelative(row.relative_path);
    const markdown = require('node:fs').readFileSync(path.join(this.root, relativePath), 'utf8');
    const { metadata, body } = parseFrontmatter(markdown);
    return {
      id: row.id, title: redactMemoryText(metadata.title || row.title), type: metadata.type || row.type, scope: metadata.scope || row.scope,
      projectId: metadata.project_id || row.project_id || undefined, status: metadata.status || row.status,
      tags: parseTags(metadata).map(redactMemoryText), body: redactMemoryText(body), createdAt: Number(metadata.created_at) || row.created_at,
      updatedAt: Number(metadata.updated_at) || row.updated_at, lastVerified: Number(metadata.last_verified) || row.last_verified || undefined,
      relativePath, revision: this.revision(row.id),
    };
  }

  list(filters: { scope?: MemoryScope; projectId?: string; status?: MemoryStatus } = {}): MemoryNote[] {
    const clauses = ['1=1']; const values: string[] = [];
    if (filters.scope) { clauses.push('scope=?'); values.push(filters.scope); }
    if (filters.projectId) { clauses.push('(project_id=? OR scope!=\'project\')'); values.push(filters.projectId); }
    if (filters.status) { clauses.push('status=?'); values.push(filters.status); }
    else clauses.push("status NOT IN ('archived','superseded')");
    const ids = (this.store.db.prepare(`SELECT id FROM memory_notes WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT 500`).all(...values) as any[]).map(row => row.id);
    return ids.map(id => this.get(id)).filter(Boolean) as MemoryNote[];
  }

  search(query: string, filters: { projectId?: string; limit?: number } = {}): MemoryNote[] {
    const terms = query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [];
    if (!terms.length) return [];
    const ftsQuery = terms.slice(0, 12).map(term => `"${term.replace(/"/g, '""')}"*`).join(' OR ');
    let rows: any[];
    try { rows = this.store.db.prepare(`SELECT f.note_id FROM memory_fts f JOIN memory_notes n ON n.id=f.note_id WHERE memory_fts MATCH ? AND n.status IN ('verified','provisional','stale') AND (n.scope!='project' OR n.project_id=?) ORDER BY bm25(memory_fts), CASE n.status WHEN 'verified' THEN 0 WHEN 'provisional' THEN 1 ELSE 2 END, n.updated_at DESC LIMIT ?`).all(ftsQuery, filters.projectId || this.projectId, Math.min(filters.limit || 8, 8)) as any[]; }
    catch { return []; }
    const results: MemoryNote[] = []; let budget = 8_000;
    for (const row of rows) {
      const note = this.get(row.note_id);
      if (!note) continue;
      const cost = note.title.length + note.body.length;
      if (cost > budget) continue;
      budget -= cost; results.push(note);
    }
    return results;
  }

  async archive(noteId: string): Promise<MemoryNote> {
    const note = this.get(noteId);
    if (!note) throw new Error('Memory note not found.');
    const archived: MemoryNote = { ...note, status: 'archived', updatedAt: Date.now(), relativePath: safeRelative(path.join('archive', path.basename(note.relativePath))) };
    await this.persist(archived, 'archive');
    if (note.relativePath !== archived.relativePath) await fs.rm(path.join(this.root, safeRelative(note.relativePath)), { force: true });
    return archived;
  }

  async forget(noteId: string): Promise<void> {
    const row = this.store.db.prepare('SELECT relative_path FROM memory_notes WHERE id=?').get(noteId) as any;
    if (!row) return;
    const note = this.get(noteId);
    const trigger = note?.body.match(/## Trigger\s*\n([\s\S]*?)(?:\n## |$)/)?.[1]?.trim();
    const signature = trigger && note ? crypto.createHash('sha256').update(`${note.scope}| ${note.projectId || ''}| ${trigger.toLowerCase()}`).digest('hex') : noteId;
    this.store.db.prepare('INSERT OR REPLACE INTO memory_suppressions(note_id,normalized_signature,suppressed_at) VALUES(?,?,?)').run(noteId, signature, Date.now());
    this.store.db.prepare('DELETE FROM memory_links WHERE source_id=? OR target_id=?').run(noteId, noteId);
    this.store.db.prepare('DELETE FROM memory_fts WHERE note_id=?').run(noteId);
    this.store.db.prepare('DELETE FROM memory_notes WHERE id=?').run(noteId);
    this.store.db.prepare('DELETE FROM memory_revisions WHERE note_id=?').run(noteId);
    this.store.db.prepare('DELETE FROM memory_usage WHERE note_id=?').run(noteId);
    this.store.db.prepare('DELETE FROM memory_outbox WHERE note_id=?').run(noteId);
    const target = path.join(this.root, safeRelative(row.relative_path));
    await fs.rm(target, { force: true });
    await this.writeIndex();
  }

  recordUsage(eventId: string, notes: MemoryNote[]): void {
    const insert = this.store.db.prepare('INSERT OR IGNORE INTO memory_usage(event_id,note_id,used_at) VALUES(?,?,?)');
    const tx = () => this.store.transaction(() => notes.forEach(note => insert.run(eventId, note.id, Date.now())));
    tx();
  }

  graph(projectId = this.projectId, noteId?: string, depth = 1) {
    const notes = this.list({ projectId }).slice(0, 200);
    const ids = new Set(notes.map(note => note.id));
    const links = (this.store.db.prepare('SELECT source_id,target_id,relation FROM memory_links').all() as any[])
      .filter(link => ids.has(link.source_id) && ids.has(link.target_id) && (!noteId || link.source_id === noteId || link.target_id === noteId));
    if (noteId && depth <= 0) return { nodes: notes.filter(note => note.id === noteId).map(({id,title,type,status}) => ({id,title,type,status})), edges: [] };
    return { nodes: notes.map(({id,title,type,status}) => ({id,title,type,status})), edges: links.map(({source_id,target_id,relation}) => ({source:source_id,target:target_id,relation})) };
  }

  async readInstructions(workspace: string): Promise<string[]> {
    const resolved = path.resolve(workspace);
    const ancestors: string[] = [];
    let current = resolved;
    for (let i = 0; i < 6; i++) {
      ancestors.unshift(current);
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    const collected: string[] = [];
    let budget = 20_000;
    for (const folder of ancestors) {
      for (const name of ['AGENTS.md', 'agents.md']) {
        const filename = path.join(folder, name);
        try {
          const content = redactMemoryText(await fs.readFile(filename, 'utf8')).slice(0, Math.min(5_000, budget));
          if (content.trim()) {
            collected.push(`Instruction file (untrusted workspace data) ${filename}:\n${content}`);
            budget -= content.length;
          }
        } catch {}
        if (budget <= 0) return collected;
      }
    }
    return collected;
  }

  async proposeLesson(input: { title: string; trigger: string; failedApproach: string; correction: string; verification: string; scope: MemoryScope; projectId?: string; evidenceId: string; relatedPaths?: string[] }): Promise<MemoryNote | null> {
    const signature = crypto.createHash('sha256').update(`${input.scope}| ${input.projectId || ''}| ${input.trigger.toLowerCase()}`).digest('hex');
    if (this.store.db.prepare('SELECT 1 FROM memory_suppressions WHERE normalized_signature=?').get(signature)) return null;
    const paths = (input.relatedPaths || []).slice(0, 8).map(item => redactMemoryText(item));
    const body = [
      '## Trigger', redactMemoryText(input.trigger).slice(0, 900),
      '## Failed approach', redactMemoryText(input.failedApproach).slice(0, 900),
      '## Correction', redactMemoryText(input.correction).slice(0, 1400),
      '## Verification evidence', redactMemoryText(input.verification).slice(0, 1000),
      paths.length ? `## Related paths\n${paths.map(item => `- ${item}`).join('\n')}` : '',
      `## Evidence\n- Task/event: ${input.evidenceId}`,
      '## Limits\nThis lesson is scoped to the trigger and project above; revalidate when code or environment changes.',
    ].filter(Boolean).join('\n\n');
    const existing = this.search(input.trigger, { projectId: input.projectId, limit: 3 }).find(note => note.type === 'lesson' && note.status !== 'archived');
    if (existing) {
      const text = existing.body + `\n\n## Additional evidence ${new Date().toISOString()}\n${body}`;
      return this.update(existing.id, this.revision(existing.id), { body: text, status: 'provisional' });
    }
    return this.create({ title: input.title, type: 'lesson', scope: input.scope, projectId: input.projectId, status: 'provisional', tags: ['lesson', slug(input.trigger)], body, source: 'verified-recovery' });
  }

  private revision(noteId: string): number {
    return Number((this.store.db.prepare('SELECT COALESCE(MAX(revision),0) AS n FROM memory_revisions WHERE note_id=?').get(noteId) as any).n);
  }

  private async persist(note: MemoryNote, source: string): Promise<void> {
    const markdown = renderMarkdown(note);
    const outboxId = crypto.randomUUID();
    const relativePath = safeRelative(note.relativePath);
    const prior = this.store.db.prepare('SELECT body_hash FROM memory_notes WHERE id=?').get(note.id) as any;
    if (prior) {
      try {
        const current = await fs.readFile(path.join(this.root, relativePath), 'utf8');
        const hash = crypto.createHash('sha256').update(current).digest('hex');
        if (hash !== prior.body_hash) {
          const parsed = parseFrontmatter(current);
          await this.reindexExternal(this.noteFromMetadata(parsed.metadata, parsed.body, relativePath), current);
          throw new Error('This memory note changed in Obsidian. It was preserved; reload it before saving.');
        }
      } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
    }
    this.store.db.prepare('INSERT INTO memory_outbox(id,note_id,relative_path,operation,markdown,created_at) VALUES(?,?,?,?,?,?)').run(outboxId, note.id, relativePath, 'write', markdown, Date.now());
    await this.applyOutbox(outboxId, relativePath, markdown, note, source);
    await this.writeIndex();
  }

  private async applyOutbox(outboxId: string, relativePath: string, markdown: string, note?: MemoryNote, source = 'reconcile'): Promise<void> {
    const resolvedPath = path.resolve(this.root, safeRelative(relativePath));
    const rootPath = path.resolve(this.root);
    if (resolvedPath !== rootPath && !resolvedPath.startsWith(rootPath + path.sep)) throw new Error('Memory path is outside the vault.');
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    const temporary = `${resolvedPath}.${outboxId}.tmp`;
    await fs.writeFile(temporary, markdown, 'utf8');
    await fs.rename(temporary, resolvedPath);
    const parsed = parseFrontmatter(markdown);
    const data = note || this.noteFromMetadata(parsed.metadata, parsed.body, relativePath);
    const hash = crypto.createHash('sha256').update(markdown).digest('hex');
    const links = linksIn(parsed.body);
    const tx = () => this.store.transaction(() => {
      this.store.db.prepare('INSERT INTO memory_notes(id,title,relative_path,type,scope,project_id,status,tags_json,body_hash,created_at,updated_at,last_verified) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,relative_path=excluded.relative_path,type=excluded.type,scope=excluded.scope,project_id=excluded.project_id,status=excluded.status,tags_json=excluded.tags_json,body_hash=excluded.body_hash,updated_at=excluded.updated_at,last_verified=excluded.last_verified')
        .run(data.id, data.title, relativePath, data.type, data.scope, data.projectId || null, data.status, JSON.stringify(data.tags), hash, data.createdAt, data.updatedAt, data.lastVerified || null);
      const revision = this.revision(data.id) + 1;
      this.store.db.prepare('INSERT INTO memory_revisions(note_id,revision,markdown,changed_at,source) VALUES(?,?,?,?,?)').run(data.id, revision, markdown, Date.now(), source);
      this.store.db.prepare('DELETE FROM memory_fts WHERE note_id=?').run(data.id);
      if (data.status !== 'archived' && data.status !== 'superseded') this.store.db.prepare('INSERT INTO memory_fts(note_id,title,body,tags) VALUES(?,?,?,?)').run(data.id, data.title, data.body, data.tags.join(' '));
      this.store.db.prepare('DELETE FROM memory_links WHERE source_id=?').run(data.id);
      for (const link of links) this.store.db.prepare("INSERT OR IGNORE INTO memory_links(source_id,target_id,relation) SELECT ?,id,'related' FROM memory_notes WHERE id=? OR title=? OR replace(relative_path,char(92),'/')=? OR replace(replace(relative_path,char(92),'/'),'.md','')=? LIMIT 1").run(data.id, link, link, link, link);
      this.store.db.prepare('UPDATE memory_outbox SET applied_at=? WHERE id=?').run(Date.now(), outboxId);
    });
    tx();
  }

  private noteFromMetadata(metadata: Record<string, string>, body: string, relativePath: string): MemoryNote {
    const scope = (['user', 'project', 'machine'].includes(metadata.scope) ? metadata.scope : 'project') as MemoryScope;
    return {
      id: metadata.id || crypto.randomUUID(), title: metadata.title || path.basename(relativePath, '.md'),
      type: metadata.type || 'imported', scope, projectId: metadata.project_id || undefined,
      status: (['provisional','verified','stale','superseded','archived'].includes(metadata.status) ? metadata.status : 'provisional') as MemoryStatus,
      tags: parseTags(metadata), body, createdAt: Number(metadata.created_at) || Date.now(),
      updatedAt: Number(metadata.updated_at) || Date.now(), lastVerified: Number(metadata.last_verified) || undefined, relativePath,
    };
  }

  private async reconcile(): Promise<void> {
    const walk = async (directory: string): Promise<string[]> => {
      const files: string[] = [];
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) files.push(...await walk(full));
        else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'MEMORY.md' && !entry.name.endsWith('.tmp')) files.push(full);
      }
      return files;
    };
    for (const filename of await walk(this.root)) {
      const relativePath = safeRelative(path.relative(this.root, filename));
      const markdown = await fs.readFile(filename, 'utf8');
      const parsed = parseFrontmatter(markdown);
      let note = this.noteFromMetadata(parsed.metadata, parsed.body, relativePath);
      const known = this.store.db.prepare('SELECT id,body_hash FROM memory_notes WHERE relative_path=?').get(relativePath) as any;
      if (known) {
        note.id = known.id;
        const hash = crypto.createHash('sha256').update(markdown).digest('hex');
        if (hash !== known.body_hash) {
          const metadata = parsed.metadata;
          if (!metadata.id) note = { ...note, id: known.id };
          await this.reindexExternal(note, markdown);
        }
      } else {
        if (!parsed.metadata.id) note = { ...note, id: crypto.randomUUID() };
        await this.reindexExternal(note, markdown);
      }
    }
  }

  private async reindexExternal(note: MemoryNote, markdown: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(markdown).digest('hex');
    const safeNote = { ...note, title: redactMemoryText(note.title), body: redactMemoryText(note.body), tags: note.tags.map(redactMemoryText) };
    const safeMarkdown = renderMarkdown(safeNote);
    const tx = () => this.store.transaction(() => {
      this.store.db.prepare('INSERT INTO memory_notes(id,title,relative_path,type,scope,project_id,status,tags_json,body_hash,created_at,updated_at,last_verified) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,type=excluded.type,scope=excluded.scope,project_id=excluded.project_id,status=excluded.status,tags_json=excluded.tags_json,body_hash=excluded.body_hash,updated_at=excluded.updated_at,last_verified=excluded.last_verified')
        .run(safeNote.id,safeNote.title,safeNote.relativePath,safeNote.type,safeNote.scope,safeNote.projectId||null,safeNote.status,JSON.stringify(safeNote.tags),hash,safeNote.createdAt,safeNote.updatedAt,safeNote.lastVerified||null);
      const revision = this.revision(note.id) + 1;
      this.store.db.prepare('INSERT INTO memory_revisions(note_id,revision,markdown,changed_at,source) VALUES(?,?,?,?,?)').run(note.id,revision,safeMarkdown,Date.now(),'external-edit');
      this.store.db.prepare('DELETE FROM memory_fts WHERE note_id=?').run(note.id);
      if(safeNote.status!=='archived'&&safeNote.status!=='superseded')this.store.db.prepare('INSERT INTO memory_fts(note_id,title,body,tags) VALUES(?,?,?,?)').run(safeNote.id,safeNote.title,safeNote.body,safeNote.tags.join(' '));
      this.store.db.prepare('DELETE FROM memory_links WHERE source_id=?').run(note.id);
      for(const link of linksIn(safeNote.body))this.store.db.prepare("INSERT OR IGNORE INTO memory_links(source_id,target_id,relation) SELECT ?,id,'related' FROM memory_notes WHERE id=? OR title=? OR replace(relative_path,char(92),'/')=? OR replace(replace(relative_path,char(92),'/'),'.md','')=? LIMIT 1").run(safeNote.id,link,link,link,link);
    });
    tx();
  }

  private async writeIndex(): Promise<void> {
    const notes = this.list();
    const rebuildLinks = () => this.store.transaction(() => {
      this.store.db.prepare('DELETE FROM memory_links').run();
      for (const note of notes) for (const link of linksIn(note.body)) {
        this.store.db.prepare("INSERT OR IGNORE INTO memory_links(source_id,target_id,relation) SELECT ?,id,'related' FROM memory_notes WHERE id=? OR title=? OR replace(relative_path,char(92),'/')=? OR replace(replace(relative_path,char(92),'/'),'.md','')=? LIMIT 1").run(note.id, link, link, link, link);
      }
    });
    rebuildLinks();
    const body = ['# SchoolWork memory', '', 'Local notes indexed from this Obsidian-compatible vault. Project lessons remain scoped to their project.', '',
      ...notes.map(note => `- [[${note.relativePath.replace(/\\/g, '/').replace(/\.md$/i, '')}|${note.title}]] — ${note.type}, ${note.status}, ${note.scope}`), ''].join('\n');
    const filename = path.join(this.root, 'MEMORY.md');
    const temporary = `${filename}.tmp`;
    await fs.writeFile(temporary, body, 'utf8');
    await fs.rename(temporary, filename);
  }
}
