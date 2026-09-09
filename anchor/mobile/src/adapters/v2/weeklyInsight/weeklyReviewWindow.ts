/**
 * Calendar boundary and review window helpers for Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx:
 * - Review window opens Sunday evening (19:00) and closes Tuesday midday (12:00).
 * - Completed week boundary is local calendar Monday 00:00 through Sunday 23:59.
 */

import {
  WEEKLY_INSIGHT_WINDOW_END_DAY,
  WEEKLY_INSIGHT_WINDOW_END_HOUR,
  WEEKLY_INSIGHT_WINDOW_START_DAY,
  WEEKLY_INSIGHT_WINDOW_START_HOUR,
} from '@/constants/v2/weeklyInsightRoutes';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Returns true if `now` is within the Weekly Insight review window:
 * Sunday 19:00 local through Tuesday 12:00 local.
 */
export function isWithinWeeklyInsightReviewWindow(now: Date = new Date()): boolean {
  const day = now.getDay();
  const hour = now.getHours();

  // Sunday evening (from 19:00)
  if (day === WEEKLY_INSIGHT_WINDOW_START_DAY) {
    return hour >= WEEKLY_INSIGHT_WINDOW_START_HOUR;
  }

  // All of Monday
  if (day === 1) {
    return true;
  }

  // Tuesday morning (until 12:00 noon)
  if (day === WEEKLY_INSIGHT_WINDOW_END_DAY) {
    return hour < WEEKLY_INSIGHT_WINDOW_END_HOUR;
  }

  return false;
}

/**
 * Formats a local week date range label, e.g. "Aug 31 – Sep 6" or "Sep 7 – Sep 13".
 */
export function formatWeekDateRange(start: Date, end: Date): string {
  const startMonth = MONTH_NAMES[start.getMonth()];
  const startDay = start.getDate();
  const endMonth = MONTH_NAMES[end.getMonth()];
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}`;
  }

  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

export interface CompletedWeekRange {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Calculates the local Monday 00:00:00 to Sunday 23:59:59 date range of the completed week.
 *
 * @param now Reference timestamp (defaults to current clock).
 * @param weekOffset 0 for the most recently completed week, 1 for the week prior, etc.
 */
export function getCompletedWeekDateRange(
  now: Date = new Date(),
  weekOffset: number = 0,
): CompletedWeekRange {
  const current = new Date(now.getTime());
  const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Find the most recently completed Sunday:
  // If today is Sunday (0), and it's before the Sunday start hour (19:00),
  // the completed week is the *prior* week's Sunday.
  // If today is Sunday after 19:00, today is the completed Sunday.
  let daysSinceSunday: number;
  if (dayOfWeek === 0) {
    const isPastReviewOpen = current.getHours() >= WEEKLY_INSIGHT_WINDOW_START_HOUR;
    daysSinceSunday = isPastReviewOpen ? 0 : 7;
  } else {
    // Mon (1) -> 1 day since Sun; Tue (2) -> 2 days since Sun; etc.
    daysSinceSunday = dayOfWeek;
  }

  // Target completed Sunday
  const endSunday = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate() - daysSinceSunday - (weekOffset * 7),
    23, 59, 59, 999,
  );

  // Completed Monday is 6 days before Sunday at 00:00:00
  const startMonday = new Date(
    endSunday.getFullYear(),
    endSunday.getMonth(),
    endSunday.getDate() - 6,
    0, 0, 0, 0,
  );

  return {
    start: startMonday,
    end: endSunday,
    label: formatWeekDateRange(startMonday, endSunday),
  };
}
