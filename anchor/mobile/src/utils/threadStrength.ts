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

