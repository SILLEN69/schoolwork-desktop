// Synthesizes public/startup-chime.wav — a short startup chime synced to the
// SchoolWorkStartup composition (30 fps, 96 frames = 3.2 s).
// Timeline: whoosh 0.05–0.55s, logo impact + chime 0.55s, tagline tick 1.05s.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const DURATION = 3.2;
const N = Math.floor(SR * DURATION);
const out = new Float64Array(N);

const add = (t0, fn, dur) => {
  const a = Math.floor(t0 * SR);
  const b = Math.min(N, a + Math.floor(dur * SR));
  for (let i = a; i < b; i++) out[i] += fn((i - a) / SR, (i - a) / SR);
};

// --- Whoosh: filtered noise sweep (logo energy building) ---
{
  let lp = 0;
  const t0 = 0.05;
  const dur = 0.5;
  const a = Math.floor(t0 * SR);
  const b = Math.min(N, a + Math.floor(dur * SR));
  for (let i = a; i < b; i++) {
    const t = (i - a) / SR;
    const p = t / dur;
    const white = Math.random() * 2 - 1;
    const cutoff = 0.08 + 0.5 * p; // rising lowpass
    lp += cutoff * (white - lp);
    const env = Math.sin(Math.PI * Math.min(1, p)) ** 1.5;
    out[i] += lp * env * 1.4; // lowpass sweep: dark -> bright
  }
}

// --- Impact thump at 0.55s (logo lands) ---
add(0.55, (t) => Math.sin(2 * Math.PI * 82 * t) * Math.exp(-t / 0.12) * 0.3, 0.5);

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
console.log(`wrote ${file} (${buf.length} bytes, ${DURATION}s @ ${SR}Hz)`);
