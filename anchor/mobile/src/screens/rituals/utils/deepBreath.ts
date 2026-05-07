export type DeepBreathPattern = {
  inhale: number;
  hold: number;
  exhale: number;
};

export const DEEP_PHASE_BREATHS: Record<string, DeepBreathPattern> = {
  breathwork: { inhale: 4, hold: 2, exhale: 6 },
  'repeat intention': { inhale: 4, hold: 0, exhale: 6 },
  visualization: { inhale: 5, hold: 0, exhale: 5 },
  transfer: { inhale: 4, hold: 2, exhale: 4 },
  seal: { inhale: 4, hold: 0, exhale: 4 },
};

const FALLBACK_DEEP_BREATH_PATTERN: DeepBreathPattern = {
  inhale: 4,
  hold: 0,
  exhale: 6,
};

export function getDeepBreathPattern(phaseTitle?: string): DeepBreathPattern {
  const key = phaseTitle?.toLowerCase().trim() ?? '';
  return DEEP_PHASE_BREATHS[key] ?? FALLBACK_DEEP_BREATH_PATTERN;
}

export function getDeepBreathTiming(phaseTitle?: string) {
  const pattern = getDeepBreathPattern(phaseTitle);
  const cycleSeconds = Math.max(pattern.inhale + pattern.hold + pattern.exhale, 1);
  const inhaleEnd = pattern.inhale / cycleSeconds;
  const holdEnd = (pattern.inhale + pattern.hold) / cycleSeconds;

  return {
    ...pattern,
    cycleSeconds,
    inhaleEnd,
    holdEnd,
    hasHold: pattern.hold > 0,
  };
}

export function getDeepBreathCycleProgress(
  phaseTitle: string | undefined,
  phaseElapsed: number
): number {
  const { cycleSeconds } = getDeepBreathTiming(phaseTitle);
  const normalizedElapsed = Math.max(0, phaseElapsed);
  return (normalizedElapsed % cycleSeconds) / cycleSeconds;
}

export function getDeepBreathCue(
  phaseTitle: string | undefined,
  phaseElapsed: number
): 'Breathe in' | 'Hold' | 'Breathe out' {
  const pattern = getDeepBreathPattern(phaseTitle);
  const cycleLength = Math.max(pattern.inhale + pattern.hold + pattern.exhale, 1);
  const cycleTime = Math.max(0, phaseElapsed % cycleLength);

  if (cycleTime < pattern.inhale) {
    return 'Breathe in';
  }
  if (cycleTime < pattern.inhale + pattern.hold) {
    return 'Hold';
  }
  return 'Breathe out';
}
