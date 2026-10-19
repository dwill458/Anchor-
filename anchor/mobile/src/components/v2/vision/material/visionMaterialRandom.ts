/**
 * Deterministic pseudo-random helpers for the Vision material layer.
 *
 * Every texture, tape strip and rotation derives from a numeric seed, so the same
 * seed always renders the same paper. Nothing here reads `Math.random`, so a
 * re-render or a remount never shuffles the artwork.
 */

/** Mulberry32: small, fast, and well distributed for visual jitter. */
export function createSeededRandom(seed: number): () => number {
  let state = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic rotation in degrees, uniformly within `[-limit, limit]`. */
export function seededRotation(seed: number, limit: number): number {
  const next = createSeededRandom(seed);
  return roundTo((next() * 2 - 1) * Math.abs(limit), 2);
}

/** Rounds to a fixed number of decimals so rotations are stable strings. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
