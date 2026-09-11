const mockTx = {
  threadV2Movement: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  threadV2State: { upsert: jest.fn(), update: jest.fn() },
  threadEventLedger: { upsert: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn(),
  practiceSession: { findFirst: jest.fn() },
  anchor: { findFirst: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

import { ThreadStrengthService } from '../ThreadStrengthService';

describe('ThreadStrengthService', () => {
  const service = new ThreadStrengthService();
  const completedAt = new Date('2026-09-07T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx));
    mockTx.threadV2Movement.findUnique.mockResolvedValue(null);
    mockTx.threadV2Movement.create.mockResolvedValue({});
    mockTx.threadV2Movement.findMany.mockResolvedValue([
      { id: 'movement-1', sessionId: 'session-1', practiceType: 'focus', completedAt },
    ]);
    mockTx.threadV2Movement.update.mockResolvedValue({});
    mockTx.threadV2State.upsert.mockResolvedValue({});
    mockTx.threadV2State.update.mockResolvedValue({});
    mockTx.threadEventLedger.upsert.mockResolvedValue({});
  });

  it('derives movement from server-recognized completion facts, not client scores', async () => {
    const movement = await service.calculatePracticeCompletion({
      userId: 'user-1',
      anchorId: 'anchor-1',
      practiceType: 'focus',
      completedAt,
      sessionId: 'session-1',
      mode: 'shadow',
    });
    expect(movement).toMatchObject({
      beforeStrength: 50,
      afterStrength: 75,
      delta: 25,
      reason: 'practice_completed',
      idempotent: false,
    });
    expect(mockTx.threadV2Movement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ beforeStrength: 50 }) })
    );
    expect(mockTx.threadV2State.update).toHaveBeenCalled();
  });

  it('does not award a duplicate server-recognized session twice', async () => {
    mockTx.threadV2Movement.findUnique.mockResolvedValue({
      userId: 'user-1',
      anchorId: 'anchor-1',
      beforeStrength: 50,
      afterStrength: 75,
      delta: 25,
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
    expect(mockTx.threadV2Movement.create).not.toHaveBeenCalled();
  });

  it('derives delta7d from replayed server movements, including decay after the latest event', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue({ createdAt: new Date('2026-08-01T00:00:00.000Z') });
    mockPrisma.threadV2Movement = mockTx.threadV2Movement;
    mockTx.threadV2Movement.findMany.mockResolvedValue([
      { sessionId: 'old', practiceType: 'focus', completedAt: new Date('2026-08-31T12:00:00.000Z') },
      { sessionId: 'recent', practiceType: 'deep_prime', completedAt: new Date('2026-09-06T12:00:00.000Z') },
    ]);
    await expect(service.getDelta7d({ userId: 'user-1', anchorId: 'anchor-1', asOf: new Date('2026-09-07T12:00:00.000Z') })).resolves.toBe(-30);
  });

  it('returns unavailable only when the seven-day window or movement evidence is absent', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue({ createdAt: new Date('2026-09-06T12:00:00.000Z') });
    await expect(service.getDelta7d({ userId: 'user-1', anchorId: 'anchor-1', asOf: completedAt })).resolves.toBeNull();
  });
});
