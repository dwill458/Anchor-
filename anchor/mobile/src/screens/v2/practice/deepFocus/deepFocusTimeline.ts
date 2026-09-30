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

/** One continuous UI-thread clock, no independent delays or repeating loops. */
export function deepFocusVisualAt(seconds: number, duration: DeepFocusDuration, reduced: boolean) {
  'worklet';
  const entry = smooth(0, 0.8, seconds);
  const descent = smooth(35, 80, seconds);
  const immersion = smooth(80, duration - 10, seconds);
  const immerseStillness = smooth(80, 110, seconds);

  // Multi-step release: environment dissolves first, anchor stands alone, then dissolves into completion.
  const orbitRelease = smooth(duration - 10, duration - 3.25, seconds);
  const anchorRelease = smooth(duration - 2.25, duration, seconds);

  // Integrating the slower frequency keeps the motion continuous at 80s.
  const breathTime = Math.min(seconds, 80) / 18 + Math.max(0, seconds - 80) / 40;
  const breath = reduced ? 0 : (1 - Math.cos(breathTime * Math.PI * 2)) / 2;
  // Drastically reduce breathing amplitude during immersion (0.012 -> 0.0025) while keeping tiny organic life.
  const breathAmp = 0.012 - 0.0095 * immerseStillness;

  // Continuous orbital velocity: gentle in arrive/hold (0.32 deg/s), smoothly decelerating in descent,
  // settling into near-stillness during immersion (0.032 deg/s) with zero discontinuous jumps.
  let orbitRotation = 0;
  if (!reduced) {
    if (seconds <= 35) {
      orbitRotation = 0.32 * seconds;
    } else if (seconds <= 80) {
      const dt = seconds - 35;
      orbitRotation = 11.2 + 0.32 * dt - (0.288 / 90) * dt * dt;
    } else {
      orbitRotation = 19.12 + 0.032 * (seconds - 80);
    }
  }

  return {
    guidance: entry * (1 - smooth(9, 15, seconds)),
    intention: smooth(15, 20, seconds) * (1 - smooth(35, 65, seconds)),
    anchorOpacity: (0.76 + 0.24 * entry) * (1 - anchorRelease),
    anchorScale: reduced ? 1 : (0.95 + 0.05 * entry) + breathAmp * breath * smooth(15, 25, seconds) * (1 - anchorRelease),
    orbitScale: reduced ? 1 : 1 + 1.5 * descent + 0.06 * immersion,
    orbitOpacity: entry * (0.62 - 0.24 * descent - 0.14 * immersion) * (1 - orbitRelease),
    orbitRotation,
    darkness: 0.34 * descent + 0.66 * orbitRelease,
    ambientGain: smooth(0, 3, seconds) * (0.12 - 0.05 * descent) * (1 - orbitRelease),
  };
}

