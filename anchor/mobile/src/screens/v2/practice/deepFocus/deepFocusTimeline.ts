export const DEEP_FOCUS_DURATIONS = [120, 300, 600] as const;
export type DeepFocusDuration = typeof DEEP_FOCUS_DURATIONS[number];
export type DeepFocusPhase = 'arrive' | 'hold' | 'descend' | 'immerse' | 'release';

export function isDeepFocusDuration(seconds: number): seconds is DeepFocusDuration {
  return DEEP_FOCUS_DURATIONS.some(duration => duration === seconds);
}

/** Only immersion grows. All values are active seconds, excluding pauses. */
export function deepFocusTimeline(duration: DeepFocusDuration) {
  return [
    { phase: 'arrive' as const, start: 0, end: 15 },
    { phase: 'hold' as const, start: 15, end: 35 },
    { phase: 'descend' as const, start: 35, end: 80 },
    { phase: 'immerse' as const, start: 80, end: duration - 10 },
    { phase: 'release' as const, start: duration - 10, end: duration },
  ];
}

export function deepFocusPhaseAt(seconds: number, duration: DeepFocusDuration): DeepFocusPhase {
  return deepFocusTimeline(duration).find(entry => seconds < entry.end)?.phase ?? 'release';
}

function smooth(start: number, end: number, value: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

/** Field scale when the lines gather around the Anchor (session start and settle). */
export const DEEP_FOCUS_FIELD_REST_SCALE = 0.82;
/** Field scale at the outward turn, halfway through the session. */
export const DEEP_FOCUS_FIELD_PEAK_SCALE = 2.2;
/** Net rotation of the field across the whole session. Normalized, so it scales with length. */
export const DEEP_FOCUS_FIELD_TURN_DEGREES = 90;

const TAU = Math.PI * 2;

/**
 * Normalized field energy for session progress in [0, 1]: 0 when the lines gather at the Anchor,
 * 1 at the outward turn, back to 0 as the field settles. Each half is a cosine ease, so velocity
 * starts at zero, reverses smoothly at the midpoint, and eases to rest at the end.
 */
export function deepFocusFieldEnergy(progress: number) {
  'worklet';
  const p = Math.max(0, Math.min(1, progress));
  return p <= 0.5 ? (1 - Math.cos(TAU * p)) / 2 : (1 + Math.cos(TAU * (p - 0.5))) / 2;
}

/**
 * One continuous UI-thread clock. The field's motion is a function of normalized session progress,
 * so every duration runs the same outward-and-inward arc with no restart, freeze or jump.
 * Copy and audio keep their established second-based timings.
 */
export function deepFocusVisualAt(seconds: number, duration: DeepFocusDuration, reduced: boolean) {
  'worklet';
  const progress = Math.max(0, Math.min(1, seconds / duration));
  const energy = deepFocusFieldEnergy(progress);
  const entry = smooth(0, 0.8, seconds);
  // The field fades in over the first 15% of the session, then stays present through the whole arc.
  const emerge = smooth(0, 0.15, progress);
  // Completion handoff: the field and Anchor dissolve in the final seconds, after the inward settle.
  const fieldRelease = smooth(duration - 3, duration, seconds);
  const anchorRelease = smooth(duration - 2.25, duration, seconds);

  // Audio-only envelopes. These keep the established ambient bed timing unchanged.
  const audioDescent = smooth(35, 80, seconds);
  const audioRelease = smooth(duration - 10, duration - 3.25, seconds);

  // Anchor breath stays gentle, at a constant 18s period with no mid-session change.
  const breath = reduced ? 0 : (1 - Math.cos((seconds / 18) * TAU)) / 2;

  // Field rotation: a normalized net turn plus a small swell, so angular velocity never reverses or stalls.
  const orbitRotation = reduced ? 0 : DEEP_FOCUS_FIELD_TURN_DEGREES * progress + 6 * Math.sin(progress * TAU);
  // The inner layer counter-rotates slightly and breathes in spacing on a short time-based cycle, for depth.
  const weaveRotation = reduced ? 0 : -20 * progress;
  const weaveScale = reduced ? 1 : 1 + 0.02 * Math.sin((seconds / 9) * TAU);

  const fieldScale = DEEP_FOCUS_FIELD_REST_SCALE + (DEEP_FOCUS_FIELD_PEAK_SCALE - DEEP_FOCUS_FIELD_REST_SCALE) * energy;
  // Opacity follows the same arc: lines build as they expand and brighten a little as they draw inward.
  const fieldLevel = reduced ? 0.5 + 0.1 * energy : 0.62 - 0.14 * energy;

  return {
    guidance: entry * (1 - smooth(9, 15, seconds)),
    intention: smooth(15, 20, seconds) * (1 - smooth(35, 65, seconds)),
    // The Anchor starts fully present, matching where the arriving copy lands, so the first frame has no dip.
    anchorOpacity: 1 - anchorRelease,
    anchorScale: reduced ? 1 : 1 + 0.012 * breath * smooth(15, 25, seconds) * (1 - anchorRelease),
    orbitScale: reduced ? 1 : fieldScale,
    orbitOpacity: emerge * fieldLevel * (1 - fieldRelease),
    orbitRotation,
    weaveRotation,
    weaveScale,
    darkness: Math.min(1, 0.4 * smooth(0, 1, progress) + 0.6 * fieldRelease),
    ambientGain: smooth(0, 3, seconds) * (0.12 - 0.05 * audioDescent) * (1 - audioRelease),
  };
}

