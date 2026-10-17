export type ThreadAuraVariant = 'home' | 'details';
export const THREAD_AURA_BLUR_SIGMAS = [0.006, 0.014, 0.036, 0.12, 0.18] as const;

export function normalizeThreadStrength(value: number | null | undefined): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0;
}

/** All dimensions are fractions of the artwork size. No level thresholds. */
export function threadAuraParameters(strength: number, variant: ThreadAuraVariant) {
  'worklet';
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0;
  const richness = s * s;
  const restraint = variant === 'home' ? 0.72 : 1;
  return {
    radius: 0.012 + 0.16 * s,
    blur: 0.014 + 0.106 * s,
    inner: restraint * (0.015 + 0.28 * s),
    outer: restraint * 0.64 * Math.pow(s, 1.3),
    movement: restraint * 0.027 * richness,
    particles: restraint * 0.22 * Math.pow(s, 5),
    ambient: restraint * 0.28 * Math.pow(s, 3),
  };
}

export function auraTransition(previous: number | null, next: number | null) {
  return { reward: previous !== null && next !== null && Number.isFinite(previous) && Number.isFinite(next) && normalizeThreadStrength(next) > normalizeThreadStrength(previous),
    duration: previous !== null && next !== null && next < previous ? 2200 : 1500 };
}
