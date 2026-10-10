/** Independent WAV segments avoid MediaRecorder's non-decodable timeslice fragments. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const rate = 16000, length = Math.floor(samples.length * rate / sampleRate);
  const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
  const ascii = (at: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, length * 2, true);
  // Average source samples for downsampling; preserve the complete segment boundary.
  for (let i = 0; i < length; i++) {
    const from = Math.floor(i * sampleRate / rate), to = Math.min(samples.length, Math.max(from + 1, Math.floor((i + 1) * sampleRate / rate)));
    let sum = 0; for (let j = from; j < to; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (to - from))); view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
export function audioBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer); let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
/** Keep the microphone open. Prefer sentence pauses, with two seconds of context
 * shared between independently decodable chunks. Never await the network here. */
export class PcmSegments {
  private blocks:Float32Array[]=[]; private size=0; private fresh=0; private elapsed=0; private quiet=0;
  constructor(private rate:number,private emit:(samples:Float32Array,start:number,duration:number)=>void,private offset=0) {}
  push(data:Float32Array) {
    this.blocks.push(data.slice());this.size+=data.length;this.fresh+=data.length;
    let energy=0;for(const x of data)energy+=x*x;
    this.quiet=Math.sqrt(energy/data.length)<.008?this.quiet+data.length:0;
    if(this.fresh>=this.rate*20 && (this.quiet>=this.rate*.35 || this.fresh>=this.rate*30)) this.flush(false);
  }
  flush(final=true) {
    if(this.fresh<=this.rate*.1)return;
    const samples=new Float32Array(this.size);let at=0;
    for(const b of this.blocks){samples.set(b,at);at+=b.length;}
    const overlap=this.size-this.fresh;
    const start=this.offset+Math.max(0,this.elapsed-overlap/this.rate);
    this.elapsed+=this.fresh/this.rate;
    const tail=final?new Float32Array():samples.slice(-Math.min(samples.length,this.rate*2));
    this.blocks=tail.length?[tail]:[];this.size=tail.length;this.fresh=0;this.quiet=0;
    // A backpressure callback may stop the recorder and flush re-entrantly.
    // Commit the boundary first so that it cannot emit the same audio twice.
    this.emit(samples,start,samples.length/this.rate);
  }
}
export class LessonRecorder {
  private stream?: MediaStream; private context?: AudioContext; private source?: MediaStreamAudioSourceNode; private node?: ScriptProcessorNode;
  private segments?:PcmSegments; private stopping = false;
  constructor(private emit: (data: { buffer: ArrayBuffer; start: number; duration: number }) => void, private level: (value: number) => void,
    private ended: () => void, private offset = 0) {}
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      if (this.stopping) { this.stream.getTracks().forEach(t => t.stop()); return; }
      this.context = new AudioContext(); await this.context.resume();
      this.segments=new PcmSegments(this.context.sampleRate,(samples,start,duration)=>this.emit({buffer:encodeWav(samples,this.context!.sampleRate),start,duration}),this.offset);
      this.source = this.context.createMediaStreamSource(this.stream);
      this.node = this.context.createScriptProcessor(4096, 1, 1);
      this.node.onaudioprocess = event => {
        if (this.stopping) return;
        const data = new Float32Array(event.inputBuffer.getChannelData(0)); this.segments!.push(data);
        let sum = 0; for (const sample of data) sum += sample * sample; this.level(Math.min(1, Math.sqrt(sum / data.length) * 8));
      };
      this.source.connect(this.node); this.node.connect(this.context.destination);
      this.stream.getAudioTracks().forEach(t => { t.onended = () => { this.stop(); this.ended(); }; });
    } catch (error) { this.stop(); throw error; }
  }
  stop() { if (this.stopping) return; this.stopping = true; this.segments?.flush();
    if (this.node) { this.node.onaudioprocess = null; this.node.disconnect(); } this.source?.disconnect();
    this.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); }); void this.context?.close(); this.level(0);
  }
}
