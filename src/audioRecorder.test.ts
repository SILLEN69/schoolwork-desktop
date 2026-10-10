import { describe, it, expect } from 'vitest';
import { encodeWav, audioBase64, PcmSegments } from './audioRecorder';
import { nextDate, validDate } from './lesson';
describe('audio segments', () => {
  it('does not duplicate audio when backpressure stops during an emission',()=>{
    let calls=0;const s=new PcmSegments(100,()=>{calls++;s.flush();});s.push(new Float32Array(3000).fill(.1));expect(calls).toBe(1);
  });
  it('keeps two seconds of boundary context without losing samples or shifting time',()=>{
    const chunks:{samples:Float32Array;start:number;duration:number}[]=[];
    const segments=new PcmSegments(100,(samples,start,duration)=>chunks.push({samples,start,duration}),10);
    segments.push(new Float32Array(3000).fill(.1));segments.push(new Float32Array(1000).fill(.2));segments.flush();segments.flush();
    expect(chunks.map(c=>c.start)).toEqual([10,38]);expect(chunks.map(c=>c.duration)).toEqual([30,12]);
    expect(chunks[1].samples.slice(0,200)).toEqual(chunks[0].samples.slice(-200));expect(chunks[1].start+chunks[1].duration).toBe(50);
  });
  it('prefers a pause after twenty seconds',()=>{
    const chunks:number[]=[];const s=new PcmSegments(100,(_a,_s,d)=>chunks.push(d));s.push(new Float32Array(2000).fill(.1));expect(chunks).toEqual([]);s.push(new Float32Array(40));expect(chunks).toEqual([20.4]);
  });
  it('creates a complete, independently decodable 16 kHz mono WAV', () => {
    const samples = new Float32Array(48000); for (let i=0;i<samples.length;i++) samples[i] = Math.sin(2*Math.PI*440*i/48000)*.5;
    const bytes=encodeWav(samples,48000), v=new DataView(bytes);
    expect(new TextDecoder().decode(bytes.slice(0,4))).toBe('RIFF'); expect(new TextDecoder().decode(bytes.slice(8,12))).toBe('WAVE');
    expect(v.getUint32(4,true)).toBe(bytes.byteLength-8); expect(v.getUint32(24,true)).toBe(16000); expect(v.getUint16(22,true)).toBe(1); expect(v.getUint16(34,true)).toBe(16);
    expect(v.getUint32(40,true)).toBe(32000); expect(v.getInt16(44+20*2,true)).not.toBe(0);
    expect(Buffer.from(audioBase64(bytes),'base64')).toEqual(Buffer.from(bytes));
  });
  it('clips samples safely and handles the final short segment', () => {
    const b=encodeWav(new Float32Array([2,-2,0,.25]),16000), v=new DataView(b);
    expect(v.getInt16(44,true)).toBe(32767); expect(v.getInt16(46,true)).toBe(-32768); expect(v.getUint32(40,true)).toBe(8);
  });
});
describe('assignment dates', () => {
  it('rejects impossible dates and calculates exclusive all-day ends', () => {
    expect(validDate('2026-02-30')).toBe(false); expect(validDate('2028-02-29')).toBe(true);
    expect(nextDate('2026-12-31')).toBe('2027-01-01'); expect(nextDate('2028-02-29')).toBe('2028-03-01');
    expect(()=>nextDate('2026-02-30')).toThrow();
  });
});
