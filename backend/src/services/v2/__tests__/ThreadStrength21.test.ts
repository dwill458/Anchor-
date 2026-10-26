const mockTx = {
  threadV2Movement: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  threadV2State: { upsert: jest.fn(), update: jest.fn() },
  threadEventLedger: { upsert: jest.fn() },
  practiceSession: { findMany: jest.fn(), count: jest.fn() },
  userSettings: { findUnique: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn(),
  practiceSession: { findFirst: jest.fn(), findMany: jest.fn() },
  anchor: { findFirst: jest.fn() },
  threadV2Movement: { findMany: jest.fn() },
  threadV2State: { upsert: jest.fn(), findUnique: jest.fn() },
  userSettings: { findUnique: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

import {
  ThreadStrengthService,
  replayThreadStrength,
  ACTIVATION_BONUS,
  ReplayMovement,
  LegacyBaseline,
} from '../ThreadStrengthService';
import { selectLegacyBaseline } from '../../../scripts/restoreLegacyThreadStrength';

function dayKey(n: number): string {
  return new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
}

/** Simulate one practice of `seconds` per day for `days` days, activation on the first. */
function simulateDaily(seconds: number, days: number) {
  const movements: ReplayMovement[] = [];
  const dateKeyBySession = new Map<string, string>();
  const durationBySession = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const id = `s${i}`;
    movements.push({ sessionId: id, practiceType: 'focus', completedAt: new Date(`${dayKey(i)}T12:00:00Z`) });
    dateKeyBySession.set(id, dayKey(i));
    durationBySession.set(id, seconds);
  }
  return replayThreadStrength(movements, {
    dateKeyBySession,
    durationBySession,
    fallbackTimeZone: 'UTC',
    restDays: [],
    sensitivity: 'balanced',
    activationSessionId: 's0',
  });
}

describe('Thread Strength 2.1 — activation bonus', () => {
  it.each([
    [10, 13.5833],
    [30, 13.75],
    [60, 14],
    [180, 15],
    [300, 16],
    [600, 18.5],
  ])('first %is practice lands at %f', (seconds, expected) => {
    const { steps } = simulateDaily(seconds, 1);
    expect(steps[0].afterStrength).toBeCloseTo(expected, 3);
    expect(steps[0].activationBonus).toBe(ACTIVATION_BONUS);
  });

  it('second practice does not award activation again', () => {
    const { steps } = simulateDaily(60, 2);
    expect(steps[1].activationBonus).toBe(0);
    expect(steps[1].delta).toBe(2);
  });

  it('release never receives or consumes activation', () => {
    const { steps } = replayThreadStrength(
      [{ sessionId: 'r', practiceType: 'release', completedAt: new Date('2026-01-01T12:00:00Z') }],
      {
        dateKeyBySession: new Map([['r', '2026-01-01']]),
        durationBySession: new Map([['r', 300]]),
        fallbackTimeZone: 'UTC',
        restDays: [],
        sensitivity: 'balanced',
        activationSessionId: 'r',
      }
    );
    expect(steps[0].afterStrength).toBe(0);
  });

  it('session spamming cannot bypass the daily cap (activation is added once)', () => {
    const movements: ReplayMovement[] = Array.from({ length: 30 }, (_, i) => ({
      sessionId: `x${i}`,
      practiceType: 'focus',
      completedAt: new Date(Date.UTC(2026, 0, 1, 8, i)),
    }));
    const dateKeyBySession = new Map(movements.map(m => [m.sessionId, '2026-01-01']));
    const durationBySession = new Map(movements.map(m => [m.sessionId, 300]));
    const { strength } = replayThreadStrength(movements, {
      dateKeyBySession,
      durationBySession,
      fallbackTimeZone: 'UTC',
      restDays: [],
      sensitivity: 'balanced',
      activationSessionId: 'x0',
    });
    // 12 + 1.5 + 10 capped minutes * 0.5 = 18.5
    expect(strength).toBe(18.5);
  });

  it.each([
    [10, 56],
    [30, 51],
    [60, 44],
    [180, 30],
    [300, 22],
    [600, 14],
  ])('%is/day reaches 100 on day %i and never exceeds 100', (seconds, expectedDay) => {
    const reached = (d: number) => simulateDaily(seconds, d).strength ?? 0;
    expect(reached(expectedDay - 1)).toBeLessThan(100);
    expect(reached(expectedDay)).toBe(100);
    expect(reached(expectedDay + 10)).toBe(100);
  });

  it('reaching zero through decay does not re-arm activation', () => {
    const { steps, strength } = replayThreadStrength(
      [
        { sessionId: 'a', practiceType: 'focus', completedAt: new Date('2026-01-01T12:00:00Z') },
        { sessionId: 'b', practiceType: 'focus', completedAt: new Date('2026-03-01T12:00:00Z') },
      ],
      {
        dateKeyBySession: new Map([
          ['a', '2026-01-01'],
          ['b', '2026-03-01'],
        ]),
        durationBySession: new Map([
          ['a', 60],
          ['b', 60],
        ]),
        fallbackTimeZone: 'UTC',
        restDays: [],
        sensitivity: 'strict',
        activationSessionId: 'a',
      }
    );
    expect(steps[1].beforeStrength).toBe(0);
    expect(steps[1].activationBonus).toBe(0);
    expect(strength).toBe(2);
  });
});

describe('Thread Strength 2.1 — legacy baseline replay', () => {
  const baseline: LegacyBaseline = {
    strength: 79,
    completedAt: new Date('2026-10-20T12:00:00Z'),
    dateKey: '2026-10-20',
  };
  const ctx = (extra: Partial<Parameters<typeof replayThreadStrength>[1]> = {}) => ({
    dateKeyBySession: new Map([
      ['old1', '2026-10-19'],
      ['old2', '2026-10-20'],
      ['new1', '2026-10-21'],
      ['sameDay', '2026-10-20'],
    ]),
    durationBySession: new Map([
      ['old1', 300],
      ['old2', 300],
      ['new1', 60],
      ['sameDay', 300],
    ]),
    fallbackTimeZone: 'UTC',
    restDays: [] as number[],
    sensitivity: 'balanced' as const,
    activationSessionId: null,
    baseline,
    ...extra,
  });

  it('preserves the protected baseline and does not re-earn covered sessions', () => {
    const res = replayThreadStrength(
      [
        { sessionId: 'old1', practiceType: 'focus', completedAt: new Date('2026-10-19T12:00:00Z') },
        { sessionId: 'old2', practiceType: 'focus', completedAt: new Date('2026-10-20T12:00:00Z') },
      ],
      ctx()
    );
    expect(res.steps).toHaveLength(0);
    expect(res.strength).toBe(79);
  });

  it('adds post-baseline practice with the 2.1 formula and no activation', () => {
    const res = replayThreadStrength(
      [
        { sessionId: 'old2', practiceType: 'focus', completedAt: new Date('2026-10-20T12:00:00Z') },
        { sessionId: 'new1', practiceType: 'focus', completedAt: new Date('2026-10-21T12:00:00Z') },
      ],
      ctx()
    );
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0].activationBonus).toBe(0);
    expect(res.steps[0].afterStrength).toBe(81);
  });

  it('applies normal decay after the baseline', () => {
    const res = replayThreadStrength(
      [{ sessionId: 'new1', practiceType: 'focus', completedAt: new Date('2026-10-25T12:00:00Z') }],
      ctx({ dateKeyBySession: new Map([['new1', '2026-10-25']]) })
    );
    // 4 missed days (21-24), balanced grace 1 => 3 decay days => 79 - 9 = 70, then +2.
    expect(res.steps[0].beforeStrength).toBe(70);
    expect(res.steps[0].afterStrength).toBe(72);
  });

  it('does not re-credit the daily bonus or minutes already used on the baseline day', () => {
    const res = replayThreadStrength(
      [
        { sessionId: 'old2', practiceType: 'focus', completedAt: new Date('2026-10-20T12:00:00Z') },
        { sessionId: 'sameDay', practiceType: 'focus', completedAt: new Date('2026-10-20T18:00:00Z') },
      ],
      ctx()
    );
    expect(res.steps[0].delta).toBe(2.5); // daily bonus consumed; 5 of 10 minutes already used
    expect(res.steps[0].afterStrength).toBeCloseTo(81.5, 3);
  });

  it('is deterministic: replaying twice yields the same result', () => {
    const movements = [
      { sessionId: 'old2', practiceType: 'focus', completedAt: new Date('2026-10-20T12:00:00Z') },
      { sessionId: 'new1', practiceType: 'focus', completedAt: new Date('2026-10-21T12:00:00Z') },
    ];
    expect(replayThreadStrength(movements, ctx())).toEqual(replayThreadStrength(movements, ctx()));
  });
});

describe('selectLegacyBaseline', () => {
  const cutoff = new Date('2026-10-25T00:00:00Z');
  const session = (over: Record<string, unknown> = {}) => ({
    id: 'sess-1',
    userId: 'u1',
    anchorId: 'a1',
    completedAt: new Date('2026-10-20T12:00:00Z'),
    localDateKey: '2026-10-20',
    timeZone: 'UTC',
    completionStatus: 'completed',
    ...over,
  });
  const event = (over: Record<string, unknown> = {}) => ({
    id: 'ev-1',
    occurredAt: new Date('2026-10-20T12:00:00Z'),
    createdAt: new Date('2026-10-20T12:00:01Z'),
    ledgerSequence: 10,
    sourceEntityId: 'sess-1',
    metadata: { afterStrength: 79 },
    ...over,
  });
  const run = (events: ReturnType<typeof event>[], sessions = [session()]) =>
    selectLegacyBaseline({
      userId: 'u1',
      anchorId: 'a1',
      cutoff,
      events,
      sessionsById: new Map(sessions.map(s => [s.id, s])),
    });

  it('restores the last pre-cutoff authoritative value', () => {
    const res = run([
      event({ id: 'ev-0', ledgerSequence: 9, occurredAt: new Date('2026-10-19T12:00:00Z'), metadata: { afterStrength: 70 } }),
      event(),
    ]);
    expect(res).toMatchObject({ ok: true, sessionId: 'sess-1', source: 'thread_event_ledger:ev-1' });
    if (res.ok) expect(res.baseline.strength).toBe(79);
  });

  it('ignores events created at or after the 2.0 recalculation', () => {
    const res = run([event({ createdAt: new Date('2026-10-25T00:00:00Z') })]);
    expect(res).toEqual({ ok: false, reason: 'no_pre_cutoff_ledger_event' });
  });

  it('never attributes another anchor\'s session', () => {
    const res = run([event()], [session({ anchorId: 'other' })]);
    expect(res).toEqual({ ok: false, reason: 'source_session_belongs_to_other_anchor' });
  });

  it.each([[undefined], [NaN], [150], [-1], ['79']])('rejects invalid afterStrength %p', bad => {
    const res = run([event({ metadata: { afterStrength: bad } })]);
    expect(res.ok).toBe(false);
  });
});

describe('Thread Strength 2.1 — transactional activation', () => {
  const service = new ThreadStrengthService();
  const completedAt = new Date('2026-09-07T12:00:00.000Z');
  const input = {
    userId: 'user-1',
    anchorId: 'anchor-1',
    practiceType: 'focus' as const,
    durationSeconds: 60,
    completedAt,
    sessionId: 'session-1',
    mode: 'authoritative' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx));
    mockTx.threadV2Movement.findUnique.mockResolvedValue(null);
    mockTx.threadV2Movement.create.mockResolvedValue({ id: 'movement-new' });
    mockTx.threadV2Movement.findMany.mockResolvedValue([]);
    mockTx.threadV2Movement.update.mockResolvedValue({});
    mockTx.threadV2State.upsert.mockResolvedValue({ activationStatus: null, activationSessionId: null });
    mockTx.threadV2State.update.mockResolvedValue({});
    mockTx.threadEventLedger.upsert.mockResolvedValue({});
    mockTx.practiceSession.findMany.mockResolvedValue([]);
    mockTx.practiceSession.count.mockResolvedValue(0);
    mockTx.userSettings.findUnique.mockResolvedValue({
      threadStrengthSensitivity: 'balanced',
      decayPreferencesHistory: null,
      restDays: [],
    });
  });

  it('awards +12 on the first completed practice and persists the activation state', async () => {
    const movement = await service.calculatePracticeCompletion(input);
    expect(movement.afterStrength).toBe(14);
    expect(movement.activationBonus).toBe(12);
    expect(mockTx.threadV2State.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activationStatus: 'awarded',
          activationSessionId: 'session-1',
          strength: 14,
        }),
      })
    );
  });

  it('does not award activation when the anchor already has earlier practice', async () => {
    mockTx.practiceSession.count.mockResolvedValue(1);
    const movement = await service.calculatePracticeCompletion(input);
    expect(movement.activationBonus).toBe(0);
    expect(movement.afterStrength).toBe(2);
    expect(mockTx.threadV2State.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ activationStatus: 'legacy_exempt' }) })
    );
  });

  it('never re-awards when the state is already decided (reinstall / new device / zero strength)', async () => {
    mockTx.threadV2State.upsert.mockResolvedValue({
      activationStatus: 'awarded',
      activationSessionId: 'session-0',
    });
    mockTx.threadV2Movement.findMany.mockResolvedValue([
      {
        id: 'm0',
        userId: 'user-1',
        anchorId: 'anchor-1',
        sessionId: 'session-0',
        practiceType: 'focus',
        completedAt: new Date('2026-06-01T12:00:00Z'),
        beforeStrength: 0,
        afterStrength: 14,
        delta: 14,
        activationBonus: 12,
      },
    ]);
    const movement = await service.calculatePracticeCompletion(input);
    expect(movement.activationBonus).toBe(0);
  });

  it('duplicate completion events return the stored movement without creating another', async () => {
    mockTx.threadV2Movement.findUnique.mockResolvedValue({
      userId: 'user-1',
      anchorId: 'anchor-1',
      beforeStrength: 0,
      afterStrength: 14,
      delta: 14,
      activationBonus: 12,
    });
    const movement = await service.calculatePracticeCompletion(input);
    expect(movement).toMatchObject({ idempotent: true, activationBonus: 12, afterStrength: 14 });
    expect(mockTx.threadV2Movement.create).not.toHaveBeenCalled();
  });

  it('runs inside a serializable transaction so concurrent completions cannot both claim it', async () => {
    await service.calculatePracticeCompletion(input);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });
});
