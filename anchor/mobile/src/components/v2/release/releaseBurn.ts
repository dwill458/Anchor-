import { RELEASE_CEREMONY_TIMELINE_MS as T } from '@/constants/v2/release';

export const RELEASE_ARTWORK_SIZE = 244;
export const RELEASE_FLAME_COUNT = 9;
export const RELEASE_PARTICLE_COUNT = 18;

export function releaseSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function seededUnit(seed: number, index: number): number {
  let hash = Math.imul(seed ^ Math.imul(index + 1, 374761393), 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

export function segment(time: number, from: number, to: number): number {
  'worklet';
  const p = Math.max(0, Math.min(1, (time - from) / Math.max(1, to - from)));
  return p * p * (3 - 2 * p);
}

/** Circular area quantiles, precomputed once; the front consumes area, not screen height. */
const AREA_HEIGHTS = Array.from({ length: 41 }, (_, i) => {
  const p = i / 40;
  let lo = -1;
  let hi = 1;
  for (let step = 0; step < 24; step += 1) {
    const y = (lo + hi) / 2;
    const area = (Math.acos(y) - y * Math.sqrt(Math.max(0, 1 - y * y))) / Math.PI;
    if (area > p) lo = y;
    else hi = y;
  }
  return ((lo + hi) / 2 + 1) / 2;
});

export function burnFraction(time: number): number {
  'worklet';
  if (time <= T.ignite) return 0;
  if (time < T.burnEarly) return 0.25 * (time - T.ignite) / (T.burnEarly - T.ignite);
  if (time < T.burnLate) return 0.25 + 0.4 * (time - T.burnEarly) / (T.burnLate - T.burnEarly);
  if (time < T.finalEmber) return 0.65 + 0.29 * (time - T.burnLate) / (T.finalEmber - T.burnLate);
  return Math.min(1, 0.94 + 0.06 * (time - T.finalEmber) / (T.emptyPause - 80 - T.finalEmber));
}

export function frontHeight(time: number, size: number): number {
  'worklet';
  const p = burnFraction(time);
  const index = Math.min(39, Math.floor(p * 40));
  const height = AREA_HEIGHTS[index] + (AREA_HEIGHTS[index + 1] - AREA_HEIGHTS[index]) * (p * 40 - index);
  return height * size + 7 * (1 - p) - 9 * p;
}

/** Spatial variation is frozen for each Anchor. Both shader and flames use this field. */
export function frontRelief(x: number, size: number, phase: number): number {
  'worklet';
  return 3.2 * Math.sin(x * 0.071 + phase) + 1.4 * Math.sin(x * 0.23 + phase * 1.7)
    + (x / size - 0.5) * 13;
}

export function flameIntensity(time: number): number {
  'worklet';
  return segment(time, T.ignite, T.ignite + 160)
    * (0.3 + 0.7 * segment(time, T.ignite + 220, T.burnEarly + 350))
    * (1 - segment(time, T.burnLate, T.emptyPause - 160));
}

/** Logical screen dimensions, shared by confirmation, ceremony and transition prediction. */
export function releaseArtworkRect(width: number, height: number) {
  const size = Math.min(RELEASE_ARTWORK_SIZE, width - 72, height * 0.31);
  // Heading and subtitle sit above; the intention, consequences and hold sit below, so the Anchor
  // rests near the top fifth and never moves between rest and isolation.
  return { x: (width - size) / 2, y: Math.round(height * 0.2) + 16, width: size, height: size };
}

/**
 * Ember budget per burn window: early 5 (cap 6), mid 8 (cap 10), final 3 embers + 2 fragments.
 * Births are spread inside each window, so a window never borrows from its neighbour.
 */
const PARTICLE_WINDOWS = [
  { from: T.ignite + 230, to: T.burnEarly, count: 5, ashFrom: Infinity },
  { from: T.burnEarly, to: T.burnLate, count: 8, ashFrom: Infinity },
  { from: T.burnLate, to: T.finalEmber, count: 5, ashFrom: 3 },
] as const;

export function createReleaseParticles(seed: number, size: number) {
  const particles: Array<{
    birth: number; life: number; slot: number; drift: number; rise: number; size: number;
    phase: number; ash: boolean; death: number; surfaceSize: number;
  }> = [];
  PARTICLE_WINDOWS.forEach(window => {
    for (let k = 0; k < window.count; k += 1) {
      const i = particles.length;
      const birth = window.from + (k + 0.1 + seededUnit(seed, i * 7) * 0.7) / window.count * (window.to - window.from);
      const life = 280 + seededUnit(seed, i * 7 + 1) * 260;
      particles.push({
        birth, life,
        slot: seededUnit(seed, i * 7 + 2),
        drift: (seededUnit(seed, i * 7 + 3) - 0.5) * 32,
        rise: 18 + seededUnit(seed, i * 7 + 4) * (i % 7 === 0 ? 68 : 32),
        size: 0.8 + seededUnit(seed, i * 7 + 5) * 1.2,
        phase: seededUnit(seed, i * 7 + 6) * Math.PI * 2,
        // Only the final window carries ash fragments (its last two particles).
        ash: k >= window.ashFrom,
        // Stop all traces before silence, even when scrubbing or frames are dropped.
        death: Math.min(T.emptyPause, birth + life),
        surfaceSize: size,
      });
    }
  });
  return particles;
}

/** Contact stays on the live circular material, even as the cut narrows near the end. */
export function flameContact(slot: number, time: number, size: number, phase: number) {
  'worklet';
  const y = frontHeight(time, size);
  const radius = size / 2 - 1;
  const half = Math.sqrt(Math.max(0, radius * radius - (y - size / 2) ** 2));
  const x = size / 2 + (slot - 0.5) * 2 * half * 0.92;
  return { x, y: y + frontRelief(x, size, phase), visible: half > 1 && time < T.emptyPause - 80 };
}
