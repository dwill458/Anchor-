/** Easing and interpolation helpers, ported 1:1 from the prototype so timings read the same. */

export const TAU = Math.PI * 2;

// These are marked 'worklet' because the seal animation calls them from Reanimated styles on the
// UI thread; everywhere else they are ordinary functions.
export const clamp = (x: number, a = 0, b = 1): number => {
  'worklet';
  return Math.min(b, Math.max(a, x));
};
export const lerp = (a: number, b: number, t: number): number => {
  'worklet';
  return a + (b - a) * t;
};
export const ease = (t: number): number => {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t: number): number => {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
};

export const smooth = (a: number, b: number, x: number): number => {
  'worklet';
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Progress of `t` through the segment `[start, end]`, 0..1; a zero-length segment is complete. */
export const segmentU = (t: number, start: number, end: number): number =>
  end - start <= 0 ? (t >= end ? 1 : 0) : clamp((t - start) / (end - start));

/** Small deterministic PRNG so the torn edge and grain are identical every run. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
