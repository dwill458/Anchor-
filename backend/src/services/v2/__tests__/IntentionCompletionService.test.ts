const mockPrisma = {
  anchor: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

import { intentionCompletionService } from '../IntentionCompletionService';

describe('IntentionCompletionService (CCR-1)', () => {
  const USER_ID = 'user-1';
  const OTHER_USER = 'user-2';
  const ANCHOR_ID = 'anchor-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owner can mark intention complete with server timestamp and completed lifecycleState', async () => {
    const originalCreatedAt = new Date('2026-08-15T12:00:00.000Z');
    mockPrisma.anchor.findFirst.mockResolvedValueOnce({
      id: ANCHOR_ID,
      userId: USER_ID,
      intentionText: 'I am calm and grounded',
      category: 'spirituality',
      isArchived: false,
      intentionCompletedAt: null,
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    });

    const completionTime = new Date('2026-09-08T00:00:00.000Z');
    mockPrisma.anchor.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await intentionCompletionService.completeIntention(
      USER_ID,
      ANCHOR_ID,
      completionTime
    );

    expect(result.id).toBe(ANCHOR_ID);
    expect(result.lifecycleState).toBe('completed');
    expect(result.isArchived).toBe(false); // Does NOT release or delete the Anchor!
    expect(result.intentionCompletedAt).toBe(completionTime.toISOString());
    expect(mockPrisma.anchor.updateMany).toHaveBeenCalledWith({
      where: { id: ANCHOR_ID, userId: USER_ID, isArchived: false, intentionCompletedAt: null },
      data: {
        intentionCompletedAt: completionTime,
      },
    });
  });

  it('repeated requests are idempotent and preserve original completion timestamp', async () => {
    const originalCompletion = new Date('2026-09-01T15:30:00.000Z');
    mockPrisma.anchor.findFirst.mockResolvedValueOnce({
      id: ANCHOR_ID,
      userId: USER_ID,
      intentionText: 'I finish what I start',
      category: 'career',
      isArchived: false,
      intentionCompletedAt: originalCompletion,
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      updatedAt: originalCompletion,
    });

    const result = await intentionCompletionService.completeIntention(USER_ID, ANCHOR_ID);

    expect(result.lifecycleState).toBe('completed');
    expect(result.intentionCompletedAt).toBe(originalCompletion.toISOString());
    // update should NOT be called again
    expect(mockPrisma.anchor.updateMany).not.toHaveBeenCalled();
  });

  it('rejects completion if caller is not the anchor owner', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValueOnce(null);

    await expect(
      intentionCompletionService.completeIntention(OTHER_USER, ANCHOR_ID)
    ).rejects.toThrow('Anchor not found');
  });

  it('rejects completion if anchor is already released/archived', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValueOnce({
      id: ANCHOR_ID,
      userId: USER_ID,
      isArchived: true,
      intentionCompletedAt: null,
    });

    await expect(intentionCompletionService.completeIntention(USER_ID, ANCHOR_ID)).rejects.toThrow(
      'Cannot complete intention on an archived/released anchor'
    );
  });

  it('returns authoritative lifecycle state correctly across active, completed, and released', async () => {
    // 1. active
    mockPrisma.anchor.findFirst.mockResolvedValueOnce({
      id: ANCHOR_ID,
      isArchived: false,
      intentionCompletedAt: null,
    });
    const state1 = await intentionCompletionService.getLifecycleState(USER_ID, ANCHOR_ID);
    expect(state1.lifecycleState).toBe('active');

    // 2. completed
    mockPrisma.anchor.findFirst.mockResolvedValueOnce({
      id: ANCHOR_ID,
      isArchived: false,
      intentionCompletedAt: new Date('2026-09-07T00:00:00.000Z'),
    });
    const state2 = await intentionCompletionService.getLifecycleState(USER_ID, ANCHOR_ID);
    expect(state2.lifecycleState).toBe('completed');

    // 3. released
    mockPrisma.anchor.findFirst.mockResolvedValueOnce({
      id: ANCHOR_ID,
      isArchived: true,
      intentionCompletedAt: new Date('2026-09-07T00:00:00.000Z'),
    });
    const state3 = await intentionCompletionService.getLifecycleState(USER_ID, ANCHOR_ID);
    expect(state3.lifecycleState).toBe('released');
  });
});
