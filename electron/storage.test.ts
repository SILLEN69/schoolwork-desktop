import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { SchoolWorkStore } from './storage';

function temporary() { return fs.mkdtempSync(path.join(os.tmpdir(), 'schoolwork-store-')); }

describe('durable conversation store', () => {
  it('queues guidance durably, deduplicates request IDs and rolls back bad attachments',()=>{
    const dir=temporary(),taskId=crypto.randomUUID(),conversationId=crypto.randomUUID(),requestId=crypto.randomUUID();let store=new SchoolWorkStore(dir);
    store.startTask({id:taskId,conversationId,clientRequestId:crypto.randomUUID(),objective:'Original task',model:'Qwen3.8-27B',workspace:dir});
    store.updateTask(taskId,'running',{});
    const input={taskId,conversationId,clientRequestId:requestId,text:'Use my new context',attachmentIds:[]};store.steerTask(input);store.steerTask(input);
    expect(store.pendingInputs(taskId)).toHaveLength(1);expect(store.getMessages(conversationId)).toHaveLength(2);
    expect(()=>store.steerTask({...input,conversationId:crypto.randomUUID(),clientRequestId:crypto.randomUUID()})).toThrow();
    expect(()=>store.steerTask({...input,clientRequestId:crypto.randomUUID(),attachmentIds:[crypto.randomUUID()]})).toThrow();expect(store.getMessages(conversationId)).toHaveLength(2);
    store.close();store=new SchoolWorkStore(dir);expect(store.pendingInputs(taskId)[0].content).toBe('Use my new context');store.appliedInput(store.pendingInputs(taskId)[0].id);expect(store.pendingInputs(taskId)).toEqual([]);
    store.close();fs.rmSync(dir,{recursive:true,force:true});
  });
  it('atomically persists routing and permission snapshots with tasks and rolls them back on failure', () => {
    const dir = temporary(); const store = new SchoolWorkStore(dir);
    const input = { id: crypto.randomUUID(), conversationId: crypto.randomUUID(), clientRequestId: crypto.randomUUID(), objective: 'phone task', model: 'vision', workspace: dir };
    const metadata = { ['telegram-task:' + input.id]: 'paired-session', ['capabilities:' + input.id]: '{"allApps":true}', 'telegram:conversation': JSON.stringify(input.conversationId) };
    store.startTask({ ...input, metadata });
    expect(store.getMetadata('telegram-task:' + input.id)).toBe('paired-session');
    expect(store.getMessages(input.conversationId)).toHaveLength(1);
    const failed = { ...input, id: crypto.randomUUID(), clientRequestId: crypto.randomUUID(), conversationId: crypto.randomUUID() };
    store.db.exec("CREATE TRIGGER test_route_failure BEFORE INSERT ON metadata WHEN NEW.key='fail-route' BEGIN SELECT RAISE(ABORT,'fixture storage failure'); END;");
    expect(() => store.startTask({ ...failed, metadata: { 'fail-route': 'x' } })).toThrow();
    expect(store.getTaskForRequest(failed.clientRequestId)).toBeUndefined();
    expect(store.getMessages(failed.conversationId)).toHaveLength(0);
    store.close(); fs.rmSync(dir, { recursive: true, force: true });
  });
  it('imports legacy messages exactly once without inventing native tool-call records', () => {
    const dir = temporary();
    const legacy = [{ id: 'a12f4f9d-514e-42da-b2c4-01ebf9ca7335', title: 'Old task', updatedAt: 1234, messages: [
      { role: 'user', content: 'Make a site', createdAt: 11 },
      { role: 'assistant', content: 'I will inspect files', createdAt: 12 },
      { role: 'tool', name: 'list_files', tool_call_id: 'old-call', content: '{"files":[]}', createdAt: 13 },
    ] }];
    fs.writeFileSync(path.join(dir, 'schoolwork-data.json'), JSON.stringify(legacy));
    let store = new SchoolWorkStore(dir);
    expect(store.getMessages(legacy[0].id).map(m => m.role)).toEqual(['user', 'assistant', 'legacy_observation']);
    expect(store.db.prepare('SELECT count(*) AS n FROM tool_executions').get()).toMatchObject({ n: 0 });
    store.close();
    store = new SchoolWorkStore(dir);
    expect(store.getMessages(legacy[0].id)).toHaveLength(3);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'schoolwork-data.json'), 'utf8'))).toEqual(legacy);
    store.close(); fs.rmSync(dir, { recursive: true, force: true });
  });

  it('retains request identity and pauses an interrupted task at startup', () => {
    const dir = temporary(); const conversationId = 'd95fcd92-93fd-46f5-8c47-c399e6ff7b43';
    const store = new SchoolWorkStore(dir);
    store.startTask({ id: '693f8ae3-56f3-48ee-91c6-8ec25db15e74', conversationId, clientRequestId: 'f6da04a0-3fa5-44e8-b2e6-e7a0fd7d49ad', objective: 'task', model: 'Qwen3.8-27B', workspace: dir });
    store.updateTask('693f8ae3-56f3-48ee-91c6-8ec25db15e74', 'running', { pendingRequest: { model: 'Qwen3.8-27B', messages: [] } });
    store.close();
    const recovered = new SchoolWorkStore(dir);
    expect(recovered.getTaskForRequest('f6da04a0-3fa5-44e8-b2e6-e7a0fd7d49ad').state).toBe('paused');
    expect(recovered.getMessages(conversationId)).toHaveLength(1);
    expect(recovered.db.prepare("SELECT count(*) AS n FROM task_events WHERE type='recovery_required'").get()).toMatchObject({ n: 1 });
    recovered.close(); fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists tool-call intent before effects and never replaces a completed call on retry', () => {
    const dir = temporary(); const store = new SchoolWorkStore(dir);
    store.startTask({ id: '693f8ae3-56f3-48ee-91c6-8ec25db15e74', conversationId: 'd95fcd92-93fd-46f5-8c47-c399e6ff7b43', clientRequestId: 'f6da04a0-3fa5-44e8-b2e6-e7a0fd7d49ad', objective: 'task', model: 'Qwen3.8-27B', workspace: dir });
    const operation = { id: 'tool-execution-1', taskId: '693f8ae3-56f3-48ee-91c6-8ec25db15e74', callId: 'call-1', name: 'write_file', arguments: { path: 'site.html' }, startedAt: Date.now() };
    expect(store.beginToolExecution(operation)).toBe(true);
    expect(store.getToolExecution(operation.taskId, operation.callId).status).toBe('running');
    store.finishToolExecution(operation.taskId, operation.callId, 'succeeded', { ok: true, summary: 'Written.' });
    expect(store.beginToolExecution({ ...operation, id: 'tool-execution-2', arguments: { path: 'different.html' } })).toBe(false);
    expect(store.getToolExecution(operation.taskId, operation.callId)).toMatchObject({ status: 'succeeded', arguments: { path: 'site.html' }, result: { ok: true, summary: 'Written.' } });
    store.close(); fs.rmSync(dir, { recursive: true, force: true });
  });
});
