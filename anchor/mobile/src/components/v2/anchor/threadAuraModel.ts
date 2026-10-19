export type ThreadAuraVariant = 'home' | 'details';
/** Aura layer edge as a multiple of the coin diameter; the bloom needs room to fall off unclipped. */
export const THREAD_AURA_SPAN = 1.9;

/** Phase A (Bloom, 0-180ms): radial expansion from the Anchor's edge to 1.15x the resting reach. */
export const HOME_AURA_BLOOM_IN_MS = 180;
/** Phase B (Settle, 180-600ms): smooth contraction over 420ms to the resting reach and intensity. */
export const HOME_AURA_SETTLE_MS = 420;
/** Total Home hero entrance duration across Phase A and Phase B (600ms). */
export const HOME_AURA_ENTRANCE_TOTAL_MS = HOME_AURA_BLOOM_IN_MS + HOME_AURA_SETTLE_MS;
/** Fast fade-out when the user swipes away from the active hero. */
export const HOME_AURA_FADE_OUT_MS = 140;

/** At this scale the aura layer is exactly the coin's diameter, so the bloom starts on the coin's circular edge. */
export const HOME_AURA_INITIAL_SCALE = 1 / THREAD_AURA_SPAN;
export const HOME_AURA_PEAK_SCALE = 1.15;
export const HOME_AURA_REST_SCALE = 1;
/** Home resting glow: ~15% below the original calibration at full strength (0.67 tuned, +15%, then +10%). */
const HOME_AURA_INTENSITY = 0.847;

export function normalizeThreadStrength(value: number | null | undefined): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0;
}

/**
 * Strength-calibrated opacity and scale targets for the Home hero entrance bloom.
 * Zero (or unavailable) strength yields no glow at all: no resting opacity, no bloom, no scale travel.
 * Opacity is a pure function of strength with no floor, so low strengths stay understated.
 */
export function homeAuraEntranceTargets(threadStrength: number | null | undefined) {
  'worklet';
  const s = normalizeThreadStrength(threadStrength);
  if (s <= 0) {
    return { initialOpacity: 0, peakOpacity: 0, restingOpacity: 0, initialScale: HOME_AURA_REST_SCALE, peakScale: HOME_AURA_REST_SCALE, restingScale: HOME_AURA_REST_SCALE };
  }
  const restingOpacity = Number((HOME_AURA_INTENSITY * Math.pow(s, 0.7)).toFixed(4));
  const peakOpacity = Number(Math.min(1, restingOpacity * 1.15).toFixed(4));
  return {
    initialOpacity: 0,
    peakOpacity,
    restingOpacity,
    initialScale: HOME_AURA_INITIAL_SCALE,
    peakScale: HOME_AURA_PEAK_SCALE,
    restingScale: HOME_AURA_REST_SCALE,
  };
}

/**
 * The aura is emitted from the coin's silhouette (the artwork disc), the way the reference
 * cards emit from their capsule edge. Distances are fractions of the disc radius. Every value is
 * a smooth function of strength; there are no level thresholds.
 */
export function threadAuraParameters(strength: number, variant: ThreadAuraVariant) {
  'worklet';
  void variant;
  const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0;
  // Front-loaded so a 25-40 Anchor is already clearly lit, while 90+ still has headroom.
  const g = Math.pow(s, 0.7);
  // Home and Details share one shape. There is no floor: zero strength is exactly zero.
  const restraint = 0.82;
  return {
    /** Hot rim hugging the edge. */
    core: restraint * 1.4 * g,
    coreWidth: s > 0 ? 0.010 + 0.014 * s : 0,
    /** Saturated category-colour body of the glow. */
    mid: restraint * 1.2 * g,
    midWidth: s > 0 ? 0.05 + 0.07 * s : 0,
    /** Wide soft bloom. */
    bloom: restraint * 1.02 * g,
    bloomWidth: s > 0 ? 0.14 + 0.16 * s : 0,
    /** Flowing filaments that spiral off the edge; absent at zero, rich near 100. */
    filament: restraint * 1.15 * Math.pow(s, 1.35),
    /** Amplitude of the irregular, flowing edge warp. */
    movement: s > 0 ? 0.14 + 0.46 * s : 0,
    particles: restraint * 0.9 * Math.pow(s, 3),
  };
}

/** Details resting glow: the Home calibration, a touch (5%) more pronounced. */
export function detailsAuraOpacity(threadStrength: number | null | undefined) {
  'worklet';
  const s = normalizeThreadStrength(threadStrength);
  return s <= 0 ? 0 : Number(Math.min(1, HOME_AURA_INTENSITY * 1.05 * Math.pow(s, 0.7)).toFixed(4));
}

export function auraTransition(previous: number | null, next: number | null) {
  return { reward: previous !== null && next !== null && Number.isFinite(previous) && Number.isFinite(next) && normalizeThreadStrength(next) > normalizeThreadStrength(previous),
    duration: previous !== null && next !== null && next < previous ? 2200 : 1500 };
}
