import {
  getPrimeSessionAllowance,
  getWeeklyPrimeUsage,
} from '../primeSessionAccess';

describe('primeSessionAccess', () => {
  const weekKey = '2026-W25';
  const currentDate = new Date('2026-06-17T12:00:00.000Z');
  const history = [
    {
      id: 'focus-1',
      anchorId: 'anchor-1',
      type: 'activate',
      completedAt: '2026-06-16T12:00:00.000Z',
      localDate: '2026-06-16',
      weekKey,
      weekStart: '2026-06-15',
      weekdayIndex: 1,
      hourOfDay: 7,
      timeOfDay: 'morning',
    },
    {
      id: 'focus-2',
      anchorId: 'anchor-1',
      type: 'activate',
      completedAt: '2026-06-17T12:00:00.000Z',
      localDate: '2026-06-17',
      weekKey,
      weekStart: '2026-06-15',
      weekdayIndex: 2,
      hourOfDay: 7,
      timeOfDay: 'morning',
    },
    {
      id: 'deep-1',
      anchorId: 'anchor-1',
      type: 'reinforce',
      completedAt: '2026-06-17T16:00:00.000Z',
      localDate: '2026-06-17',
      weekKey,
      weekStart: '2026-06-15',
      weekdayIndex: 2,
      hourOfDay: 11,
      timeOfDay: 'morning',
    },
    {
      id: 'old-focus',
      anchorId: 'anchor-1',
      type: 'activate',
      completedAt: '2026-06-01T12:00:00.000Z',
      localDate: '2026-06-01',
      weekKey: '2026-W23',
      weekStart: '2026-06-01',
      weekdayIndex: 1,
      hourOfDay: 9,
      timeOfDay: 'morning',
    },
  ];

  it('counts only the current week usage', () => {
    expect(getWeeklyPrimeUsage(history, currentDate)).toEqual({
      focusUsed: 2,
      deepUsed: 1,
      totalUsed: 3,
      weekKey,
    });
  });

  it('applies the weekly free focus limit', () => {
    const allowance = getPrimeSessionAllowance({
      tier: 'free',
      kind: 'focus',
      primingHistory: [
        ...history,
        {
          id: 'focus-3',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-18T12:00:00.000Z',
          localDate: '2026-06-18',
          weekKey,
          weekStart: '2026-06-15',
          weekdayIndex: 3,
          hourOfDay: 7,
          timeOfDay: 'morning',
        },
        {
          id: 'focus-4',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-19T12:00:00.000Z',
          localDate: '2026-06-19',
          weekKey,
          weekStart: '2026-06-15',
          weekdayIndex: 4,
          hourOfDay: 7,
          timeOfDay: 'morning',
        },
        {
          id: 'focus-5',
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-06-20T12:00:00.000Z',
          localDate: '2026-06-20',
          weekKey,
          weekStart: '2026-06-15',
          weekdayIndex: 5,
          hourOfDay: 7,
          timeOfDay: 'morning',
        },
      ],
      now: currentDate,
    });

    expect(allowance.isAllowed).toBe(false);
    expect(allowance.remaining).toBe(0);
    expect(allowance.limit).toBe(5);
  });

  it('leaves pro users unlimited', () => {
    const allowance = getPrimeSessionAllowance({
      tier: 'pro',
      kind: 'deep',
      primingHistory: history,
      now: currentDate,
    });

    expect(allowance.hasUnlimitedAccess).toBe(true);
    expect(allowance.isAllowed).toBe(true);
    expect(allowance.remaining).toBe(Infinity);
  });

  it('leaves trial users unlimited', () => {
    const allowance = getPrimeSessionAllowance({
      tier: 'trial',
      kind: 'focus',
      primingHistory: history,
      now: currentDate,
    });

    expect(allowance.hasUnlimitedAccess).toBe(true);
    expect(allowance.isAllowed).toBe(true);
    expect(allowance.remaining).toBe(Infinity);
  });

  it('skips enforcement when limits are inactive', () => {
    const allowance = getPrimeSessionAllowance({
      tier: 'free',
      kind: 'deep',
      primingHistory: [
        ...history,
        {
          id: 'deep-2',
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: '2026-06-18T16:00:00.000Z',
          localDate: '2026-06-18',
          weekKey,
          weekStart: '2026-06-15',
          weekdayIndex: 3,
          hourOfDay: 11,
          timeOfDay: 'morning',
        },
      ],
      now: currentDate,
      enforceLimits: false,
    });

    expect(allowance.hasUnlimitedAccess).toBe(true);
    expect(allowance.isAllowed).toBe(true);
  });
});
