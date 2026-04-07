import { calculateStreak } from '../streakHelpers';

// Helper: produce a UTC midnight Date for N days ago (0 = today, 1 = yesterday …)
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('calculateStreak', () => {
  it('returns zeros and null for an empty array', () => {
    const result = calculateStreak([]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.lastActivatedAt).toBeNull();
  });

  it('returns streak of 1 for a single activation today', () => {
    const today = daysAgo(0);
    const result = calculateStreak([{ createdAt: today }]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.lastActivatedAt).toEqual(today);
  });

  it('counts consecutive days correctly', () => {
    const activations = [
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(1) },
      { createdAt: daysAgo(2) },
    ];
    const result = calculateStreak(activations);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('breaks current streak on a gap, preserving longest', () => {
    // Activated 3–5 days ago (a 3-day streak), then nothing recent
    const activations = [
      { createdAt: daysAgo(3) },
      { createdAt: daysAgo(4) },
      { createdAt: daysAgo(5) },
    ];
    const result = calculateStreak(activations);
    // Yesterday had no activation → streak is broken
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(3);
  });

  it('does not break streak when today has no activation yet (yesterday is most recent)', () => {
    const activations = [
      { createdAt: daysAgo(1) }, // yesterday
      { createdAt: daysAgo(2) }, // day before
    ];
    const result = calculateStreak(activations);
    // Streak should still be alive: yesterday + day-before = 2
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('handles multiple activations on the same day as a single streak day', () => {
    // Three activations today, two yesterday
    const activations = [
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(1) },
      { createdAt: daysAgo(1) },
    ];
    const result = calculateStreak(activations);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('accepts ISO string dates', () => {
    const activations = [
      { createdAt: daysAgo(0).toISOString() },
      { createdAt: daysAgo(1).toISOString() },
    ];
    const result = calculateStreak(activations);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('returns the most recent date as lastActivatedAt', () => {
    const recent = daysAgo(0);
    const older = daysAgo(2);
    const result = calculateStreak([{ createdAt: older }, { createdAt: recent }]);
    expect(result.lastActivatedAt).toEqual(recent);
  });

  it('computes longest streak across a gap in history', () => {
    // Old 5-day streak, then a 2-day streak recently
    const activations = [
      { createdAt: daysAgo(0) },
      { createdAt: daysAgo(1) },
      // gap at daysAgo(2)
      { createdAt: daysAgo(10) },
      { createdAt: daysAgo(11) },
      { createdAt: daysAgo(12) },
      { createdAt: daysAgo(13) },
      { createdAt: daysAgo(14) },
    ];
    const result = calculateStreak(activations);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });
});
