export type ThreadAuraVariant = 'home' | 'details';
/** Aura layer edge as a multiple of the coin diameter; the halo needs room to fall off unclipped. */
export const THREAD_AURA_SPAN = 1.9;

/** Duration of the Thread Strength tween (Home and Details). Carousel motion never uses time. */
export const HOME_AURA_SETTLE_MS = 420;

/** Home resting glow: ~15% below the original calibration at full strength (0.67 tuned, +15%, then +10%). */
const HOME_AURA_INTENSITY = 0.847;

export function normalizeThreadStrength(value: number | null | undefined): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0;
}

/**
 * Strength-calibrated resting opacity for the Home hero. Zero (or unavailable) strength yields
 * no glow at all. Opacity is a pure function of strength with no floor, so low strengths stay understated.
 */
export function homeAuraRestingOpacity(threadStrength: number | null | undefined): number {
  'worklet';
  const s = normalizeThreadStrength(threadStrength);
  return s <= 0 ? 0 : Number((HOME_AURA_INTENSITY * Math.pow(s, 0.7)).toFixed(4));
}

/**
 * Carousel presence, as a function of centre distance in slot units (0 = centred, 1 = one slot away).
 * Smoothstep, so the glow eases in and out with no kink at rest and no overshoot. Anything a full
 * slot or more away is fully absent.
 */
export function carouselGlowWeight(distanceInSlots: number): number {
  'worklet';
  const x = Number.isFinite(distanceInSlots) ? Math.min(1, Math.abs(distanceInSlots)) : 1;
  const t = 1 - x;
  return t * t * (3 - 2 * t);
}

/**
 * The thread-strength-driven parameters for the static (non-Skia) renderer. Every value is a
 * smooth function of strength; the thickness of the rim is deliberately small so strength shows
 * as light and reach, never as a thicker band.
 */
export function staticAuraLayers(threadStrength: number | null | undefined) {
  'worklet';
  const s = normalizeThreadStrength(threadStrength);
  const g = Math.pow(s, 0.7);
  return {
    /** Thin luminous rim, as a fraction of the coin diameter. About half the old fallback thickness at every strength. */
    ringWidth: s > 0 ? 0.008 + 0.012 * s : 0,
    /** Rim alpha; the outer falloff does the rest. */
    ringOpacity: s > 0 ? 0.25 + 0.6 * g : 0,
    /** How far the halo reaches beyond the rim, as a fraction of the coin radius. */
    haloReach: s > 0 ? 0.12 + 0.36 * s : 0,
    /** Halo alpha right at the rim. Rises with strength, so stronger Anchors radiate more. */
    haloRimOpacity: s > 0 ? 0.55 + 0.35 * s : 0,
    /** Halo alpha partway out. Keeps the falloff soft rather than a flat band. */
    haloMidOpacity: s > 0 ? 0.18 + 0.22 * s : 0,
  };
}

/**
 * The thread-strength-driven parameters for the Skia shader. Every value is a smooth function of
 * strength; there are no level thresholds.
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
