import { differenceInCalendarDays } from 'date-fns';

export type StabilizeStats = {
  stabilizesTotal: number;
  stabilizeStreakDays: number;
  lastStabilizeAt: Date | null;
};

export type StabilizeCompletionFlags = {
  sameDay: boolean;
  reset: boolean;
  incremented: boolean;
};

export const toDateOrNull = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function getDayDiffLocal(now: Date, last: Date | string | null | undefined): number | null {
  const lastDate = toDateOrNull(last);
  if (!lastDate) return null;

  const diff = differenceInCalendarDays(now, lastDate);
  // Defensive: if device clock skew makes last appear in the future, treat as same-day.
  return diff < 0 ? 0 : diff;
}

export function getEffectiveStabilizeStreakDays(
  streak: number,
  last: Date | string | null | undefined,
  now: Date = new Date()
): number {
  const diff = getDayDiffLocal(now, last);
  if (diff === null) return 0;

  if (diff === 0) return Math.max(1, streak);
  if (diff === 1) return Math.max(0, streak);
  return 0;
}

export function applyStabilizeCompletion(
  prev: StabilizeStats,
  now: Date = new Date()
): { next: StabilizeStats; flags: StabilizeCompletionFlags } {
  const last = prev.lastStabilizeAt;
  const diff = getDayDiffLocal(now, last);

  const sameDay = diff === 0;
  const reset = diff !== null && diff > 1;

  let nextStreakDays = prev.stabilizeStreakDays;
  if (diff === null) {
    nextStreakDays = 1;
  } else if (sameDay) {
    nextStreakDays = Math.max(1, prev.stabilizeStreakDays);
  } else if (diff === 1) {
    nextStreakDays = prev.stabilizeStreakDays + 1;
  } else {
    // Missed a day (or more)
    nextStreakDays = 1;
  }

  return {
    next: {
      stabilizesTotal: prev.stabilizesTotal + 1,
      stabilizeStreakDays: nextStreakDays,
      lastStabilizeAt: now,
    },
    flags: {
      sameDay,
      reset,
      incremented: true,
    },
  };
}

