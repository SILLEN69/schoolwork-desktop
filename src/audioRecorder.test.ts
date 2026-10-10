import { describe, it, expect } from 'vitest';
import { encodeWav, audioBase64 } from './audioRecorder';
import { nextDate, validDate } from './lesson';
describe('audio segments', () => {
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
