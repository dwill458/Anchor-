// Synthesizes the Release burn sounds (deterministic; re-run to regenerate).
//   node scripts/generate-release-sounds.mjs
// Output: src/assets/sounds/sk-release-burn.wav (full ceremony) and sk-release-ignite.wav (Reduced Motion).
//
// Timeline of the burn file is locked to RELEASE_CEREMONY_TIMELINE_MS: t=0 is hold-complete, the file
// reaches exact digital silence at `emptyPause` (3050ms) when the coin is gone.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'sounds');

// Seeded PRNG so output is reproducible.
let seed = 0x5eed1234;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const seg = (t, a, b) => smooth((t - a) / (b - a));

/** Soft ignition: a low thump plus a short, low-passed breath of air. Warm, no hiss. */
function addIgnition(buf, level) {
  let lp = 0;
  for (let i = 0; i < Math.floor(RATE * 0.55); i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.012) * Math.exp(-t * 9);
    const thump = Math.sin(2 * Math.PI * (46 + 40 * Math.exp(-t * 22)) * t) * Math.exp(-t * 14);
    lp += 0.07 * ((rand() * 2 - 1) - lp);
    buf[i] += level * (0.55 * thump + 0.9 * lp) * env * 1.4;
  }
}

/** Fire bed + crackle that rise to the end, then fall to nothing. */
function addFire(buf, endSec) {
  const n = Math.floor(RATE * endSec);
  let brown = 0;
  let lp = 0;
  const startSec = 0.3;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const rise = seg(t, startSec, 2.55);
    const fall = 1 - seg(t, 2.72, endSec - 0.01);
    const gain = rise * fall;
    brown = (brown + 0.02 * (rand() * 2 - 1)) / 1.02;
    lp += 0.1 * (brown * 6 - lp);
    buf[i] += lp * gain * 0.55;
  }
  // Crackle: sparse filtered clicks, rate and level rising with the flames.
  let t = startSec;
  while (t < endSec - 0.2) {
    const p = seg(t, startSec, 2.55);
    t += (-Math.log(1 - rand()) / (3 + 30 * p));
    if (t >= endSec - 0.2) break;
    const fall = 1 - seg(t, 2.72, endSec - 0.01);
    const amp = (0.04 + 0.26 * p) * (0.3 + rand() * 0.7) * fall;
    const decay = 380 + rand() * 900;
    const tone = 0.15 + rand() * 0.5;
    const start = Math.floor(t * RATE);
    let f = 0;
    for (let k = 0; k < Math.floor(RATE * 0.012); k++) {
      const e = Math.exp(-(k / RATE) * decay);
      f += tone * ((rand() * 2 - 1) - f);
      if (start + k < buf.length) buf[start + k] += amp * f * e * 3;
    }
  }
}

function finish(buf, silenceSec) {
  // Hard guarantee: exact silence from the coin-gone moment on, with a 20ms anti-click ramp before it.
  const sil = Math.floor(silenceSec * RATE);
  const ramp = Math.floor(0.02 * RATE);
  for (let i = 0; i < buf.length; i++) {
    if (i >= sil) buf[i] = 0;
    else if (i > sil - ramp) buf[i] *= (sil - i) / ramp;
  }
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const norm = peak > 0 ? 0.7 / peak : 1; // restrained: peak ≈ -3 dBFS
  const pcm = Buffer.alloc(44 + buf.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + buf.length * 2, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(RATE, 24); pcm.writeUInt32LE(RATE * 2, 28); pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(buf.length * 2, 40);
  for (let i = 0; i < buf.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * norm)) * 32767), 44 + i * 2);
  return pcm;
}

const EMPTY_PAUSE_SEC = 3.05;
const burn = new Float32Array(Math.floor(RATE * EMPTY_PAUSE_SEC));
addIgnition(burn, 1);
addFire(burn, EMPTY_PAUSE_SEC);
writeFileSync(join(OUT, 'sk-release-burn.wav'), finish(burn, EMPTY_PAUSE_SEC));

// Reduced Motion: ignition only, silent by 0.52s (the reduced "empty pause").
const ignite = new Float32Array(Math.floor(RATE * 0.52));
addIgnition(ignite, 1);
writeFileSync(join(OUT, 'sk-release-ignite.wav'), finish(ignite, 0.52));
console.log('wrote sk-release-burn.wav, sk-release-ignite.wav');
