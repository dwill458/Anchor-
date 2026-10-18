export type ThreadAuraVariant = 'home' | 'details';
/** Aura layer edge as a multiple of the coin diameter; the bloom needs room to fall off unclipped. */
export const THREAD_AURA_SPAN = 1.9;

export function normalizeThreadStrength(value: number | null | undefined): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0;
}

/**
 * The aura is emitted from the coin's silhouette (the artwork disc), the way the reference
 * cards emit from their capsule edge. Distances are fractions of the disc radius. Every value is
 * a smooth function of strength; there are no level thresholds.
 */
export function threadAuraParameters(strength: number, variant: ThreadAuraVariant) {
  'worklet';
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0;
  // Front-loaded so a 25-40 Anchor is already clearly lit, while 90+ still has headroom.
  const g = Math.pow(s, 0.7);
  const restraint = variant === 'home' ? 0.82 : 1;
  return {
    /** Hot rim hugging the edge. */
    core: restraint * (0.5 + 0.9 * g),
    coreWidth: 0.010 + 0.014 * s,
    /** Saturated category-colour body of the glow. */
    mid: restraint * (0.4 + 0.8 * g),
    midWidth: 0.07 + 0.08 * s,
    /** Wide soft bloom. */
    bloom: restraint * (0.32 + 0.7 * g),
    bloomWidth: 0.2 + 0.24 * s,
    /** Flowing filaments that spiral off the edge; absent at zero, rich near 100. */
    filament: restraint * 1.15 * Math.pow(s, 1.35),
    /** Amplitude of the irregular, flowing edge warp. */
    movement: 0.14 + 0.46 * s,
    particles: restraint * 0.9 * Math.pow(s, 3),
  };
}

export function auraTransition(previous: number | null, next: number | null) {
  return { reward: previous !== null && next !== null && Number.isFinite(previous) && Number.isFinite(next) && normalizeThreadStrength(next) > normalizeThreadStrength(previous),
    duration: previous !== null && next !== null && next < previous ? 2200 : 1500 };
}
