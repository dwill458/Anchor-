/**
 * Streak calculation utilities — pure functions, no store imports.
 */

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastActivatedAt: Date | null;
}

/**
 * Calculates current and longest activation streaks from a flat list of
 * activation records.
 *
 * Rules:
 *  - Streak = consecutive calendar days (UTC) with ≥1 activation
 *  - Today without an activation yet does NOT break a streak from yesterday
 *  - Yesterday with no activation DOES break the streak
 *  - Empty input returns all zeros
 */
export function calculateStreak(
  activations: { createdAt: Date | string }[]
): StreakResult {
  if (activations.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActivatedAt: null };
  }

  // Parse to Date objects and drop invalid entries
  const dates = activations
    .map((a) => new Date(a.createdAt))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime()); // descending

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActivatedAt: null };
  }

  const lastActivatedAt = dates[0];

  // Represent each activation as a UTC epoch-day number so arithmetic is easy
  const utcDay = (d: Date) => Math.floor(d.getTime() / 86_400_000);

  // Unique days, sorted descending
  const uniqueDays = [...new Set(dates.map(utcDay))].sort((a, b) => b - a);

  const todayUtc = utcDay(new Date());

  // ── Current streak ────────────────────────────────────────────────────────
  // Streak is still alive if the most-recent activation day is today or
  // yesterday (today with no activation yet doesn't break the streak).
  let currentStreak = 0;
  const mostRecentDay = uniqueDays[0];

  if (mostRecentDay === todayUtc || mostRecentDay === todayUtc - 1) {
    let expected = mostRecentDay;
    for (const day of uniqueDays) {
      if (day === expected) {
        currentStreak++;
        expected--;
      } else {
        break;
      }
    }
  }

  // ── Longest streak (over all recorded history) ────────────────────────────
  let longestStreak = 0;
  let runLength = 1;

  for (let i = 0; i < uniqueDays.length - 1; i++) {
    if (uniqueDays[i] - uniqueDays[i + 1] === 1) {
      runLength++;
    } else {
      longestStreak = Math.max(longestStreak, runLength);
      runLength = 1;
    }
  }
  longestStreak = Math.max(longestStreak, runLength);

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastActivatedAt,
  };
}
