/**
 * streak.ts — Grace-day streak utility
 *
 * Extends the base calculateStreak() from streakHelpers.ts with a
 * 1-per-7-day grace day mechanic.
 *
 * Grace Day Rules:
 *  - The user gets 1 grace day per 7-day rolling window.
 *  - A grace day bridges exactly ONE missed calendar day.
 *  - If the most-recent activity was 2 days ago (missed yesterday) AND
 *    the user hasn't used a grace day in the last 6 days, the streak
 *    is treated as unbroken (isStreakProtected = true).
 *  - A gap of 2+ missed days always breaks the streak.
 *  - The grace day must be manually consumed via sessionStore.consumeGraceDay()
 *    so the UI can react to the event.
 *
 * To extend grace count (e.g. 2 per 7 days), change GRACE_DAYS_PER_WINDOW.
 */

import type { StreakResult } from './streakHelpers';
import { calculateStreak } from './streakHelpers';

const GRACE_WINDOW_DAYS = 7;

export interface StreakWithGraceResult extends StreakResult {
  /** True when the grace day is currently bridging a 1-day gap. */
  isStreakProtected: boolean;
  /** True when the user has at least one grace day available in this window. */
  canUseGraceDay: boolean;
}

/**
 * Returns the UTC epoch-day for a given Date.
 */
const utcDay = (d: Date): number => Math.floor(d.getTime() / 86_400_000);

/**
 * Calculates a streak (current + longest) from activation-like records,
 * applying grace day logic.
 *
 * @param activations  Array of objects with a createdAt field.
 * @param lastGraceDayUsedAt  ISO string from sessionStore.lastGraceDayUsedAt,
 *                            or null if never used.
 *
 * Usage example:
 *   const result = calculateStreakWithGrace(sessionLog, lastGraceDayUsedAt);
 *   if (result.isStreakProtected) {
 *     // Show "Grace day active" badge
 *   }
 *   if (!result.isStreakProtected && result.canUseGraceDay && result.currentStreak === 0) {
 *     // Show "Pick it back up" CTA with grace-day offer
 *   }
 */
export function calculateStreakWithGrace(
  activations: { completedAt?: string; createdAt?: string }[],
  lastGraceDayUsedAt: string | null
): StreakWithGraceResult {
  // Normalise: accept both completedAt (SessionLogEntry) and createdAt (Activation)
  const normalised = activations
    .map((a) => ({ createdAt: a.completedAt ?? a.createdAt ?? '' }))
    .filter((a) => a.createdAt !== '');

  const base = calculateStreak(normalised);

  const now = new Date();
  const todayUtc = utcDay(now);
  const canUseGraceDay = _canUseGraceDay(lastGraceDayUsedAt, now);

  // If base streak is already > 0, no grace day needed
  if (base.currentStreak > 0) {
    return { ...base, isStreakProtected: false, canUseGraceDay };
  }

  // Check whether last activity was exactly 2 days ago (one missed day)
  const lastAt = base.lastActivatedAt;
  if (!lastAt) {
    return { ...base, isStreakProtected: false, canUseGraceDay };
  }

  const daysSinceLast = todayUtc - utcDay(lastAt);

  // daysSinceLast === 1: yesterday — streak still alive from base calc, won't reach here
  // daysSinceLast === 2: missed exactly yesterday → grace day can bridge it
  if (daysSinceLast === 2 && canUseGraceDay) {
    // Re-calculate streak as if yesterday had a session
    // Inject a synthetic "yesterday" entry so calculateStreak sees continuity
    const yesterday = new Date((todayUtc - 1) * 86_400_000).toISOString();
    const withYesterday = [...normalised, { createdAt: yesterday }];
    const bridged = calculateStreak(withYesterday);

    return {
      currentStreak: bridged.currentStreak,
      longestStreak: Math.max(base.longestStreak, bridged.currentStreak),
      lastActivatedAt: base.lastActivatedAt,
      isStreakProtected: true,
      canUseGraceDay: true, // still available until consumed
    };
  }

  return { ...base, isStreakProtected: false, canUseGraceDay };
}

/**
 * Returns true if the user has not used a grace day in the last GRACE_WINDOW_DAYS.
 */
export function _canUseGraceDay(lastGraceDayUsedAt: string | null, now: Date = new Date()): boolean {
  if (!lastGraceDayUsedAt) return true;
  const usedAt = new Date(lastGraceDayUsedAt);
  if (isNaN(usedAt.getTime())) return true;
  const daysSinceUsed = (now.getTime() - usedAt.getTime()) / 86_400_000;
  return daysSinceUsed >= GRACE_WINDOW_DAYS;
}
