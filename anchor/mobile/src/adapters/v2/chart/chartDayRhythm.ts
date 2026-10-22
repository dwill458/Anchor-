import type { MoveSummary } from '@/types/chart';
import { localDateString } from '@/utils/primingAnalytics';

/**
 * Pure day-rhythm helpers shared by the Chart map layer and the Home adapter.
 * No React, no stores. Dates are LOCAL calendar dates (sessionStore's format).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar date key, `YYYY-MM-DD`. */
export const localDateKey = (date: Date): string => localDateString(date);

/** True when any COMPLETED move was completed on the same LOCAL calendar date as `now`. */
export function isDayClosed(moves: MoveSummary[], now: Date): boolean {
  const today = localDateKey(now);
  return moves.some((move) => {
    if (move.status !== 'COMPLETED' || !move.completedAt) return false;
    const at = new Date(move.completedAt);
    return !Number.isNaN(at.getTime()) && localDateKey(at) === today;
  });
}

/**
 * Local calendar days since the course was plotted, plus one, never below 1
 * (clock skew or a future plottedAt still reads 1).
 */
export function daysOnCourse(plottedAt: string, now: Date): number {
  const plotted = new Date(plottedAt);
  if (Number.isNaN(plotted.getTime())) return 1;
  const a = Date.UTC(plotted.getFullYear(), plotted.getMonth(), plotted.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.round((b - a) / DAY_MS) + 1);
}
