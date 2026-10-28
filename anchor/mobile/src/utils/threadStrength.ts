import type { ThreadStrengthSensitivity } from '@/stores/settingsStore';

export const THREAD_STRENGTH_CONSTANTS = {
  activationBonus: 12,
  dailyReturnBonus: 1.5,
  pointsPerMinute: 0.5,
  dailyDurationCapSeconds: 600, // 10 minutes max earning
  minStrength: 0,
  maxStrength: 100,
} as const;

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

  return (normalizedMissedDays - decayStartDay + 1) * 3;
}

export function roundToPrecision(val: number, decimals: number = 4): number {
  const factor = 10 ** decimals;
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export interface OptimisticPracticeGainParams {
  currentStrength: number | null | undefined;
  practiceType: string;
  durationSeconds: number;
  isFirstPracticeEver: boolean;
  isFirstSessionToday: boolean;
  priorEligibleSecondsToday?: number;
}

export interface OptimisticPracticeGainResult {
  beforeStrength: number;
  afterStrength: number;
  delta: number;
  activationBonus: number;
  dailyReturnBonus: number;
  durationBonus: number;
}

export function calculateOptimisticPracticeGain(
  params: OptimisticPracticeGainParams
): OptimisticPracticeGainResult {
  const beforeStrength =
    params.currentStrength !== null && params.currentStrength !== undefined
      ? roundToPrecision(params.currentStrength, 4)
      : 0;

  if (params.practiceType === 'release') {
    return {
      beforeStrength,
      afterStrength: beforeStrength,
      delta: 0,
      activationBonus: 0,
      dailyReturnBonus: 0,
      durationBonus: 0,
    };
  }

  const activationBonus = params.isFirstPracticeEver
    ? THREAD_STRENGTH_CONSTANTS.activationBonus
    : 0;
  const dailyReturnBonus = params.isFirstSessionToday
    ? THREAD_STRENGTH_CONSTANTS.dailyReturnBonus
    : 0;

  const safeDuration = Math.max(0, params.durationSeconds);
  const clampedPrior = Math.max(
    0,
    Math.min(
      THREAD_STRENGTH_CONSTANTS.dailyDurationCapSeconds,
      params.priorEligibleSecondsToday ?? 0
    )
  );
  const newEligible = Math.min(
    THREAD_STRENGTH_CONSTANTS.dailyDurationCapSeconds,
    clampedPrior + safeDuration
  );
  const deltaSeconds = Math.max(0, newEligible - clampedPrior);
  const durationBonus =
    (deltaSeconds / 60) * THREAD_STRENGTH_CONSTANTS.pointsPerMinute;

  const grossDelta = activationBonus + dailyReturnBonus + durationBonus;
  const rawAfter = Math.min(
    THREAD_STRENGTH_CONSTANTS.maxStrength,
    Math.max(THREAD_STRENGTH_CONSTANTS.minStrength, beforeStrength + grossDelta)
  );

  const afterStrength = roundToPrecision(rawAfter, 4);
  const delta = roundToPrecision(afterStrength - beforeStrength, 4);

  return {
    beforeStrength,
    afterStrength,
    delta,
    activationBonus,
    dailyReturnBonus,
    durationBonus,
  };
}
