import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type StoredMessage = {
  id: string;
  conversationId: string;
  sequence: number;
  role: 'user' | 'assistant' | 'tool' | 'legacy_observation';
  content: string;
  model?: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: any[];
  createdAt: number;
  legacyData?: string;
};

export type TaskState = 'queued' | 'running' | 'waiting_retry' | 'waiting_user' | 'paused' | 'failed' | 'completed' | 'cancelled';

export class SchoolWorkStore {
  readonly db: DatabaseSync;
  migrationWarning = '';

  constructor(userDataPath: string) {
    const dbPath = path.join(userDataPath, 'schoolwork.sqlite3');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, model TEXT, name TEXT,
        tool_call_id TEXT, tool_calls_json TEXT, client_request_id TEXT UNIQUE, legacy_data TEXT,
        created_at INTEGER NOT NULL, UNIQUE(conversation_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS messages_conversation_sequence ON messages(conversation_id, sequence);
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
        client_request_id TEXT NOT NULL UNIQUE, objective TEXT NOT NULL, model TEXT NOT NULL,
        workspace TEXT NOT NULL, state TEXT NOT NULL, current_turn INTEGER NOT NULL DEFAULT 0,
        pending_request_json TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tasks_state_created ON tasks(state, created_at);
      CREATE TABLE IF NOT EXISTS tool_executions (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), call_id TEXT NOT NULL,
        name TEXT NOT NULL, arguments_json TEXT NOT NULL, status TEXT NOT NULL,
        result_json TEXT, started_at INTEGER NOT NULL, finished_at INTEGER,
        UNIQUE(task_id, call_id)
      );
      CREATE TABLE IF NOT EXISTS task_events (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), conversation_id TEXT NOT NULL,
        sequence INTEGER NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL,
        UNIQUE(task_id, sequence)
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), path TEXT NOT NULL,
        type TEXT NOT NULL, sha256 TEXT, verification_status TEXT NOT NULL DEFAULT 'unverified',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_notes (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, relative_path TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL, scope TEXT NOT NULL, project_id TEXT, status TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]', body_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL, last_verified INTEGER
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(note_id UNINDEXED, title, body, tags);
      CREATE TABLE IF NOT EXISTS memory_links (
        source_id TEXT NOT NULL, target_id TEXT NOT NULL, relation TEXT NOT NULL DEFAULT 'related',
        PRIMARY KEY(source_id, target_id, relation)
      );
      CREATE TABLE IF NOT EXISTS memory_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, note_id TEXT NOT NULL, revision INTEGER NOT NULL,
        markdown TEXT NOT NULL, changed_at INTEGER NOT NULL, source TEXT NOT NULL,
        UNIQUE(note_id, revision)
      );
      CREATE TABLE IF NOT EXISTS memory_suppressions (
        note_id TEXT PRIMARY KEY, normalized_signature TEXT NOT NULL, suppressed_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memory_usage (
        event_id TEXT NOT NULL, note_id TEXT NOT NULL, used_at INTEGER NOT NULL,
        PRIMARY KEY(event_id, note_id)
      );
      CREATE TABLE IF NOT EXISTS memory_outbox (
        id TEXT PRIMARY KEY, note_id TEXT NOT NULL, relative_path TEXT NOT NULL, operation TEXT NOT NULL,
        markdown TEXT NOT NULL, created_at INTEGER NOT NULL, applied_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS diagnostics (
        id TEXT PRIMARY KEY, task_id TEXT, category TEXT NOT NULL, message TEXT NOT NULL,
        details_json TEXT NOT NULL, created_at INTEGER NOT NULL
      );
    `);
    this.migrateLegacyJson(userDataPath);
    this.recoverInterruptedTasks();
  }

  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private migrateLegacyJson(userDataPath: string) {
    const key = 'legacy_json_migration_v1';
    if (this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key)) return;
    const legacyFile = path.join(userDataPath, 'schoolwork-data.json');
    let raw: string;
    try { raw = require('node:fs').readFileSync(legacyFile, 'utf8'); }
    catch (error: any) {
      if (error?.code === 'ENOENT') {
        this.db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)').run(key, 'empty');
        return;
      }
      this.migrationWarning = 'Could not read the existing conversation history. The original file was preserved.';
      return;
    }
    let chats: any[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('The legacy conversation file is not a list.');
      chats = parsed;
    } catch (error: any) {
      this.migrationWarning = `Existing conversation history needs recovery: ${error.message}. The original file was preserved.`;
      return;
    }
    const migrate = () => this.transaction(() => {
      const addConversation = this.db.prepare('INSERT OR IGNORE INTO conversations(id,title,created_at,updated_at) VALUES(?,?,?,?)');
      const addMessage = this.db.prepare('INSERT OR IGNORE INTO messages(id,conversation_id,sequence,role,content,model,name,tool_call_id,tool_calls_json,legacy_data,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
      for (const chat of chats) {
        if (!chat || typeof chat.id !== 'string') continue;
        const now = Number(chat.updatedAt) || Date.now();
        addConversation.run(chat.id, String(chat.title || 'Untitled task'), now, now);
        for (const [sequence, message] of (Array.isArray(chat.messages) ? chat.messages : []).entries()) {
          const rawRole = String(message?.role || 'legacy_observation');
          const role = rawRole === 'user' || rawRole === 'assistant' ? rawRole : 'legacy_observation';
          addMessage.run(
            `legacy-${chat.id}-${sequence}`, chat.id, sequence, role,
            String(message?.content ?? ''), message?.model ?? null, message?.name ?? null,
            message?.tool_call_id ?? null, message?.tool_calls ? JSON.stringify(message.tool_calls) : null,
            JSON.stringify(message), Number(message?.createdAt) || now,
          );
        }
      }
      this.db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)').run(key, JSON.stringify({ importedChats: chats.length, importedMessages: chats.reduce((sum, chat) => sum + (Array.isArray(chat?.messages) ? chat.messages.length : 0), 0) }));
    });
    try { migrate(); } catch (error: any) {
      this.migrationWarning = `Conversation migration failed and was rolled back: ${error.message}. The original file was preserved.`;
    }
  }

  private recoverInterruptedTasks() {
    const interrupted = this.db.prepare("SELECT id,conversation_id FROM tasks WHERE state IN ('running','queued')").all() as any[];
    const update = this.db.prepare("UPDATE tasks SET state='paused',error=?,updated_at=? WHERE id=?");
    const event = this.db.prepare('INSERT INTO task_events(id,task_id,conversation_id,sequence,type,payload_json,created_at) VALUES(?,?,?,?,?,?,?)');
    for (const task of interrupted) {
      update.run('Application closed before task completion. Review the last tool operation before resuming.', Date.now(), task.id);
      const sequence = Number((this.db.prepare('SELECT COALESCE(MAX(sequence),0)+1 AS n FROM task_events WHERE task_id=?').get(task.id) as any).n);
      event.run(crypto.randomUUID(), task.id, task.conversation_id, sequence, 'recovery_required', JSON.stringify({ message: 'Inspect any interrupted tool operation before retrying.' }), Date.now());
    }
  }

  listConversations() {
    const rows = this.db.prepare('SELECT id,title,updated_at FROM conversations ORDER BY updated_at DESC').all() as any[];
    return rows.map(row => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
  }

  lastMessageSequence(conversationId: string): number {
    return Number((this.db.prepare('SELECT COALESCE(MAX(sequence),-1) AS n FROM messages WHERE conversation_id=?').get(conversationId) as any).n);
  }

  getMessages(conversationId: string, includeObservations = true): StoredMessage[] {
    const rows = this.db.prepare(`SELECT id,conversation_id,sequence,role,content,model,name,tool_call_id,tool_calls_json,legacy_data,created_at
      FROM messages WHERE conversation_id=? ${includeObservations ? '' : "AND role!='legacy_observation'"} ORDER BY sequence`).all(conversationId) as any[];
    return rows.map(row => ({
      id: row.id, conversationId: row.conversation_id, sequence: row.sequence, role: row.role, content: row.content,
      model: row.model || undefined, name: row.name || undefined, toolCallId: row.tool_call_id || undefined,
      toolCalls: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : undefined, createdAt: row.created_at,
      legacyData: row.legacy_data || undefined,
    }));
  }

  addMessage(conversationId: string, message: Omit<StoredMessage, 'id' | 'sequence' | 'conversationId' | 'createdAt'> & { clientRequestId?: string }) {
    const now = Date.now();
    const insert = () => this.transaction(() => {
      this.db.prepare('INSERT OR IGNORE INTO conversations(id,title,created_at,updated_at) VALUES(?,?,?,?)').run(conversationId, message.role === 'user' ? message.content.slice(0, 72) : 'Untitled task', now, now);
      const sequence = Number((this.db.prepare('SELECT COALESCE(MAX(sequence),-1)+1 AS n FROM messages WHERE conversation_id=?').get(conversationId) as any).n);
      const id = crypto.randomUUID();
      const result = this.db.prepare('INSERT OR IGNORE INTO messages(id,conversation_id,sequence,role,content,model,name,tool_call_id,tool_calls_json,client_request_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
        id, conversationId, sequence, message.role, message.content, message.model || null, message.name || null,
        message.toolCallId || null, message.toolCalls ? JSON.stringify(message.toolCalls) : null, message.clientRequestId || null, now,
      );
      this.db.prepare('UPDATE conversations SET updated_at=? WHERE id=?').run(now, conversationId);
      return result.changes ? id : String((this.db.prepare('SELECT id FROM messages WHERE client_request_id=?').get(message.clientRequestId ?? null) as any)?.id || id);
    });
    return insert();
  }

  createTask(input: { id: string; conversationId: string; clientRequestId: string; objective: string; model: string; workspace: string; state: TaskState }) {
    const now = Date.now();
    this.db.prepare('INSERT INTO tasks(id,conversation_id,client_request_id,objective,model,workspace,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(input.id, input.conversationId, input.clientRequestId, input.objective, input.model, input.workspace, input.state, now, now);
  }

  startTask(input: { id: string; conversationId: string; clientRequestId: string; objective: string; model: string; workspace: string; attachmentIds?: string[]; metadata?: Record<string, string> }) {
    const now = Date.now();
    this.transaction(() => {
      this.db.prepare('INSERT OR IGNORE INTO conversations(id,title,created_at,updated_at) VALUES(?,?,?,?)')
        .run(input.conversationId, input.objective.slice(0, 72), now, now);
      this.db.prepare('INSERT INTO tasks(id,conversation_id,client_request_id,objective,model,workspace,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(input.id, input.conversationId, input.clientRequestId, input.objective, input.model, input.workspace, 'queued', now, now);
      const sequence = Number((this.db.prepare('SELECT COALESCE(MAX(sequence),-1)+1 AS n FROM messages WHERE conversation_id=?').get(input.conversationId) as any).n);
      const messageId = crypto.randomUUID();
      this.db.prepare('INSERT INTO messages(id,conversation_id,sequence,role,content,client_request_id,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(messageId, input.conversationId, sequence, 'user', input.objective, input.clientRequestId, now);
      for (const attachmentId of input.attachmentIds || []) {
        const linked = this.db.prepare('UPDATE image_attachments SET message_id=? WHERE id=? AND conversation_id=? AND message_id IS NULL').run(messageId, attachmentId, input.conversationId);
        if (!linked.changes) throw new Error('Attachment ownership changed. The message was not sent.');
      }
      this.db.prepare('UPDATE conversations SET updated_at=? WHERE id=?').run(now, input.conversationId);
      // Permission snapshots and phone routing must commit with the user message/task.
      for (const [key, value] of Object.entries(input.metadata || {})) this.setMetadata(key, value);
    });
  }

  updateTask(id: string, state: TaskState, patch: { currentTurn?: number; pendingRequest?: unknown; error?: string | null } = {}) {
    const hasPending = Object.prototype.hasOwnProperty.call(patch, 'pendingRequest');
    const hasError = Object.prototype.hasOwnProperty.call(patch, 'error');
    this.db.prepare('UPDATE tasks SET state=?,current_turn=COALESCE(?,current_turn),pending_request_json=CASE WHEN ? THEN ? ELSE pending_request_json END,error=CASE WHEN ? THEN ? ELSE error END,updated_at=? WHERE id=?').run(
      state, patch.currentTurn ?? null, hasPending ? 1 : 0, hasPending && patch.pendingRequest ? JSON.stringify(patch.pendingRequest) : null,
      hasError ? 1 : 0, hasError ? patch.error ?? null : null, Date.now(), id,
    );
  }

  beginToolExecution(input: { id: string; taskId: string; callId: string; name: string; arguments: unknown; status?: string; startedAt: number }) {
    const inserted = this.db.prepare('INSERT OR IGNORE INTO tool_executions(id,task_id,call_id,name,arguments_json,status,result_json,started_at,finished_at) VALUES(?,?,?,?,?,?,?,?,NULL)')
      .run(input.id, input.taskId, input.callId, input.name, JSON.stringify(input.arguments), input.status || 'running', null, input.startedAt);
    return Number(inserted.changes) === 1;
  }

  finishToolExecution(taskId: string, callId: string, status: string, result: unknown, finishedAt = Date.now()) {
    this.db.prepare('UPDATE tool_executions SET status=?,result_json=?,finished_at=? WHERE task_id=? AND call_id=? AND status=\'running\'')
      .run(status, JSON.stringify(result), finishedAt, taskId, callId);
  }

  getToolExecution(taskId: string, callId: string): any | undefined {
    const row = this.db.prepare('SELECT id,task_id,call_id,name,arguments_json,status,result_json,started_at,finished_at FROM tool_executions WHERE task_id=? AND call_id=?').get(taskId, callId) as any;
    return row ? { id: row.id, taskId: row.task_id, callId: row.call_id, name: row.name, arguments: JSON.parse(row.arguments_json), status: row.status, result: row.result_json ? JSON.parse(row.result_json) : undefined, startedAt: row.started_at, finishedAt: row.finished_at ?? undefined } : undefined;
  }

  addEvent(input: { id: string; taskId: string; conversationId: string; type: string; payload: unknown }) {
    const sequence = Number((this.db.prepare('SELECT COALESCE(MAX(sequence),-1)+1 AS n FROM task_events WHERE task_id=?').get(input.taskId) as any).n);
    const createdAt = Date.now();
    this.db.prepare('INSERT INTO task_events(id,task_id,conversation_id,sequence,type,payload_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(input.id, input.taskId, input.conversationId, sequence, input.type, JSON.stringify(input.payload), createdAt);
    return { ...input, sequence, createdAt };
  }

  addDiagnostic(input: { taskId?: string; category: string; message: string; details?: unknown }) {
    this.db.prepare('INSERT INTO diagnostics(id,task_id,category,message,details_json,created_at) VALUES(?,?,?,?,?,?)')
      .run(crypto.randomUUID(), input.taskId || null, input.category, input.message, JSON.stringify(input.details || {}), Date.now());
  }

  getMetadata(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key) as any;
    return row?.value;
  }

  setMetadata(key: string, value: string): void {
    this.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  }

  getTask(id: string): any {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id) as any;
    if (!row) return undefined;
    return { id:row.id,conversationId:row.conversation_id,clientRequestId:row.client_request_id,objective:row.objective,model:row.model,workspace:row.workspace,state:row.state,currentTurn:row.current_turn,pendingRequest:row.pending_request_json?JSON.parse(row.pending_request_json):undefined,error:row.error,createdAt:row.created_at,updatedAt:row.updated_at };
  }

  getTaskForRequest(clientRequestId: string): any {
    const row = this.db.prepare('SELECT id FROM tasks WHERE client_request_id=?').get(clientRequestId) as any;
    return row ? this.getTask(row.id) : undefined;
  }

  getActiveTasks(): any[] {
    return (this.db.prepare("SELECT id FROM tasks WHERE state IN ('queued','running','waiting_retry','paused') ORDER BY created_at").all() as any[]).map(row => this.getTask(row.id));
  }

  close() { this.db.close(); }
}
