// Produces public/startup-chime.wav — a layered mixdown for SchoolWorkStartup
// (30 fps, 96 frames = 3.2 s).
//
// Layers (all timed to the composition):
//   0.10s  pre-swish   (real SFX, sfx-candidates/mix_1485.wav)  subtle
//   -0.53s whoosh      (real SFX, sfx-candidates/mix_1492.wav)  peak lands at 0.55s
//   0.52s  impact hit  (real SFX, sfx-candidates/mix_3005.wav)  peak at 0.55s
//   0.55s  low thump   (synth 82 Hz)
//   0.55s  chime       (synth E5 + B5 + E6, E-major)
//   1.05s  tagline tick (synth 2093 Hz)
//
// Real SFX sources: Pixabay Sound Effects (free license, no attribution
// required): whoosh #1492, swish #1485, hit #3005.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const DURATION = 3.2;
const N = Math.floor(SR * DURATION);
const out = new Float64Array(N);

const add = (t0, fn, dur) => {
  const a = Math.floor(t0 * SR);
  const b = Math.min(N, a + Math.floor(dur * SR));
  for (let i = Math.max(0, a); i < b; i++) {
    const t = (i - a) / SR;
    out[i] += fn(t);
  }
};

// --- Load a 16-bit mono WAV into a Float64Array ---
const loadWav = (file) => {
  const buf = readFileSync(file);
  let offset = 12;
  let dataStart = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") {
      dataStart = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0) throw new Error(`no data chunk in ${file}`);
  const n = Math.floor(dataLen / 2);
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = buf.readInt16LE(dataStart + i * 2) / 32768;
  return s;
};

const sfxDir = join(dirname(fileURLToPath(import.meta.url)), "..", "sfx-candidates");
const whoosh = loadWav(join(sfxDir, "mix_1492.wav")); // 1.33s, peak @ 1.08s
const swish = loadWav(join(sfxDir, "mix_1485.wav")); // 0.48s, peak @ 0.09s
const hit = loadWav(join(sfxDir, "mix_3005.wav")); // 0.18s, peak @ 0.03s

// --- Place a sample buffer at time t0 with gain and a short fade-in ---
const place = (samples, t0, gain, fadeIn = 0.02) => {
  const a = Math.floor(t0 * SR);
  const fi = Math.floor(fadeIn * SR);
  for (let i = 0; i < samples.length; i++) {
    const idx = a + i;
    if (idx < 0 || idx >= N) continue;
    let g = gain;
    if (i < fi) g *= i / fi;
    out[idx] += samples[i] * g;
  }
};

// --- Whoosh: peak (at 1.08s into the file) lands on the impact at 0.55s ---
place(whoosh, 0.55 - 1.08, 0.55, 0.05);

// --- Pre-swish: subtle energy before the draw-on ---
place(swish, 0.1, 0.22, 0.03);

// --- Impact hit: peak (0.03s into file) at 0.55s ---
place(hit, 0.55 - 0.03, 1.0, 0.005);

// --- Low thump at 0.55s (logo lands) ---
add(0.55, (t) => Math.sin(2 * Math.PI * 82 * t) * Math.exp(-t / 0.12) * 0.22, 0.5);

// --- Chime: E5 + B5 + E6 with harmonics, at 0.55s ---
const chime = (freq, t0, gain, tau) =>
  add(t0, (t) => {
    let s = 0;
    const partials = [
      [1, 1],
      [2, 0.35],
      [3, 0.12],
    ];
    for (const [mult, amp] of partials) {
      s += Math.sin(2 * Math.PI * freq * mult * t) * amp;
    }
    return s * Math.exp(-t / tau) * gain;
  }, 2.4);

chime(659.255, 0.55, 0.34, 0.55); // E5
chime(987.767, 0.55, 0.22, 0.45); // B5
chime(1318.51, 0.55, 0.14, 0.4); // E6

// --- Tagline tick at 1.05s ---
add(1.05, (t) => Math.sin(2 * Math.PI * 2093 * t) * Math.exp(-t / 0.045) * 0.16, 0.3);

// --- Normalize + final fade ---
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
const fadeStart = Math.floor(SR * (DURATION - 0.18));
for (let i = 0; i < N; i++) {
  let s = (out[i] / peak) * 0.85;
  if (i > fadeStart) s *= (N - i) / (N - fadeStart);
  out[i] = s;
}

// --- Write 16-bit mono WAV ---
const buf = Buffer.alloc(44 + N * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 2, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(dir, { recursive: true });
const file = join(dir, "startup-chime.wav");
writeFileSync(file, buf);
console.log(`wrote ${file} (${buf.length} bytes, ${DURATION}s @ ${SR}Hz, peak=${peak.toFixed(3)})`);
