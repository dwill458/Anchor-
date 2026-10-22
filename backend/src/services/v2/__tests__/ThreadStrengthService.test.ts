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
};
const mockPrisma = {
  $transaction: jest.fn(),
  practiceSession: { findFirst: jest.fn(), findMany: jest.fn() },
  anchor: { findFirst: jest.fn() },
  threadV2Movement: { findMany: jest.fn() },
  threadV2State: { upsert: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

import {
  ThreadStrengthService,
  calculateEffectivePracticeGain,
  getSameDayPracticeMultiplier,
  calculateThreadDecay,
  applyDecay,
  countDecayEligibleDaysBetweenDateKeys,
  calendarDaysBetweenDateKeys,
  resolveLocalDateKeyFromDate,
  INITIAL_ESTABLISHED_BASE,
  DORMANT_FLOOR,
  GRACE_DAYS,
  DAILY_DECAY,
} from '../ThreadStrengthService';

describe('ThreadStrengthService', () => {
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
  });

  describe('Core Multipliers and Diminishing Returns', () => {
    it('applies the approved diminishing-returns multiplier schedule', () => {
      expect(getSameDayPracticeMultiplier(1)).toBe(1.0);
      expect(getSameDayPracticeMultiplier(2)).toBe(0.6);
      expect(getSameDayPracticeMultiplier(3)).toBe(0.35);
      expect(getSameDayPracticeMultiplier(4)).toBe(0.2);
      expect(getSameDayPracticeMultiplier(5)).toBe(0.1);
      expect(getSameDayPracticeMultiplier(6)).toBe(0.1);
      expect(getSameDayPracticeMultiplier(10)).toBe(0.1);
    });

    it('does not force a minimum +1 strength increase per session', () => {
      // At strength 50, Focus session 5 has base 7 * 0.1 * (1 - 50/120) = 0.408
      const gain = calculateEffectivePracticeGain(50, 'focus', 5);
      expect(gain.delta).toBeLessThan(1.0);
      expect(gain.delta).toBeGreaterThan(0);
      expect(gain.delta).toBe(0.41);
    });

    it('preserves fractional strength gains across sessions 1 to 10', () => {
      let currentStrength = 50.0;
      const deltas: number[] = [];

      for (let session = 1; session <= 10; session++) {
        const result = calculateEffectivePracticeGain(currentStrength, 'focus', session);
        expect(result.delta).toBeGreaterThan(0);
        deltas.push(result.delta);
        currentStrength = result.afterStrength;
      }

      // Every single session 1 through 10 receives a non-zero reward
      expect(deltas.length).toBe(10);
      expect(deltas[0]).toBe(4.08); // Session 1: 1.00 multiplier
      expect(deltas[1]).toBe(2.31); // Session 2: 0.60 multiplier
      expect(deltas[2]).toBe(1.3); // Session 3: 0.35 multiplier (NOT 0!)
      expect(deltas[3]).toBe(0.73); // Session 4: 0.20 multiplier (NOT 0!)
      expect(deltas[4]).toBe(0.36); // Session 5: 0.10 multiplier (NOT 0!)
      expect(deltas[9]).toBe(0.35); // Session 10: 0.10 multiplier (NOT 0!)

      // Total strength accumulated gracefully without arbitrary cutoff or runaway farming
      expect(currentStrength).toBeCloseTo(60.54, 1);
    });

    it('accumulates fractional gains into whole integer increments', () => {
      let strength = 50.0;
      // Start at 50, doing small sessions (delta ~0.36)
      for (let i = 0; i < 3; i++) {
        const { afterStrength } = calculateEffectivePracticeGain(strength, 'focus', 5);
        strength = afterStrength;
      }
      // 50 + 0.41 + 0.41 + 0.40 = 51.22
      expect(strength).toBeGreaterThan(51.0);
    });

    it('clamps accurately at 100 when approaching ceiling', () => {
      const nearMax = calculateEffectivePracticeGain(99.5, 'focus', 1);
      expect(nearMax.afterStrength).toBe(100);
      expect(nearMax.delta).toBe(0.5);

      const atMax = calculateEffectivePracticeGain(100, 'focus', 1);
      expect(atMax.afterStrength).toBe(100);
      expect(atMax.delta).toBe(0);
    });

    it('handles release mode with zero gain', () => {
      const result = calculateEffectivePracticeGain(50, 'release', 1);
      expect(result.delta).toBe(0);
      expect(result.afterStrength).toBe(50);
    });
  });

  describe('Practice Mode Sequences', () => {
    it('processes Focus followed by Deep Prime correctly', () => {
      const focus1 = calculateEffectivePracticeGain(null, 'focus', 1);
      expect(focus1.beforeStrength).toBe(0);
      expect(focus1.afterStrength).toBe(21.13); // 15 + 6.13

      const deep2 = calculateEffectivePracticeGain(focus1.afterStrength, 'deep_prime', 2);
      expect(deep2.beforeStrength).toBe(21.13);
      // Deep Prime base 11 * 0.60 * (1 - 21.13/120) = 6.6 * 0.8239 = 5.44
      expect(deep2.delta).toBe(5.44);
      expect(deep2.afterStrength).toBe(26.57);
    });

    it('processes Visualize followed by Focus correctly', () => {
      const vis1 = calculateEffectivePracticeGain(30, 'visualize', 1);
      // Visualize base 9 * 1.0 * (1 - 30/120) = 9 * 0.75 = 6.75
      expect(vis1.delta).toBe(6.75);
      expect(vis1.afterStrength).toBe(36.75);

      const focus2 = calculateEffectivePracticeGain(vis1.afterStrength, 'focus', 2);
      // Focus base 7 * 0.6 * (1 - 36.75/120) = 4.2 * 0.69375 = 2.91
      expect(focus2.delta).toBe(2.91);
      expect(focus2.afterStrength).toBe(39.66);
    });
  });

  describe('Timezone & Calendar Date Boundary Handling', () => {
    it('resolves local calendar date from timezone correctly across UTC midnight', () => {
      // 8:00 PM in New York (EDT, UTC-4) on Oct 20 is 00:00 UTC on Oct 21
      const eveningUtc = new Date('2026-10-21T00:30:00.000Z');
      const nyDateKey = resolveLocalDateKeyFromDate(eveningUtc, 'America/New_York');
      expect(nyDateKey).toBe('2026-10-20');

      const utcDateKey = resolveLocalDateKeyFromDate(eveningUtc, 'UTC');
      expect(utcDateKey).toBe('2026-10-21');
    });

    it('calculates days between calendar date keys correctly regardless of DST', () => {
      expect(calendarDaysBetweenDateKeys('2026-10-20', '2026-10-20')).toBe(0);
      expect(calendarDaysBetweenDateKeys('2026-10-20', '2026-10-21')).toBe(1);
      expect(calendarDaysBetweenDateKeys('2026-10-20', '2026-10-24')).toBe(4);
    });

    it('counts decay eligible days between date keys excluding boundary days', () => {
      // Consecutive days: 0 missed days
      expect(countDecayEligibleDaysBetweenDateKeys('2026-10-20', '2026-10-21')).toBe(0);
      // 1 day in between (Oct 21): 1 missed day
      expect(countDecayEligibleDaysBetweenDateKeys('2026-10-20', '2026-10-22')).toBe(1);
      // 3 days in between (Oct 21, 22, 23): 3 missed days
      expect(countDecayEligibleDaysBetweenDateKeys('2026-10-20', '2026-10-24')).toBe(3);
    });

    it('resets same-day session count across local midnight', async () => {
      // Session 1 on 2026-10-20
      mockTx.threadV2Movement.findMany.mockResolvedValue([
        {
          id: 'm1',
          sessionId: 's1',
          practiceType: 'focus',
          completedAt: new Date('2026-10-20T20:00:00.000Z'),
          beforeStrength: 0,
          afterStrength: 21.13,
          delta: 21.13,
        },
      ]);
      mockTx.practiceSession.findMany.mockResolvedValue([
        { id: 's1', localDateKey: '2026-10-20', timeZone: 'America/New_York' },
      ]);

      // Session 2 on 2026-10-21 (next day local time)
      const movement = await service.calculatePracticeCompletion({
        userId: 'u1',
        anchorId: 'a1',
        practiceType: 'focus',
        completedAt: new Date('2026-10-21T14:00:00.000Z'),
        sessionId: 's2',
        localDateKey: '2026-10-21',
        timeZone: 'America/New_York',
        mode: 'authoritative',
      });

      // Session 2 is the FIRST session on 2026-10-21, so it receives multiplier 1.00
      // 21.13 + 7 * 1.0 * (1 - 21.13/120) = 21.13 + 5.77 = 26.90
      expect(movement.delta).toBe(5.77);
      expect(movement.afterStrength).toBe(26.9);
    });
  });

  describe('Decay and Grace Period Handling', () => {
    it('applies no decay within grace period (<= 2 missed days)', () => {
      expect(calculateThreadDecay(0)).toBe(0);
      expect(calculateThreadDecay(1)).toBe(0);
      expect(calculateThreadDecay(2)).toBe(0);
    });

    it('decays by 3 points per day after grace period', () => {
      expect(calculateThreadDecay(3)).toBe(3);
      expect(calculateThreadDecay(4)).toBe(6);
      expect(calculateThreadDecay(5)).toBe(9);
    });

    it('respects dormant floor of 10 points', () => {
      expect(applyDecay(15, 5)).toBe(DORMANT_FLOOR); // 15 - 9 = 6 -> floor 10
      expect(applyDecay(50, 4)).toBe(44); // 50 - 6 = 44
    });
  });

  describe('Service In-Transaction Execution & Idempotency', () => {
    it('derives movement from server-recognized completion facts with fractional precision', async () => {
      const movement = await service.calculatePracticeCompletion({
        userId: 'user-1',
        anchorId: 'anchor-1',
        practiceType: 'focus',
        completedAt,
        sessionId: 'session-1',
        mode: 'shadow',
      });
      expect(movement).toMatchObject({
        beforeStrength: 0,
        afterStrength: 21.13,
        delta: 21.13,
        reason: 'practice_completed',
        idempotent: false,
      });
      expect(mockTx.threadV2Movement.create).toHaveBeenCalled();
      expect(mockTx.threadV2State.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ strength: 21.13 }) })
      );
    });

    it('does not award a duplicate session twice (preserves idempotency)', async () => {
      mockTx.threadV2Movement.findUnique.mockResolvedValue({
        userId: 'user-1',
        anchorId: 'anchor-1',
        beforeStrength: 0,
        afterStrength: 21.13,
        delta: 21.13,
      });
      const movement = await service.calculatePracticeCompletion({
        userId: 'user-1',
        anchorId: 'anchor-1',
        practiceType: 'focus',
        completedAt,
        sessionId: 'session-1',
        mode: 'authoritative',
      });
      expect(movement.idempotent).toBe(true);
      expect(movement.afterStrength).toBe(21.13);
      expect(mockTx.threadV2Movement.create).not.toHaveBeenCalled();
    });

    it('preserves existing historical movements without rewriting them', async () => {
      const pastDate = new Date('2026-09-01T12:00:00.000Z');
      const histMovement = {
        id: 'hist-1',
        userId: 'user-1',
        anchorId: 'anchor-1',
        sessionId: 'session-hist',
        practiceType: 'focus',
        completedAt: pastDate,
        beforeStrength: 0,
        afterStrength: 21.13,
        delta: 21.13,
      };

      mockTx.threadV2Movement.findMany.mockResolvedValue([histMovement]);
      mockTx.practiceSession.findMany.mockResolvedValue([
        { id: 'session-hist', localDateKey: '2026-09-01', timeZone: 'UTC', completedAt: pastDate },
      ]);

      await service.calculatePracticeCompletion({
        userId: 'user-1',
        anchorId: 'anchor-1',
        practiceType: 'focus',
        completedAt: new Date('2026-09-01T15:00:00.000Z'),
        sessionId: 'session-today',
        localDateKey: '2026-09-01',
        timeZone: 'UTC',
        mode: 'authoritative',
      });

      // Historical movement hist-1 should not be updated with altered data
      const updateCalls = mockTx.threadV2Movement.update.mock.calls;
      const histUpdates = updateCalls.filter(call => call[0]?.where?.id === 'hist-1');
      expect(histUpdates.length).toBe(0);
    });

    it('handles out-of-order session inserts by replaying subsequent movements', async () => {
      const date1 = new Date('2026-09-01T10:00:00.000Z');
      const date3 = new Date('2026-09-01T16:00:00.000Z');

      // Existing movement 1 and movement 3
      const m1 = {
        id: 'm1',
        sessionId: 's1',
        practiceType: 'focus',
        completedAt: date1,
        beforeStrength: 0,
        afterStrength: 21.13,
        delta: 21.13,
      };
      const m3 = {
        id: 'm3',
        sessionId: 's3',
        practiceType: 'focus',
        completedAt: date3,
        beforeStrength: 21.13,
        afterStrength: 24.59,
        delta: 3.46,
      };

      mockTx.threadV2Movement.findMany.mockResolvedValue([m1, m3]);
      mockTx.practiceSession.findMany.mockResolvedValue([
        { id: 's1', localDateKey: '2026-09-01', timeZone: 'UTC', completedAt: date1 },
        { id: 's3', localDateKey: '2026-09-01', timeZone: 'UTC', completedAt: date3 },
      ]);

      // Insert delayed session 2 between date1 and date3
      const date2 = new Date('2026-09-01T12:00:00.000Z');
      const movement = await service.calculatePracticeCompletion({
        userId: 'u1',
        anchorId: 'a1',
        practiceType: 'focus',
        completedAt: date2,
        sessionId: 's2',
        localDateKey: '2026-09-01',
        timeZone: 'UTC',
        mode: 'authoritative',
      });

      expect(movement.afterStrength).toBeGreaterThan(21.13);
      // Subsequent movement m3 should have been recomputed since an earlier session was inserted
      const updateCalls = mockTx.threadV2Movement.update.mock.calls;
      const m3Updates = updateCalls.filter(call => call[0]?.where?.id === 'm3');
      expect(m3Updates.length).toBe(1);
    });
  });

  describe('Type Normalization', () => {
    it('normalizes legacy and V2 practice types correctly', () => {
      const { normalizeThreadPracticeType } = require('../ThreadStrengthService');
      expect(normalizeThreadPracticeType('focus')).toBe('focus');
      expect(normalizeThreadPracticeType('deep_prime')).toBe('deep_prime');
      expect(normalizeThreadPracticeType('prime')).toBe('deep_prime');
      expect(normalizeThreadPracticeType('deep')).toBe('deep_prime');
      expect(normalizeThreadPracticeType('visualize')).toBe('visualize');
      expect(normalizeThreadPracticeType('visual')).toBe('visualize');
      expect(normalizeThreadPracticeType('release')).toBe('release');
      expect(normalizeThreadPracticeType('unknown')).toBeNull();
    });
  });
});
