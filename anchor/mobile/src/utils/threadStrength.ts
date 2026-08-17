import type { ThreadStrengthSensitivity } from '@/stores/settingsStore';

const DECAY_START_DAY: Record<ThreadStrengthSensitivity, number> = {
  lenient: 3,
  balanced: 2,
  strict: 1,
};

export function getThreadDecayStartDay(
  sensitivity: ThreadStrengthSensitivity
): number {
  return DECAY_START_DAY[sensitivity];
}

export function calculateThreadDecay(
  missedDays: number,
  sensitivity: ThreadStrengthSensitivity
): number {
  const normalizedMissedDays = Math.max(0, Math.floor(missedDays));
  const decayStartDay = getThreadDecayStartDay(sensitivity);

  if (normalizedMissedDays < decayStartDay) {
    return 0;
  }

  return 30 + Math.max(0, normalizedMissedDays - decayStartDay) * 15;
}

export interface ThreadStrengthStateInfo {
  label: string;
  description: string;
}

export function getThreadStrengthState(score: number): ThreadStrengthStateInfo {
  if (score < 25) {
    return {
      label: 'Nascent',
      description: 'Beginning to form through initial practice returns.',
    };
  }
  if (score < 70) {
    return {
      label: 'Kindling',
      description: 'Building momentum with steady recurring returns.',
    };
  }
  if (score < 90) {
    return {
      label: 'Tempered',
      description: 'Well-established resilience through consistent practice.',
    };
  }
  return {
    label: 'Forged',
    description: 'Deeply anchored through enduring practice rhythm.',
  };
}

