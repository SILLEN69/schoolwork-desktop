import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { GoogleCalendar,googleApiError } from './calendar';
import type { Metadata } from './lessons';
let db:Metadata, values:Map<string,string>, calendar:GoogleCalendar, opened:string, fetcher:ReturnType<typeof vi.fn>;
const client={clientId:'123-test.apps.googleusercontent.com',clientSecret:'test-client-secret',calendarId:'primary'};
const encrypt=(text:string)=>Buffer.from(text).toString('base64'),decrypt=(text:string)=>Buffer.from(text,'base64').toString();
it('distinguishes disabled API, missing scope, quotas and school administrator restrictions',async()=>{
 const response=(reason:string)=>Response.json({error:{errors:[{reason}]}},{status:403});
 expect(await googleApiError(response('accessNotConfigured'))).toContain('disabled');expect(await googleApiError(response('insufficientPermissions'))).toContain('Reconnect');
 expect(await googleApiError(response('quotaExceeded'))).toContain('rate limit');expect(await googleApiError(response('forbidden'))).toContain('school');
});
beforeEach(()=>{ values=new Map();db={getMetadata:k=>values.get(k),setMetadata:(k,v)=>{values.set(k,v);}};opened='';
  fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>{
    if(String(url).endsWith('/token')) { const form=init?.body as URLSearchParams;expect(form.get('client_secret')).toBe(client.clientSecret);return Response.json({access_token:'test-access',expires_in:3600,refresh_token:form.get('grant_type')==='authorization_code'?'test-refresh':undefined,scope:'https://www.googleapis.com/auth/calendar.events'}); }
    if(String(url).endsWith('/revoke')) return new Response('');
    if(!init?.body)return Response.json({items:[]});
    const event=JSON.parse(String(init?.body));return Response.json({id:event.id,htmlLink:'https://calendar.google.com/calendar/event?eid=test'});
  });
  calendar=new GoogleCalendar(db,encrypt,decrypt,async(url)=>{opened=url;},fetcher as typeof fetch);
});
afterEach(()=>{calendar.stop();vi.useRealTimers();});
async function connect() { calendar.configure(client);await calendar.connect();const url=new URL(opened),redirect=new URL(url.searchParams.get('redirect_uri')!);redirect.searchParams.set('state',url.searchParams.get('state')!);redirect.searchParams.set('code','test-code');const result=await fetch(redirect);expect(result.status).toBe(200); }
it('requires a desktop client, uses loopback and PKCE, and rejects mismatched state',async()=>{
  await expect(calendar.connect()).rejects.toThrow(/Desktop app client/);calendar.configure(client);expect(values.get('google:client-secret')).not.toBe(client.clientSecret);
  await calendar.connect();const url=new URL(opened);expect(url.hostname).toBe('accounts.google.com');expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.events');expect(url.searchParams.get('client_secret')).toBeNull();
  const callback=new URL(url.searchParams.get('redirect_uri')!);expect(callback.hostname).toBe('127.0.0.1');callback.searchParams.set('state','invalid');callback.searchParams.set('code','bad');expect((await fetch(callback)).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();expect(calendar.status().connected).toBe(false);
  callback.searchParams.set('state',url.searchParams.get('state')!);callback.searchParams.set('code','good');expect((await fetch(callback)).status).toBe(200);expect(calendar.status().connected).toBe(true);expect(values.get('google:refresh')).not.toBe('test-refresh');expect(JSON.stringify(calendar.status())).not.toContain('test-access');
  const form=fetcher.mock.calls[0][1].body as URLSearchParams;expect(cryptoHash(form.get('code_verifier')!)).toBe(url.searchParams.get('code_challenge'));
});
import crypto from 'node:crypto';
function cryptoHash(text:string){return crypto.createHash('sha256').update(text).digest('base64url');}
it('creates reviewed all-day events and uses stable IDs to recover conflicts',async()=>{
  await connect();const input={sessionId:'session',taskId:'task',title:'Rapport',date:'2026-10-16',details:'Inlämning'};
  const result=await calendar.add(input);expect(result.id).toMatch(/^[0-9a-v]{5,1024}$/);const request=fetcher.mock.calls.find(c=>String(c[0]).includes('/calendar/v3/'));const event=JSON.parse(request![1].body);expect(event.start).toEqual({date:'2026-10-16'});expect(event.end).toEqual({date:'2026-10-17'});expect(event.summary).toBe('Rapport');
  fetcher.mockImplementation(async(url,init)=>{if(init?.method==='POST')return new Response('',{status:409});expect(String(url)).toContain('/events/'+result.id);return Response.json(result);});
  expect((await calendar.add(input)).id).toBe(result.id);
});
it('refreshes tokens after service restart and handles expired grants without hiding failure',async()=>{
  await connect();calendar.stop();calendar=new GoogleCalendar(db,encrypt,decrypt,async()=>{},fetcher as typeof fetch);
  await calendar.add({sessionId:'s',taskId:'t',title:'Test',date:'2026-10-16',details:'Test'});expect(fetcher.mock.calls.some(c=>(c[1]?.body as URLSearchParams)?.get?.('grant_type')==='refresh_token')).toBe(true);
  calendar.stop();calendar=new GoogleCalendar(db,encrypt,decrypt,async()=>{},vi.fn().mockResolvedValue(new Response('',{status:400})));
  await expect(calendar.add({sessionId:'s',taskId:'t2',title:'Test',date:'2026-10-16',details:'Test'})).rejects.toThrow(/Reconnect/);expect(calendar.status().connected).toBe(false);
});
it('rejects impossible dates before contacting Google and disconnects locally',async()=>{
  await connect();const calls=fetcher.mock.calls.length;await expect(calendar.add({sessionId:'s',taskId:'t',title:'Test',date:'2026-02-30',details:''})).rejects.toThrow(/valid/);expect(fetcher.mock.calls.length).toBe(calls);
  await calendar.disconnect();expect(calendar.status().connected).toBe(false);expect(values.get('google:refresh')).toBe('');expect(fetcher.mock.calls.at(-1)?.[0]).toContain('/revoke');
});
it('does not mark an account connected if Google refuses Calendar scope',async()=>{
  calendar.configure(client);fetcher.mockResolvedValue(Response.json({access_token:'test',refresh_token:'refresh',expires_in:3600,scope:'openid'}));await calendar.connect();const auth=new URL(opened),redirect=new URL(auth.searchParams.get('redirect_uri')!);redirect.searchParams.set('state',auth.searchParams.get('state')!);redirect.searchParams.set('code','test');expect((await fetch(redirect)).status).toBe(400);expect(calendar.status().connected).toBe(false);expect(calendar.status().error).toContain('permission');
});
it('uses the publisher desktop client with no per-user setup and isolates accounts by local storage',async()=>{
  calendar=new GoogleCalendar(db,encrypt,decrypt,async url=>{opened=url;},fetcher as typeof fetch,client);
  expect(calendar.status()).toMatchObject({configured:true,connected:false,configurationSource:'schoolwork'});
  expect(values.size).toBe(0); // Merely opening Settings never rewrites credentials.
  await calendar.connect();
  const auth=new URL(opened),callback=new URL(auth.searchParams.get('redirect_uri')!);
  expect(auth.searchParams.get('client_id')).toBe(client.clientId);
  expect(auth.searchParams.get('scope')).not.toContain('drive');
  callback.searchParams.set('state',auth.searchParams.get('state')!);callback.searchParams.set('code','synthetic-code');
  expect((await fetch(callback)).status).toBe(200);
  expect(calendar.status()).toMatchObject({connected:true,connecting:false,configurationSource:'schoolwork'});
  expect(JSON.stringify(calendar.status())).not.toMatch(/test-refresh|test-client-secret|test-access|clientId/);
  calendar.stop();
  calendar=new GoogleCalendar(db,encrypt,decrypt,async()=>{},fetcher as typeof fetch,client);
  expect(calendar.status().connected).toBe(true);
  await calendar.check(); // Refresh persisted user grant after restart.
  const otherValues=new Map<string,string>();
  const other=new GoogleCalendar({getMetadata:k=>otherValues.get(k),setMetadata:(k,v)=>{otherValues.set(k,v);}},encrypt,decrypt,async()=>{},fetcher as typeof fetch,client);
  expect(other.status()).toMatchObject({configured:true,connected:false});other.stop();
});
it('preserves existing custom clients and grants when a publisher client becomes available',async()=>{
  await connect();calendar.stop();const snapshot=new Map(values);
  calendar=new GoogleCalendar(db,encrypt,decrypt,async url=>{opened=url;},fetcher as typeof fetch,{...client,clientId:'456-publisher.apps.googleusercontent.com'});
  expect(values).toEqual(snapshot);expect(calendar.status()).toMatchObject({connected:true,configurationSource:'custom'});
  await calendar.connect();expect(new URL(opened).searchParams.get('client_id')).toBe(client.clientId);
});
it('cancels an in-flight exchange and rejects old callbacks without corrupting a new attempt',async()=>{
  calendar.configure(client);await calendar.connect();
  const auth=new URL(opened),callback=new URL(auth.searchParams.get('redirect_uri')!);callback.searchParams.set('state',auth.searchParams.get('state')!);callback.searchParams.set('code','old');
  let entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});let aborted=false;
  fetcher.mockImplementation((_url,init)=>new Promise((_resolve,reject)=>{entered();init!.signal!.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true});}));
  const pending=fetch(callback).catch(()=>undefined);await started;
  expect(calendar.cancelConnect()).toMatchObject({connecting:false,connected:false});await pending;expect(aborted).toBe(true);
  await calendar.connect();expect(calendar.status()).toMatchObject({connecting:true,error:undefined,connected:false});
  expect(()=>calendar.enableDrive(true)).toThrow(/Finish or cancel/);
  const nextAuth=new URL(opened),nextCallback=new URL(nextAuth.searchParams.get('redirect_uri')!);
  nextCallback.searchParams.set('state',auth.searchParams.get('state')!);nextCallback.searchParams.set('code','old');
  expect((await fetch(nextCallback)).status).toBe(400);expect(calendar.status().error).toBeUndefined();
});
