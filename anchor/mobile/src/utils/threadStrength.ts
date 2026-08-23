import type { ThreadStrengthSensitivity } from '@/stores/settingsStore';
import {
  PRACTICE_THREAD_STRENGTH_V2_BASE_GAINS,
  type PracticeMode,
  type ThreadStrengthStage,
} from '@/types/practice';

export const THREAD_STRENGTH_ALGORITHM_VERSION = 2 as const;

export const STAGE_ORDER: readonly ThreadStrengthStage[] = [
  'nascent',
  'kindling',
  'tempered',
  'forged',
] as const;

export interface ThreadStrengthStateInfo {
  stage: ThreadStrengthStage;
  label: string;
  description: string;
}

export function getCanonicalThreadStage(score: number): ThreadStrengthStage {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped < 25) return 'nascent';
  if (clamped < 70) return 'kindling';
  if (clamped < 90) return 'tempered';
  return 'forged';
}

export function compareStages(
  left: ThreadStrengthStage,
  right: ThreadStrengthStage
): number {
  return STAGE_ORDER.indexOf(left) - STAGE_ORDER.indexOf(right);
}

export function maxStage(
  left: ThreadStrengthStage,
  right: ThreadStrengthStage
): ThreadStrengthStage {
  return compareStages(left, right) >= 0 ? left : right;
}

export function getThreadStrengthState(score: number): ThreadStrengthStateInfo {
  const stage = getCanonicalThreadStage(score);
  switch (stage) {
    case 'nascent':
      return {
        stage,
        label: 'Nascent',
        description: 'Beginning to form through initial practice returns.',
      };
    case 'kindling':
      return {
        stage,
        label: 'Kindling',
        description: 'Building momentum with steady recurring returns.',
      };
    case 'tempered':
      return {
        stage,
        label: 'Tempered',
        description: 'Well-established resilience through consistent practice.',
      };
    case 'forged':
      return {
        stage,
        label: 'Forged',
        description: 'Deeply anchored through enduring practice rhythm.',
      };
  }
}

export function getStageDecayMultiplier(stage: ThreadStrengthStage): number {
  switch (stage) {
    case 'nascent':
    case 'kindling':
      return 1.0;
    case 'tempered':
      return 0.85;
    case 'forged':
      return 0.70;
  }
}

export function getMemoryFloorForStage(highestStage: ThreadStrengthStage): number {
  switch (highestStage) {
    case 'nascent':
      return 0;
    case 'kindling':
      return 15;
    case 'tempered':
      return 30;
    case 'forged':
      return 45;
  }
}

export function getBasePracticeGain(mode: PracticeMode): number {
  return PRACTICE_THREAD_STRENGTH_V2_BASE_GAINS[mode] ?? 0;
}

export function getStrengthMultiplier(currentStrength: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(currentStrength)));
  if (clamped < 25) return 1.00;
  if (clamped < 50) return 0.80;
  if (clamped < 70) return 0.65;
  if (clamped < 90) return 0.45;
  return 0.25;
}

export function getSameDaySessionMultiplier(sessionIndexToday: number): number {
  const index = Math.max(1, Math.floor(sessionIndexToday));
  if (index === 1) return 1.00;
  if (index === 2) return 0.50;
  if (index === 3) return 0.25;
  return 0.00;
}

export function calculatePracticeGain(params: {
  mode: PracticeMode;
  currentStrength: number;
  sessionIndexToday: number;
}): number {
  const baseGain = getBasePracticeGain(params.mode);
  if (baseGain <= 0 || params.currentStrength >= 100) {
    return 0;
  }

  const strengthMult = getStrengthMultiplier(params.currentStrength);
  const sameDayMult = getSameDaySessionMultiplier(params.sessionIndexToday);
  if (sameDayMult <= 0) {
    return 0;
  }

  const rawGain = baseGain * strengthMult * sameDayMult;
  const rounded = Math.round(rawGain);
  const finalGain = Math.max(1, rounded);

  return Math.max(0, Math.min(100 - params.currentStrength, finalGain));
}

const DECAY_START_DAY: Record<ThreadStrengthSensitivity, number> = {
  lenient: 3,
  balanced: 2,
  strict: 1,
};

export function getThreadDecayStartDay(
  sensitivity: ThreadStrengthSensitivity
): number {
  return DECAY_START_DAY[sensitivity] ?? 2;
}

export function getV2BaseDecayForMissedDay(
  missedDayIndex: number,
  sensitivity: ThreadStrengthSensitivity
): number {
  const index = Math.max(1, Math.floor(missedDayIndex));
  if (sensitivity === 'lenient') {
    if (index <= 2) return 0;
    if (index === 3) return 3;
    return 4;
  }
  if (sensitivity === 'strict') {
    if (index === 1) return 5;
    return 8;
  }
  // balanced
  if (index <= 1) return 0;
  if (index === 2) return 4;
  return 6;
}

export function applyDailyDecay(params: {
  currentStrength: number;
  missedDayIndex: number;
  sensitivity: ThreadStrengthSensitivity;
  highestStageReached: ThreadStrengthStage;
}): {
  newStrength: number;
  decayAmount: number;
  currentStage: ThreadStrengthStage;
} {
  const baseDecay = getV2BaseDecayForMissedDay(
    params.missedDayIndex,
    params.sensitivity
  );
  if (baseDecay <= 0 || params.currentStrength <= 0) {
    const currentStage = getCanonicalThreadStage(params.currentStrength);
    return {
      newStrength: params.currentStrength,
      decayAmount: 0,
      currentStage,
    };
  }

  const currentStage = getCanonicalThreadStage(params.currentStrength);
  const resilience = getStageDecayMultiplier(currentStage);
  const decayAmount = Math.round(baseDecay * resilience);
  const floor = getMemoryFloorForStage(params.highestStageReached);

  const newStrength = Math.max(
    floor,
    Math.max(0, params.currentStrength - decayAmount)
  );

  return {
    newStrength,
    decayAmount: params.currentStrength - newStrength,
    currentStage: getCanonicalThreadStage(newStrength),
  };
}

/** Legacy V1 decay calculation retained for reference & backward compatibility. */
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

export function getThreadStrengthTagline(params: {
  score: number;
  totalSessions: number;
  isDecaying?: boolean;
}): {
  tagline: string;
  supportingCopy?: string;
} {
  if (params.totalSessions === 0) {
    return { tagline: 'No sessions yet. Forge the first prime.' };
  }
  if (params.isDecaying) {
    return {
      tagline: 'Thread tension is easing.',
      supportingCopy: 'Return to reinforce it.',
    };
  }
  if (params.score < 25) {
    return { tagline: 'Thread is beginning.' };
  }
  if (params.score < 40) {
    return { tagline: 'Thread is lightly held.' };
  }
  if (params.score < 70) {
    return { tagline: 'Thread is holding.' };
  }
  if (params.score < 90) {
    return { tagline: 'Thread is holding strong.' };
  }
  return { tagline: 'Thread is fully tensioned.' };
}

