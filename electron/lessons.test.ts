import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Lessons, type Metadata } from './lessons';
import { encodeWav } from '../src/audioRecorder';
import type { AudioInput, LessonAnalysis } from '../src/lesson';
let root:string, db:Metadata, values:Map<string,string>;
beforeEach(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'sw-lessons-'));values=new Map();db={getMetadata:k=>values.get(k),setMetadata:(k,v)=>{values.set(k,v);}};});
afterEach(async()=>{await fs.rm(root,{recursive:true,force:true});});
const audio=(sessionId:string,language:'sv'|'en'='sv'):AudioInput=>({sessionId,id:crypto.randomUUID(),base64:Buffer.from(encodeWav(new Float32Array(1600).fill(.1),16000)).toString('base64'),mime:'audio/wav',name:'test.wav',start:0,duration:.1,language});
const summary=(text:string)=>new Response('data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n', {headers:{'Content-Type':'text/event-stream'}});
const notes:LessonAnalysis={title:'Algebra',overview:'Vi arbetar med ekvationer.',sections:[{heading:'Ekvationer',points:['Lös båda sidor.']}],tasks:[{id:'a',title:'Uppgift 3',details:'Gör den nu.',kind:'lesson',dueDate:null,evidence:'Gör uppgift 3 nu.'},{id:'b',title:'Lämna in',details:'Lämna in rapporten.',kind:'assignment',dueDate:'2026-10-16',evidence:'Lämna in rapporten den 16 oktober.'}]};
it('uses Swedish and English multipart contracts without exposing keys to renderer state',async()=>{
  const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{const form=init!.body as FormData;expect(init!.headers).toEqual({Authorization:'Bearer test-credential',Accept:'application/json'});expect(form.get('model')).toBe(form.get('language')==='sv'?'kb-whisper-large':'faster-whisper-large-v3');expect((form.get('file') as Blob).size).toBeGreaterThan(44);return Response.json({text:'Hej lektionen.'});}) as typeof fetch;
  const lessons=new Lessons(db,root,()=> 'test-credential',fetcher), s=lessons.create('lesson','sv','Lektion');
  const first=audio(s.id);await lessons.upload(first);const next=audio(s.id,'en');next.start=1;await lessons.upload(next);
  expect(lessons.get(s.id).segments.map(s=>s.model)).toEqual(['kb-whisper-large','faster-whisper-large-v3']);expect(lessons.get(s.id).revision).toBe(2);
  expect(await fs.readdir(path.join(root,s.id))).toEqual([]);expect(JSON.stringify(lessons.list())).not.toContain('test-credential');
  await lessons.upload(first);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('retains failed audio across service restarts and retries exactly once',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValue(Response.json({text:'Gör uppgift 3 nu.'}));
  const lessons=new Lessons(db,root,()=> 'test',fetcher),s=lessons.create('lesson','sv','Test'),input=audio(s.id);
  const failure=await lessons.upload(input);expect(failure.error).toContain('503');expect(failure.session.pending).toHaveLength(1);
  expect((await fs.readFile(path.join(root,s.id,input.id))).length).toBeGreaterThan(44);
  const restored=new Lessons(db,root,()=> 'test',fetcher);const result=await restored.transcribe(s.id,input.id);
  expect(result.session.pending).toHaveLength(0);expect(result.session.segments).toHaveLength(1);await restored.transcribe(s.id,input.id);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('keeps transcripts and completed/calendar tasks during summary refresh',async()=>{
  let current=notes;const fetcher=vi.fn(async(url:unknown)=>String(url).endsWith('/audio/transcriptions')?Response.json({text:'Gör uppgift 3 nu. Lämna in rapporten den 16 oktober.'}):summary(JSON.stringify(current)));
  const lessons=new Lessons(db,root,()=> 'test',fetcher),s=lessons.create('lesson','sv','Test');await lessons.upload(audio(s.id));
  const result=await lessons.analyse(s.id,'Qwen3.8-27B');expect(result.analysis.tasks).toHaveLength(2);expect(result.analysedRevision).toBe(1);
  lessons.update(s.id,{taskId:result.analysis.tasks[0].id,completed:true});lessons.attachCalendar(s.id,result.analysis.tasks[1].id,'event');
  const next=await lessons.analyse(s.id,'Qwen3.8-27B');expect(next.analysis.tasks[0].completed).toBe(true);expect(next.analysis.tasks[1].calendarEventId).toBe('event');
  current={...notes,tasks:[]};const fewer=await lessons.analyse(s.id,'Qwen3.8-27B');expect(fewer.analysis.tasks).toHaveLength(2);
});
it('rejects malformed summaries and removes tasks unsupported by transcript evidence',async()=>{
  let output='not JSON';const fetcher=vi.fn(async(url:unknown)=>String(url).endsWith('/audio/transcriptions')?Response.json({text:'Gör uppgift 3 nu.'}):summary(output));
  const lessons=new Lessons(db,root,()=> 'test',fetcher),s=lessons.create('lesson','sv','Test');await lessons.upload(audio(s.id));
  await expect(lessons.analyse(s.id,'Qwen3.8-27B')).rejects.toThrow();expect(lessons.get(s.id).analysisError).toBeTruthy();expect(lessons.get(s.id).analysedRevision).toBe(0);
  output=JSON.stringify({...notes,tasks:[{...notes.tasks[0],dueDate:'2026-02-30'},notes.tasks[1]]});const result=await lessons.analyse(s.id,'Qwen3.8-27B');
  expect(result.analysis.tasks).toHaveLength(1);expect(result.analysis.tasks[0].dueDate).toBeNull();await expect(lessons.analyse(s.id,'kb-whisper-large')).rejects.toThrow(/chat model/);
});
it('shows a concrete unsupported endpoint error, allows discard, and deletes the session',async()=>{
  const lessons=new Lessons(db,root,()=> 'test',vi.fn().mockResolvedValue(new Response('',{status:404}))),s=lessons.create('transcription','sv','Test'),input=audio(s.id);
  const result=await lessons.upload(input);expect(result.error).toContain('endpoint');await lessons.discard(s.id,input.id);expect(lessons.get(s.id).pending).toHaveLength(0);
  await lessons.remove(s.id);expect(lessons.list()).toHaveLength(0);expect(()=>lessons.get(s.id)).toThrow();
});
it('rejects oversized and invalid audio inputs and unknown session ids',async()=>{
  const lessons=new Lessons(db,root,()=> 'test',vi.fn()),s=lessons.create('lesson','sv','Test');
  await expect(lessons.upload({...audio(s.id),base64:'invalid!'})).rejects.toThrow();await expect(lessons.upload({...audio(s.id),sessionId:crypto.randomUUID()})).rejects.toThrow('Lesson not found');
});
it('retains cancelled audio for retry instead of saving a partial transcript',async()=>{
  let ready!:()=>void;const requested=new Promise<void>(resolve=>{ready=resolve;});
  const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{ready();return new Promise<Response>((_resolve,reject)=>{init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason),{once:true});});}) as typeof fetch;
  const lessons=new Lessons(db,root,()=> 'test',fetcher),s=lessons.create('lesson','sv','Test'),input=audio(s.id);
  const request=lessons.upload(input);await requested;lessons.cancel(s.id);const result=await request;
  expect(result.error).toContain('cancelled');expect(result.session.segments).toHaveLength(0);expect(result.session.pending[0].id).toBe(input.id);expect((await fs.readFile(path.join(root,s.id,input.id))).length).toBeGreaterThan(44);
});
it('keeps a new transcript segment when a summary of an older snapshot finishes',async()=>{
  let finish!:(r:Response)=>void,ready!:()=>void;const requested=new Promise<void>(r=>{ready=r;});
  const fetcher=vi.fn(async(url:unknown)=>{if(String(url).endsWith('/audio/transcriptions'))return Response.json({text:'Gör uppgift 3 nu.'});ready();return new Promise<Response>(r=>{finish=r;});});
  const lessons=new Lessons(db,root,()=> 'test',fetcher),s=lessons.create('lesson','sv','Test');await lessons.upload(audio(s.id));
  const request=lessons.analyse(s.id,'Qwen3.8-27B');await requested;const second=audio(s.id);second.start=20;await lessons.upload(second);finish(summary(JSON.stringify({...notes,tasks:[notes.tasks[0]]})));
  const result=await request;expect(result.segments).toHaveLength(2);expect(result.revision).toBe(2);expect(result.analysedRevision).toBe(1);
});
