import {
  applyStabilizeCompletion,
  getDayDiffLocal,
  getEffectiveStabilizeStreakDays,
} from '../stabilizeStats';

describe('stabilizeStats', () => {
  it('first stabilize sets streak to 1 and increments total', () => {
    const now = new Date(2026, 1, 13, 12, 0, 0); // Feb 13, 2026 (local)
    const prev = { stabilizesTotal: 0, stabilizeStreakDays: 0, lastStabilizeAt: null };

    const result = applyStabilizeCompletion(prev, now);

    expect(result.next.stabilizesTotal).toBe(1);
    expect(result.next.stabilizeStreakDays).toBe(1);
    expect(result.next.lastStabilizeAt?.getTime()).toBe(now.getTime());
    expect(result.flags).toEqual({ sameDay: false, reset: false, incremented: true });
  });

  it('second stabilize on the same day increments total but not streak', () => {
    const last = new Date(2026, 1, 13, 9, 0, 0);
    const now = new Date(2026, 1, 13, 18, 0, 0);
    const prev = { stabilizesTotal: 1, stabilizeStreakDays: 3, lastStabilizeAt: last };

    const result = applyStabilizeCompletion(prev, now);

    expect(result.next.stabilizesTotal).toBe(2);
    expect(result.next.stabilizeStreakDays).toBe(3);
    expect(result.flags.sameDay).toBe(true);
    expect(result.flags.reset).toBe(false);
  });

  it('next-day stabilize increments streak', () => {
    const last = new Date(2026, 1, 12, 12, 0, 0);
    const now = new Date(2026, 1, 13, 12, 0, 0);
    const prev = { stabilizesTotal: 4, stabilizeStreakDays: 4, lastStabilizeAt: last };

    const result = applyStabilizeCompletion(prev, now);

    expect(result.next.stabilizesTotal).toBe(5);
    expect(result.next.stabilizeStreakDays).toBe(5);
    expect(result.flags.sameDay).toBe(false);
    expect(result.flags.reset).toBe(false);
  });

  it('missed day resets streak to 1 and sets reset flag', () => {
    const last = new Date(2026, 1, 10, 12, 0, 0);
    const now = new Date(2026, 1, 13, 12, 0, 0);
    const prev = { stabilizesTotal: 10, stabilizeStreakDays: 7, lastStabilizeAt: last };

    const result = applyStabilizeCompletion(prev, now);

    expect(result.next.stabilizeStreakDays).toBe(1);
    expect(result.flags.reset).toBe(true);
  });

  it('effective streak is 0 when last stabilize was more than 1 day ago', () => {
    const last = new Date(2026, 1, 10, 12, 0, 0);
    const now = new Date(2026, 1, 13, 12, 0, 0);

    const effective = getEffectiveStabilizeStreakDays(7, last, now);
    expect(effective).toBe(0);
  });

  it('day diff is 0 for same calendar day (candle lit)', () => {
    const last = new Date(2026, 1, 13, 8, 0, 0);
    const now = new Date(2026, 1, 13, 22, 0, 0);

    expect(getDayDiffLocal(now, last)).toBe(0);
  });
});

