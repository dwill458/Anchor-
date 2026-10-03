/**
 * The generative Mapping tone (Sound Kit v1): one soft droplet per traced grid node, its pitch set
 * by the cell it lands in, so every square plays its own small melody.
 *
 * React Native has no Web Audio, so the tone is synthesised here as a 16-bit mono WAV (pure maths,
 * testable) and played from a cache file by `NodeToneService`.
 *
 * Recipe (from the kit notes): sine + soft 2nd harmonic, one-pole low-pass at ~2200 Hz, 5 ms
 * attack, exponential decay (~350 ms), no sustain.
 */

export const NODE_TONE_SAMPLE_RATE = 22050;
export const NODE_TONE_SECONDS = 0.4;
export const NODE_TONE_LOWPASS_HZ = 2200;
const ATTACK_SECONDS = 0.005;
/** Time constant of the decay: ~-38 dB at 350 ms, then a short fade so the tail never clicks. */
const DECAY_TAU_SECONDS = 0.08;
const TAIL_FADE_SECONDS = 0.03;
const SECOND_HARMONIC_GAIN = 0.28;
const PEAK = 0.8;

/** A4 and the pentatonic ladder from the kit notes: 0, 2, 4, 7, 9, then the same up an octave. */
const BASE_HZ = 440;
const PENTATONIC = [0, 2, 4, 7, 9] as const;
/**
 * The kit's ladder runs on indefinitely, but a 7x7 square has 49 cells: the ladder is folded into
 * two octaves (10 notes), so the highest tone stays under ~1.5 kHz and sits inside the low-pass.
 */
const LADDER_NOTES = 10;

/** Semitones above A4 for a 1-based grid cell number. */
export function nodeSemitones(cell: number): number {
  const index = (((Math.round(cell) - 1) % LADDER_NOTES) + LADDER_NOTES) % LADDER_NOTES;
  return PENTATONIC[index % PENTATONIC.length] + 12 * Math.floor(index / PENTATONIC.length);
}

/** `freq = 440 * 2^(steps/12)` for a grid cell. */
export function nodeFrequency(cell: number): number {
  return BASE_HZ * Math.pow(2, nodeSemitones(cell) / 12);
}

/** The droplet as normalised samples in [-1, 1]. */
export function synthNodeTone(frequency: number): Float32Array {
  const rate = NODE_TONE_SAMPLE_RATE;
  const length = Math.round(NODE_TONE_SECONDS * rate);
  const out = new Float32Array(length);
  const alpha = 1 - Math.exp((-2 * Math.PI * NODE_TONE_LOWPASS_HZ) / rate);

  let filtered = 0;
  let peak = 0;
  for (let n = 0; n < length; n += 1) {
    const t = n / rate;
    const attack = t < ATTACK_SECONDS ? t / ATTACK_SECONDS : 1;
    const decay = Math.exp(-t / DECAY_TAU_SECONDS);
    const tail = Math.min(1, (NODE_TONE_SECONDS - t) / TAIL_FADE_SECONDS);
    const raw =
      Math.sin(2 * Math.PI * frequency * t) +
      SECOND_HARMONIC_GAIN * Math.sin(2 * Math.PI * frequency * 2 * t);
    filtered += alpha * (raw - filtered);
    const sample = filtered * attack * decay * tail;
    out[n] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak > 0) {
    const gain = PEAK / peak;
    for (let n = 0; n < length; n += 1) out[n] *= gain;
  }
  return out;
}

/** RIFF/WAVE bytes (16-bit PCM, mono) for the samples. */
export function encodeWav(samples: Float32Array, sampleRate: number = NODE_TONE_SAMPLE_RATE): Uint8Array {
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return bytes;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 of raw bytes (React Native has no global `btoa`/`Buffer` we can rely on). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += BASE64[a >> 2] + BASE64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? BASE64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? BASE64[c & 63] : '=';
  }
  return out;
}

/** The distinct pitches a grid uses, as cell -> ladder note, so a tone is built once per note. */
export function nodeToneKey(cell: number): number {
  return nodeSemitones(cell);
}
