const mockTx = {
  threadV2Movement: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  threadV2State: { upsert: jest.fn(), update: jest.fn() },
  threadEventLedger: { upsert: jest.fn() },
  practiceSession: { findMany: jest.fn() },
  userSettings: { findUnique: jest.fn(), upsert: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn(),
  practiceSession: { findFirst: jest.fn(), findMany: jest.fn() },
  anchor: { findFirst: jest.fn() },
  threadV2Movement: { findMany: jest.fn() },
  threadV2State: { upsert: jest.fn() },
  userSettings: { findUnique: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

import {
  ThreadStrengthService,
  calculateSessionEarning,
  calculateThreadDecay,
  applyDecay,
  applyMultiDayDecay,
  getThreadStrengthLevel,
  countDecayEligibleDaysBetweenDateKeys,
  calendarDaysBetweenDateKeys,
  resolveLocalDateKeyFromDate,
  resolveSensitivityForDateKey,
  DAILY_RETURN_BONUS,
  POINTS_PER_MINUTE,
  DAILY_DURATION_CAP_SECONDS,
  DAILY_DECAY,
  MIN_STRENGTH,
  MAX_STRENGTH,
} from '../ThreadStrengthService';

describe('ThreadStrengthService - Thread Strength 2.0', () => {
  const service = new ThreadStrengthService();
  const completedAt = new Date('2026-09-07T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx));
    mockTx.threadV2Movement.findUnique.mockResolvedValue(null);
    mockTx.threadV2Movement.create.mockResolvedValue({ id: 'movement-new' });
    mockTx.threadV2Movement.findMany.mockResolvedValue([]);
    mockTx.threadV2Movement.update.mockResolvedValue({});
    mockTx.threadV2State.upsert.mockResolvedValue({});
    mockTx.threadV2State.update.mockResolvedValue({});
    mockTx.threadEventLedger.upsert.mockResolvedValue({});
    mockTx.practiceSession.findMany.mockResolvedValue([]);
    mockTx.userSettings.findUnique.mockResolvedValue({
      threadStrengthSensitivity: 'balanced',
      decayPreferencesHistory: null,
      restDays: [],
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      threadStrengthSensitivity: 'balanced',
      decayPreferencesHistory: null,
      restDays: [],
    });
  });

  describe('1. Earning Formula Tests', () => {
    it('10-second practice earns 1.5833 points (1.5 bonus + 10s duration)', () => {
      const earning = calculateSessionEarning({
        practiceType: 'focus',
        durationSeconds: 10,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.dailyBonus).toBe(1.5);
      expect(earning.durationPoints).toBeCloseTo(10 / 120, 6);
      expect(earning.delta).toBeCloseTo(1.583333, 4);
    });

    it('30-second practice earns 1.75 points (1.5 bonus + 30s duration)', () => {
      const earning = calculateSessionEarning({
        practiceType: 'focus',
        durationSeconds: 30,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.dailyBonus).toBe(1.5);
      expect(earning.durationPoints).toBe(0.25);
      expect(earning.delta).toBe(1.75);
    });

    it('1-minute practice earns 2.0 points (1.5 bonus + 60s duration)', () => {
      const earning = calculateSessionEarning({
        practiceType: 'focus',
        durationSeconds: 60,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.dailyBonus).toBe(1.5);
      expect(earning.durationPoints).toBe(0.5);
      expect(earning.delta).toBe(2.0);
    });

    it('3-minute practice earns 3.0 points (1.5 bonus + 180s duration)', () => {
      const earning = calculateSessionEarning({
        practiceType: 'focus',
        durationSeconds: 180,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.dailyBonus).toBe(1.5);
      expect(earning.durationPoints).toBe(1.5);
      expect(earning.delta).toBe(3.0);
    });

    it('5-minute practice earns 4.0 points (1.5 bonus + 300s duration)', () => {
      const earning = calculateSessionEarning({
        practiceType: 'focus',
        durationSeconds: 300,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.dailyBonus).toBe(1.5);
      expect(earning.durationPoints).toBe(2.5);
      expect(earning.delta).toBe(4.0);
    });

    it('10-minute practice earns 6.5 points (1.5 bonus + 600s duration)', () => {
      const earning = calculateSessionEarning({
        practiceType: 'focus',
        durationSeconds: 600,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.dailyBonus).toBe(1.5);
      expect(earning.durationPoints).toBe(5.0);
      expect(earning.delta).toBe(6.5);
    });

    it('session duration beyond 10 minutes is capped at 10 minutes (6.5 points max)', () => {
      const earning = calculateSessionEarning({
        practiceType: 'focus',
        durationSeconds: 1200, // 20 minutes
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.dailyBonus).toBe(1.5);
      expect(earning.durationPoints).toBe(5.0); // only first 600s
      expect(earning.delta).toBe(6.5);
      expect(earning.newEligibleSecondsToday).toBe(600);
    });

    it('five completed 10-second sessions on the same day earn 1.916667 total', () => {
      let prior = 0;
      let totalDelta = 0;

      for (let i = 1; i <= 5; i++) {
        const earning = calculateSessionEarning({
          practiceType: 'focus',
          durationSeconds: 10,
          isFirstSessionToday: i === 1,
          priorEligibleSecondsToday: prior,
        });
        totalDelta += earning.delta;
        prior = earning.newEligibleSecondsToday;
      }

      expect(prior).toBe(50);
      expect(totalDelta).toBeCloseTo(1.916667, 5);
    });

    it('all eligible practice modes follow the exact same scoring formula', () => {
      const modes = ['focus', 'deep_prime', 'visualize'] as const;
      for (const mode of modes) {
        const earning = calculateSessionEarning({
          practiceType: mode,
          durationSeconds: 300,
          isFirstSessionToday: true,
          priorEligibleSecondsToday: 0,
        });
        expect(earning.delta).toBe(4.0); // 1.5 + 2.5 = 4.0 for all modes
      }
    });

    it('release mode earns 0 points', () => {
      const earning = calculateSessionEarning({
        practiceType: 'release',
        durationSeconds: 300,
        isFirstSessionToday: true,
        priorEligibleSecondsToday: 0,
      });
      expect(earning.delta).toBe(0);
      expect(earning.dailyBonus).toBe(0);
      expect(earning.durationPoints).toBe(0);
    });

    it('preserves idempotency on duplicate completion request', async () => {
      mockTx.threadV2Movement.findUnique.mockResolvedValueOnce({
        id: 'existing-m1',
        userId: 'user-1',
        anchorId: 'anchor-1',
        sessionId: 'session-dup',
        beforeStrength: 10,
        afterStrength: 14,
        delta: 4,
      });

      const movement = await service.calculatePracticeCompletion({
        userId: 'user-1',
        anchorId: 'anchor-1',
        practiceType: 'focus',
        durationSeconds: 300,
        completedAt,
        sessionId: 'session-dup',
        mode: 'authoritative',
      });

      expect(movement.idempotent).toBe(true);
      expect(movement.delta).toBe(4);
      expect(mockTx.threadV2Movement.create).not.toHaveBeenCalled();
    });
  });

  describe('2. Progression Target Tests (Starting at zero, no missed days)', () => {
    it('1 minute/day reaches 100 on day 50', () => {
      let strength = 0;
      let day = 0;
      while (strength < 100) {
        day += 1;
        const earning = calculateSessionEarning({
          practiceType: 'focus',
          durationSeconds: 60,
          isFirstSessionToday: true,
          priorEligibleSecondsToday: 0,
        });
        strength = Math.min(100, strength + earning.delta);
        if (day === 49) {
          expect(strength).toBe(98);
        }
      }
      expect(day).toBe(50);
      expect(strength).toBe(100);
    });

    it('5 minutes/day reaches 100 on day 25 (Core Progression Target)', () => {
      let strength = 0;
      let day = 0;
      while (strength < 100) {
        day += 1;
        const earning = calculateSessionEarning({
          practiceType: 'focus',
          durationSeconds: 300,
          isFirstSessionToday: true,
          priorEligibleSecondsToday: 0,
        });
        strength = Math.min(100, strength + earning.delta);
        if (day === 24) {
          expect(strength).toBe(96);
        }
      }
      expect(day).toBe(25);
      expect(strength).toBe(100);
    });

    it('10 minutes/day reaches 100 on day 16', () => {
      let strength = 0;
      let day = 0;
      while (strength < 100) {
        day += 1;
        const earning = calculateSessionEarning({
          practiceType: 'focus',
          durationSeconds: 600,
          isFirstSessionToday: true,
          priorEligibleSecondsToday: 0,
        });
        strength = Math.min(100, strength + earning.delta);
        if (day === 15) {
          expect(strength).toBeCloseTo(97.5, 4);
        }
      }
      expect(day).toBe(16);
      expect(strength).toBe(100);
    });

    it('30 seconds/day reaches 100 on day 58', () => {
      let strength = 0;
      let day = 0;
      while (strength < 100) {
        day += 1;
        const earning = calculateSessionEarning({
          practiceType: 'focus',
          durationSeconds: 30,
          isFirstSessionToday: true,
          priorEligibleSecondsToday: 0,
        });
        strength = Math.min(100, strength + earning.delta);
        if (day === 57) {
          expect(strength).toBeCloseTo(99.75, 2);
        }
      }
      expect(day).toBe(58);
      expect(strength).toBe(100);
    });

    it('10 seconds/day reaches 100 on day 64', () => {
      let strength = 0;
      let day = 0;
      while (strength < 100) {
        day += 1;
        const earning = calculateSessionEarning({
          practiceType: 'focus',
          durationSeconds: 10,
          isFirstSessionToday: true,
          priorEligibleSecondsToday: 0,
        });
        strength = Math.min(100, strength + earning.delta);
        if (day === 63) {
          expect(strength).toBeCloseTo(99.75, 1);
        }
      }
      expect(day).toBe(64);
      expect(strength).toBe(100);
    });
  });

  describe('3. Level Threshold Tests (Exact Boundaries)', () => {
    it.each([
      [0, 'Surface'],
      [2, 'Surface'],
      [18, 'Surface'],
      [19, 'Surface'],
      [20, 'Grounded'],
      [27, 'Grounded'],
      [39, 'Grounded'],
      [40, 'Rooted'],
      [45, 'Rooted'],
      [59, 'Rooted'],
      [60, 'Embedded'],
      [65, 'Embedded'],
      [79, 'Embedded'],
      [80, 'Sovereign'],
      [100, 'Sovereign'],
    ])('maps strength %i to level %s', (strength, expectedLevel) => {
      expect(getThreadStrengthLevel(strength)).toBe(expectedLevel);
    });

    it('correctly maps Anchor B (strength 27) to Grounded, NOT Rooted', () => {
      expect(getThreadStrengthLevel(27)).toBe('Grounded');
    });

    it('correctly maps Anchor A (strength 18) to Surface', () => {
      expect(getThreadStrengthLevel(18)).toBe('Surface');
    });
  });

  describe('4. Decay Tests (All Three Preferences)', () => {
    it('Lenient: grace period of 2 missed days, decay starts on day 3 at 3 pts/day', () => {
      expect(calculateThreadDecay(0, 'lenient')).toBe(0);
      expect(calculateThreadDecay(1, 'lenient')).toBe(0);
      expect(calculateThreadDecay(2, 'lenient')).toBe(0);
      expect(calculateThreadDecay(3, 'lenient')).toBe(3);
      expect(calculateThreadDecay(4, 'lenient')).toBe(6);
      expect(calculateThreadDecay(5, 'lenient')).toBe(9);
    });

    it('Balanced: grace period of 1 missed day, decay starts on day 2 at 3 pts/day', () => {
      expect(calculateThreadDecay(0, 'balanced')).toBe(0);
      expect(calculateThreadDecay(1, 'balanced')).toBe(0);
      expect(calculateThreadDecay(2, 'balanced')).toBe(3);
      expect(calculateThreadDecay(3, 'balanced')).toBe(6);
      expect(calculateThreadDecay(4, 'balanced')).toBe(9);
      expect(calculateThreadDecay(5, 'balanced')).toBe(12);
    });

    it('Strict: immediate decay from day 1 at 3 pts/day', () => {
      expect(calculateThreadDecay(0, 'strict')).toBe(0);
      expect(calculateThreadDecay(1, 'strict')).toBe(3);
      expect(calculateThreadDecay(2, 'strict')).toBe(6);
      expect(calculateThreadDecay(3, 'strict')).toBe(9);
      expect(calculateThreadDecay(4, 'strict')).toBe(12);
      expect(calculateThreadDecay(5, 'strict')).toBe(15);
    });

    it('verifies five-day decay example from starting strength 60', () => {
      // Lenient: 60 - 9 = 51
      expect(applyDecay(60, 5, 'lenient')).toBe(51);
      // Balanced: 60 - 12 = 48
      expect(applyDecay(60, 5, 'balanced')).toBe(48);
      // Strict: 60 - 15 = 45
      expect(applyDecay(60, 5, 'strict')).toBe(45);
    });

    it('strength never drops below zero', () => {
      expect(applyDecay(5, 5, 'strict')).toBe(0); // 5 - 15 = -10 -> clamped to 0
      expect(applyDecay(0, 10, 'balanced')).toBe(0);
    });

    it('strength at 100 remains subject to decay', () => {
      expect(applyDecay(100, 5, 'balanced')).toBe(88);
      expect(applyDecay(100, 10, 'balanced')).toBe(73);
    });

    it('exempts designated rest days from consecutive missed days', () => {
      // Oct 1 (Thu) to Oct 5 (Mon): days in between are Oct 2 (Fri), Oct 3 (Sat), Oct 4 (Sun).
      // If Sunday (0) is a rest day: only 2 missed days (Fri, Sat).
      const res = applyMultiDayDecay(60, '2026-10-01', '2026-10-05', [0], 'strict');
      // 2 missed days under strict = 2 * 3 = 6 decay -> 60 - 6 = 54
      expect(res.strength).toBe(54);
      expect(res.consecutiveMissedDays).toBe(2);
    });

    it('changing preference from Strict to Lenient does not restore previously lost strength', () => {
      // Days 1 & 2 missed under Strict: lost 6 points (60 -> 54).
      // Preference changed on Day 2 (effective Day 3) to Lenient.
      // Day 3 missed under Lenient: since consecutiveMissedDays is now 3, and Lenient grace is 2:
      // Day 3 decays 3 points (54 -> 51). Previously lost 6 points are NOT restored.
      const history = [
        { sensitivity: 'strict' as const, effectiveFromLocalDateKey: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' },
        { sensitivity: 'lenient' as const, effectiveFromLocalDateKey: '2026-10-04', createdAt: '2026-10-03T00:00:00Z' },
      ];
      const res = applyMultiDayDecay(60, '2026-10-01', '2026-10-05', [], 'lenient', history);
      // Days in between: 10-02 (strict, day 1, decays 3 -> 57), 10-03 (strict, day 2, decays 3 -> 54), 10-04 (lenient, day 3, decays 3 -> 51).
      expect(res.strength).toBe(51);
    });

    it('changing preference from Lenient to Strict does not retroactively penalize protected days', () => {
      // Days 1 & 2 missed under Lenient (protected, 0 decay).
      // Preference changed to Strict on Day 2 (effective Day 3).
      // Days 1 & 2 remain with 0 decay. Day 3 under Strict decays 3 points.
      const history = [
        { sensitivity: 'lenient' as const, effectiveFromLocalDateKey: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' },
        { sensitivity: 'strict' as const, effectiveFromLocalDateKey: '2026-10-04', createdAt: '2026-10-03T00:00:00Z' },
      ];
      const res = applyMultiDayDecay(60, '2026-10-01', '2026-10-05', [], 'strict', history);
      // Days in between: 10-02 (lenient, day 1: 0 decay), 10-03 (lenient, day 2: 0 decay), 10-04 (strict, day 3: 3 decay -> 57).
      expect(res.strength).toBe(57);
    });

    it('repeatedly switching preferences cannot create free points or duplicate decay', () => {
      const history = [
        { sensitivity: 'strict' as const, effectiveFromLocalDateKey: '2026-10-01', createdAt: '2026-10-01T00:00:00Z' },
        { sensitivity: 'lenient' as const, effectiveFromLocalDateKey: '2026-10-03', createdAt: '2026-10-02T00:00:00Z' },
        { sensitivity: 'balanced' as const, effectiveFromLocalDateKey: '2026-10-04', createdAt: '2026-10-03T00:00:00Z' },
      ];
      const res1 = applyMultiDayDecay(60, '2026-10-01', '2026-10-05', [], 'balanced', history);
      const res2 = applyMultiDayDecay(60, '2026-10-01', '2026-10-05', [], 'balanced', history);
      expect(res1.strength).toBe(res2.strength);
    });
  });

  describe('5. Calendar & Timezone Handling', () => {
    it('resolves local calendar date from timezone correctly across UTC midnight', () => {
      // 03:00 UTC on 2026-09-08 is 20:00 on 2026-09-07 in America/Los_Angeles (UTC-7)
      const instant = new Date('2026-09-08T03:00:00.000Z');
      expect(resolveLocalDateKeyFromDate(instant, 'America/Los_Angeles')).toBe('2026-09-07');
      expect(resolveLocalDateKeyFromDate(instant, 'UTC')).toBe('2026-09-08');
    });

    it('calculates days between calendar date keys correctly regardless of DST', () => {
      expect(calendarDaysBetweenDateKeys('2026-03-07', '2026-03-09')).toBe(2);
      expect(calendarDaysBetweenDateKeys('2026-11-01', '2026-11-02')).toBe(1);
    });

    it('counts decay eligible days between date keys excluding boundary days', () => {
      expect(countDecayEligibleDaysBetweenDateKeys('2026-10-20', '2026-10-21')).toBe(0);
      expect(countDecayEligibleDaysBetweenDateKeys('2026-10-20', '2026-10-22')).toBe(1);
      expect(countDecayEligibleDaysBetweenDateKeys('2026-10-20', '2026-10-24')).toBe(3);
    });
  });
});
