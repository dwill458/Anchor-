import {
  NODE_TONE_SAMPLE_RATE,
  bytesToBase64,
  encodeWav,
  nodeFrequency,
  nodeSemitones,
  synthNodeTone,
} from '@/utils/audio/nodeTone';

describe('generative Mapping tone', () => {
  it('starts the ladder at A4 and follows the pentatonic steps', () => {
    expect(nodeFrequency(1)).toBeCloseTo(440, 6);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(nodeSemitones)).toEqual([0, 2, 4, 7, 9, 12, 14, 16, 19, 21]);
    expect(nodeFrequency(6)).toBeCloseTo(880, 6);
  });

  it('folds a 7x7 square into two octaves so no cell is shrill', () => {
    for (let cell = 1; cell <= 49; cell += 1) expect(nodeFrequency(cell)).toBeLessThan(1600);
    expect(nodeFrequency(11)).toBeCloseTo(nodeFrequency(1), 6);
  });

  it('is a quiet droplet: fast attack, decaying, ends at silence, peak-normalised', () => {
    const samples = synthNodeTone(440);
    const at = (seconds: number) => Math.abs(samples[Math.round(seconds * NODE_TONE_SAMPLE_RATE)]);
    const peak = Math.max(...Array.from(samples, Math.abs));
    expect(peak).toBeCloseTo(0.8, 2);
    const window = (from: number, to: number) =>
      Math.max(...Array.from(samples.slice(Math.round(from * NODE_TONE_SAMPLE_RATE), Math.round(to * NODE_TONE_SAMPLE_RATE)), Math.abs));
    expect(window(0, 0.02)).toBeGreaterThan(window(0.2, 0.22));
    expect(at(0)).toBeLessThan(0.05);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.01);
  });

  it('encodes a valid mono 16-bit WAV', () => {
    const samples = synthNodeTone(523.25);
    const wav = encodeWav(samples);
    const text = (from: number, to: number) => String.fromCharCode(...wav.slice(from, to));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(wav.length).toBe(44 + samples.length * 2);
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(NODE_TONE_SAMPLE_RATE);
  });

  it('base64-encodes bytes like the standard alphabet', () => {
    expect(bytesToBase64(new TextEncoder().encode('Man'))).toBe('TWFu');
    expect(bytesToBase64(new TextEncoder().encode('Ma'))).toBe('TWE=');
    expect(bytesToBase64(new TextEncoder().encode('M'))).toBe('TQ==');
  });
});
