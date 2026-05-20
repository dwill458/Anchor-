import { calculateStreakWithGrace, _canUseGraceDay } from '../streak';

// Helper: produce an ISO/UTC Date/string for N days ago (0 = today, 1 = yesterday …)
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0); // use midday to avoid UTC/timezone edge cases
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('_canUseGraceDay', () => {
  it('returns true if lastGraceDayUsedAt is null', () => {
    expect(_canUseGraceDay(null)).toBe(true);
  });

  it('returns true if lastGraceDayUsedAt is invalid date string', () => {
    expect(_canUseGraceDay('invalid-date')).toBe(true);
  });

  it('returns true if lastGraceDayUsedAt is 7 or more days ago', () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000 - 1000).toISOString();
    const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000).toISOString();
    expect(_canUseGraceDay(sevenDaysAgo, now)).toBe(true);
    expect(_canUseGraceDay(eightDaysAgo, now)).toBe(true);
  });

  it('returns false if lastGraceDayUsedAt is less than 7 days ago', () => {
    const now = new Date();
    const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000).toISOString();
    const today = now.toISOString();
    expect(_canUseGraceDay(sixDaysAgo, now)).toBe(false);
    expect(_canUseGraceDay(today, now)).toBe(false);
  });
});

describe('calculateStreakWithGrace', () => {
  it('handles empty activations array', () => {
    const result = calculateStreakWithGrace([], null);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.isStreakProtected).toBe(false);
    expect(result.canUseGraceDay).toBe(true);
  });

  it('keeps isStreakProtected false if base streak is already active (> 0)', () => {
    const activations = [
      { createdAt: daysAgo(0).toISOString() },
      { createdAt: daysAgo(1).toISOString() },
    ];
    const result = calculateStreakWithGrace(activations, null);
    expect(result.currentStreak).toBe(2);
    expect(result.isStreakProtected).toBe(false);
    expect(result.canUseGraceDay).toBe(true);
  });

  it('keeps isStreakProtected false if there is no last activation date', () => {
    const activations = [{ createdAt: '' }];
    const result = calculateStreakWithGrace(activations, null);
    expect(result.currentStreak).toBe(0);
    expect(result.isStreakProtected).toBe(false);
  });

  it('bridges a 1-day gap (missed yesterday) when grace day is available', () => {
    // Activiated 2, 3, and 4 days ago. Missed yesterday.
    const activations = [
      { createdAt: daysAgo(2).toISOString() },
      { createdAt: daysAgo(3).toISOString() },
      { createdAt: daysAgo(4).toISOString() },
    ];
    const result = calculateStreakWithGrace(activations, null);
    // Bridged streak: 3 previous days + 1 bridged yesterday = 4 days
    expect(result.isStreakProtected).toBe(true);
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
    expect(result.canUseGraceDay).toBe(true);
  });

  it('does not bridge a 1-day gap (missed yesterday) if grace day is exhausted', () => {
    const activations = [
      { createdAt: daysAgo(2).toISOString() },
      { createdAt: daysAgo(3).toISOString() },
    ];
    // Used grace day 3 days ago
    const lastUsed = daysAgo(3).toISOString();
    const result = calculateStreakWithGrace(activations, lastUsed);
    expect(result.isStreakProtected).toBe(false);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(2);
    expect(result.canUseGraceDay).toBe(false);
  });

  it('does not bridge a 2-day gap (missed yesterday and day before)', () => {
    const activations = [
      { createdAt: daysAgo(3).toISOString() },
      { createdAt: daysAgo(4).toISOString() },
    ];
    const result = calculateStreakWithGrace(activations, null);
    expect(result.isStreakProtected).toBe(false);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(2);
  });

  it('accepts completedAt as property name for activations', () => {
    const activations = [
      { completedAt: daysAgo(2).toISOString() },
      { completedAt: daysAgo(3).toISOString() },
    ];
    const result = calculateStreakWithGrace(activations, null);
    expect(result.isStreakProtected).toBe(true);
    expect(result.currentStreak).toBe(3);
  });
});
