/**
 * Tests for Weekly Review Window and Date calculation helpers.
 */

import {
  formatWeekDateRange,
  getCompletedWeekDateRange,
  isWithinWeeklyInsightReviewWindow,
} from '../weeklyReviewWindow';

describe('weeklyReviewWindow', () => {
  describe('isWithinWeeklyInsightReviewWindow', () => {
    it('returns false on Sunday before 19:00', () => {
      // 2026-09-06 is Sunday
      const sunAfternoon = new Date(2026, 8, 6, 18, 59, 0);
      expect(isWithinWeeklyInsightReviewWindow(sunAfternoon)).toBe(false);
    });

    it('returns true on Sunday at or after 19:00', () => {
      const sunEvening = new Date(2026, 8, 6, 19, 0, 0);
      expect(isWithinWeeklyInsightReviewWindow(sunEvening)).toBe(true);

      const sunNight = new Date(2026, 8, 6, 23, 30, 0);
      expect(isWithinWeeklyInsightReviewWindow(sunNight)).toBe(true);
    });

    it('returns true all day Monday', () => {
      // 2026-09-07 is Monday
      const monMorning = new Date(2026, 8, 7, 8, 0, 0);
      const monNight = new Date(2026, 8, 7, 23, 59, 0);
      expect(isWithinWeeklyInsightReviewWindow(monMorning)).toBe(true);
      expect(isWithinWeeklyInsightReviewWindow(monNight)).toBe(true);
    });

    it('returns true on Tuesday before 12:00 noon', () => {
      // 2026-09-08 is Tuesday
      const tueMorning = new Date(2026, 8, 8, 9, 30, 0);
      const tueMidday = new Date(2026, 8, 8, 11, 59, 0);
      expect(isWithinWeeklyInsightReviewWindow(tueMorning)).toBe(true);
      expect(isWithinWeeklyInsightReviewWindow(tueMidday)).toBe(true);
    });

    it('returns false on Tuesday at or after 12:00 noon', () => {
      const tueNoon = new Date(2026, 8, 8, 12, 0, 0);
      const tueAfternoon = new Date(2026, 8, 8, 15, 0, 0);
      expect(isWithinWeeklyInsightReviewWindow(tueNoon)).toBe(false);
      expect(isWithinWeeklyInsightReviewWindow(tueAfternoon)).toBe(false);
    });

    it('returns false Wednesday through Saturday', () => {
      // 2026-09-09 is Wednesday, 2026-09-12 is Saturday
      const wed = new Date(2026, 8, 9, 10, 0, 0);
      const sat = new Date(2026, 8, 12, 14, 0, 0);
      expect(isWithinWeeklyInsightReviewWindow(wed)).toBe(false);
      expect(isWithinWeeklyInsightReviewWindow(sat)).toBe(false);
    });
  });

  describe('formatWeekDateRange', () => {
    it('formats single-month range cleanly', () => {
      const start = new Date(2026, 7, 10);
      const end = new Date(2026, 7, 16);
      expect(formatWeekDateRange(start, end)).toBe('Aug 10 – 16');
    });

    it('formats multi-month boundary range cleanly', () => {
      const start = new Date(2026, 7, 31);
      const end = new Date(2026, 8, 6);
      expect(formatWeekDateRange(start, end)).toBe('Aug 31 – Sep 6');
    });
  });

  describe('getCompletedWeekDateRange', () => {
    it('calculates the completed week on Tuesday morning', () => {
      // Tuesday Sep 8, 2026
      const ref = new Date(2026, 8, 8, 9, 0, 0);
      const range = getCompletedWeekDateRange(ref, 0);

      // Should be Monday Aug 31 to Sunday Sep 6
      expect(range.start.getFullYear()).toBe(2026);
      expect(range.start.getMonth()).toBe(7); // Aug
      expect(range.start.getDate()).toBe(31);
      expect(range.start.getHours()).toBe(0);

      expect(range.end.getMonth()).toBe(8); // Sep
      expect(range.end.getDate()).toBe(6);
      expect(range.end.getHours()).toBe(23);
      expect(range.label).toBe('Aug 31 – Sep 6');
    });

    it('calculates offset weeks correctly', () => {
      const ref = new Date(2026, 8, 8, 9, 0, 0);
      const rangePrior = getCompletedWeekDateRange(ref, 1);
      expect(rangePrior.label).toBe('Aug 24 – 30');
    });
  });
});
