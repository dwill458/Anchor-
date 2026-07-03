import {
  isWithinWeeklyReviewWindow,
  reviewsPreviousWeekWindow,
} from '../weeklyReviewWindow';

// 2026-04-19 is a Sunday; 2026-04-20 is a Monday.

describe('isWithinWeeklyReviewWindow', () => {
  it('opens Sunday evening at the notification-aligned hour', () => {
    expect(isWithinWeeklyReviewWindow(new Date(2026, 3, 19, 18, 59))).toBe(false);
    expect(isWithinWeeklyReviewWindow(new Date(2026, 3, 19, 19, 0))).toBe(true);
    expect(isWithinWeeklyReviewWindow(new Date(2026, 3, 19, 23, 30))).toBe(true);
  });

  it('stays open Monday morning and closes at noon', () => {
    expect(isWithinWeeklyReviewWindow(new Date(2026, 3, 20, 8, 0))).toBe(true);
    expect(isWithinWeeklyReviewWindow(new Date(2026, 3, 20, 11, 59))).toBe(true);
    expect(isWithinWeeklyReviewWindow(new Date(2026, 3, 20, 12, 0))).toBe(false);
  });

  it('is closed midweek', () => {
    expect(isWithinWeeklyReviewWindow(new Date(2026, 3, 22, 20, 0))).toBe(false);
  });
});

describe('reviewsPreviousWeekWindow', () => {
  it('covers all of Sunday and Monday morning only', () => {
    expect(reviewsPreviousWeekWindow(new Date(2026, 3, 19, 9, 0))).toBe(true);
    expect(reviewsPreviousWeekWindow(new Date(2026, 3, 20, 9, 0))).toBe(true);
    expect(reviewsPreviousWeekWindow(new Date(2026, 3, 20, 13, 0))).toBe(false);
    expect(reviewsPreviousWeekWindow(new Date(2026, 3, 21, 9, 0))).toBe(false);
  });
});
