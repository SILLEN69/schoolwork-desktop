import { it, expect } from 'vitest';
import { normalizeReceiverUrl, parseReceiverPage, projectorCode, readOnlyViewUrl, viewId, displayedProjectorCode } from './yeetcast';

it('normalizes projector page URLs', () => {
  expect(normalizeReceiverUrl('https://yeet.ssis.nu/receiver/12')).toBe('https://yeet.ssis.nu/receiver/12');
  expect(normalizeReceiverUrl('  https://yeet.ssis.nu/receiver/12/  ')).toBe('https://yeet.ssis.nu/receiver/12');
  expect(() => normalizeReceiverUrl('')).toThrow(/six-digit/i);
  for (const value of ['not a url','ftp://yeet.ssis.nu/receiver/12','https://example.com/receiver/12','https://yeet.ssis.nu/receiver/abc123','https://yeet.ssis.nu/','https://user@yeet.ssis.nu/receiver/1']) expect(() => normalizeReceiverUrl(value)).toThrow();
});

it('preserves leading zeroes and accepts the spaced code shown on the projector', () => {
  expect(projectorCode(' 001 234 ')).toBe('001234');
  expect(projectorCode('001-234')).toBe('001234');
  for(const raw of ['12345','1234567','abc123','https://yeet.ssis.nu/receiver/1']) expect(projectorCode(raw)).toBeNull();
});

const v3Page = (data: Record<string, unknown>) => `<!doctype html><html><body>
<script type="text/json" data-wire:snapshot>${JSON.stringify({ snapshot: { data } })}</script>
</body></html>`;
it('recognizes a shared tab despite the receiver mount active=false default',()=>{
  expect(parseReceiverPage(v3Page({active:false,connections:true,receiverUri:'https://vdo.ninja/?view=teacher',
    senders:[[{name:'Teacher',sending:true}],{s:'clctn'}]}))).toMatchObject({active:true,connections:true});
  expect(parseReceiverPage(v3Page({active:false,connections:true,receiverUri:'https://vdo.ninja/?view=teacher',
    senders:[{name:'Teacher',sending:false}]}))).toMatchObject({active:false});
});
it('reads only a visible formatted receiver code, not arbitrary digits or hidden Livewire data',()=>{
  expect(displayedProjectorCode('<span class="text-6xl font-bold tabular-nums block m-6">001 234</span>')).toBe('001234');
  expect(displayedProjectorCode('<script>{"code":"001234"}</script><p>001 234</p>')).toBeNull();
});
it('reads real Livewire 4 Eloquent references without inventing sender fields or active state',()=>{
  const data={active:false,connections:true,receiverUri:'https://vdo.ninja/?view=teacher',
    senders:[null,{s:'elcln',class:'Illuminate\\Database\\Eloquent\\Collection',modelClass:'App\\Models\\Sender',keys:[42]}]};
  const html=`<div wire:snapshot='${JSON.stringify({memo:{name:'ReceiverScreen'},data})}'>`;
  expect(parseReceiverPage(html)).toMatchObject({active:false,connections:true,receiverUri:'https://vdo.ninja/?view=teacher',senderCount:1,senders:[]});
  expect(parseReceiverPage(`<div wire:snapshot='${JSON.stringify({memo:{name:'ReceiverScreen'},data:{active:false,connections:false,senders:[null,{s:'elcln',keys:[]}]}})}'>`)).toMatchObject({active:false,connections:false,senderCount:0});
});

it('reads the live cast state from a Livewire v3 receiver page', () => {
  const state = parseReceiverPage(v3Page({
    receiverUri: 'https://vdo.ninja/?cleanoutput&view=0a1b2c,3d4e5f',
    active: true,
    connections: true,
    senders: [{ name: 'Lars', uuid: 'x', sending: true }, { name: 'Elin', uuid: 'y', sending: false }],
  }));
  expect(state).not.toBeNull();
  expect(state!.receiverUri).toBe('https://vdo.ninja/?cleanoutput&view=0a1b2c,3d4e5f');
  expect(state!.active).toBe(true);
  expect(state!.connections).toBe(true);
  expect(state!.senders).toEqual([{ name: 'Lars', sending: true }, { name: 'Elin', sending: false }]);
});

it('treats a page without a receiver URI as not a receiver page', () => {
  expect(parseReceiverPage(v3Page({ title: 'hello' }))).toBeNull();
  expect(parseReceiverPage('<html><body>Just a normal page.</body></html>')).toBeNull();
});

it('falls back to a vdo.ninja view URL rendered in the markup', () => {
  const html = '<html><body><iframe src="https://vdo.ninja/?cleanoutput&amp;view=0a1b2c"></iframe></body></html>';
  const state = parseReceiverPage(html);
  expect(state).not.toBeNull();
  expect(state!.active).toBe(true);
  expect(state!.receiverUri).toContain('view=0a1b2c');
});

it('extracts the viewed sender ids from a view URL', () => {
  expect(viewId('https://vdo.ninja/?cleanoutput&view=0a1b2c,3d4e5f&vb=12000')).toBe('0a1b2c,3d4e5f');
  expect(viewId('https://vdo.ninja/?cleanoutput')).toBe('');
});

it('reads actual HTML-escaped Livewire collection data and recognizes an idle receiver', () => {
  const snapshot = JSON.stringify({memo:{name:'receiver-screen'},data:{receiverUri:'https://vdo.ninja/?view=abc123',active:true,connections:true,senders:[[{name:'Teacher',sending:true},{name:'Student',sending:false}],{s:'clctn'}]}}).replaceAll('"','&quot;');
  expect(parseReceiverPage(`<div wire:snapshot="${snapshot}">`)).toMatchObject({active:true,senders:[{name:'Teacher',sending:true},{name:'Student',sending:false}]});
  expect(parseReceiverPage(v3Page({}))).toBeNull();
  expect(parseReceiverPage(`<div wire:snapshot='${JSON.stringify({memo:{name:'receiver-screen'},data:{active:false,connections:false,senders:[[],{s:'clctn'}]}})}'>`)).toEqual({receiverUri:'',active:false,connections:false,senders:[]});
});

it('rejects push streams and unsafe remote page content', () => {
  for(const url of ['javascript:alert(1)','file:///test','http://vdo.ninja/?view=abc','https://vdo.ninja/?push=abc&view=abc','https://vdo.ninja/?view=abc&room=test']) expect(readOnlyViewUrl(url)).toBe('');
  expect(parseReceiverPage(v3Page({receiverUri:'https://vdo.ninja/?push=abc',active:true}))).toBeNull();
});
