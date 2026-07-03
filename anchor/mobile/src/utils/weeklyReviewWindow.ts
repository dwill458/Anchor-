/**
 * Shared timing rules for the Weekly Thread Review.
 *
 * The in-app review window opens Sunday evening and closes Monday morning.
 * The Sunday start aligns with the weekly summary notification slot
 * (Sunday 19:00 — see NotificationService.scheduleWeeklySummary) and sits
 * clear of the streak-protection (20:00) and daily prime (21:00) slots used
 * by the Alchemist/Weaver/Mirror/Micro-Prime notification hierarchy.
 */
export const REVIEW_WINDOW_SUNDAY_START_HOUR = 19;
export const REVIEW_WINDOW_MONDAY_END_HOUR = 12;

/**
 * True while the in-app review should surface on its own schedule:
 * Sunday evening through Monday morning.
 */
export function isWithinWeeklyReviewWindow(now: Date): boolean {
  if (now.getDay() === 0) {
    return now.getHours() >= REVIEW_WINDOW_SUNDAY_START_HOUR;
  }

  if (now.getDay() === 1) {
    return now.getHours() < REVIEW_WINDOW_MONDAY_END_HOUR;
  }

  return false;
}

/**
 * True when the review period is the previously completed Sunday-Saturday
 * window: all of Sunday (pre-existing behavior) plus Monday morning, so a
 * Monday-morning review covers the finished week rather than a day-old one.
 */
export function reviewsPreviousWeekWindow(now: Date): boolean {
  if (now.getDay() === 0) {
    return true;
  }

  return now.getDay() === 1 && now.getHours() < REVIEW_WINDOW_MONDAY_END_HOUR;
}
