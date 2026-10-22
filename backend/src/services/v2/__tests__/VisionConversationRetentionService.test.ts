const mockTx = {
  $queryRaw: jest.fn(),
  visionCreationSession: { findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
  visionScene: { findFirst: jest.fn() },
  visionGenerationCandidate: { findFirst: jest.fn() },
  visionAppearanceReference: { findFirst: jest.fn() },
  visionGenerationReference: { findFirst: jest.fn() },
  visionGeneration: { findFirst: jest.fn() },
  asset: { findFirst: jest.fn(), deleteMany: jest.fn() },
};
const mockPrisma = {
  $transaction: jest.fn(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
  visionCreationSession: { findMany: jest.fn() },
  visionScene: { findFirst: jest.fn() },
  visionGenerationCandidate: { findFirst: jest.fn() },
  visionAppearanceReference: { findFirst: jest.fn() },
  visionGenerationReference: { findFirst: jest.fn() },
  visionGeneration: { findFirst: jest.fn() },
  asset: { findFirst: jest.fn(), deleteMany: jest.fn() },
};
const mockDeletePrivateImageAsset = jest.fn();

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../StorageService', () => ({
  deletePrivateImageAsset: (...args: unknown[]) => mockDeletePrivateImageAsset(...args),
}));

import { purgeExpiredVisionConversations } from '../VisionConversationRetentionService';

const now = new Date('2026-10-20T12:00:00.000Z');
const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const candidateId = 'candidate-output-asset';
const referenceId = 'uploaded-reference-asset';
const session = {
  id: 'expired-session',
  userId: 'owner-1',
  expiresAt: new Date(cutoff),
  draftReferences: [
    { assetId: referenceId, role: 'inspiration', note: 'extra key proves parsing' },
  ],
  rounds: [
    {
      candidates: [{ assetId: candidateId }],
      references: [{ assetId: referenceId }],
    },
  ],
};

function arrange() {
  jest.clearAllMocks();
  mockPrisma.visionCreationSession.findMany.mockResolvedValue([session]);
  mockTx.visionCreationSession.findUnique.mockResolvedValue(session);
  mockTx.visionCreationSession.findMany.mockResolvedValue([]);
  mockTx.visionCreationSession.delete.mockResolvedValue({});
  mockPrisma.visionScene.findFirst.mockResolvedValue(null);
  mockPrisma.visionGenerationCandidate.findFirst.mockResolvedValue(null);
  mockPrisma.visionAppearanceReference.findFirst.mockResolvedValue(null);
  mockPrisma.visionGenerationReference.findFirst.mockResolvedValue(null);
  mockPrisma.visionGeneration.findFirst.mockResolvedValue(null);
  mockPrisma.asset.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    storageKey: `private/${where.id}.jpg`,
  }));
  mockTx.visionScene.findFirst.mockResolvedValue(null);
  mockTx.visionGenerationCandidate.findFirst.mockResolvedValue(null);
  mockTx.visionAppearanceReference.findFirst.mockResolvedValue(null);
  mockTx.visionGenerationReference.findFirst.mockResolvedValue(null);
  mockTx.visionGeneration.findFirst.mockResolvedValue(null);
  mockTx.asset.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    storageKey: `private/${where.id}.jpg`,
  }));
  mockTx.asset.deleteMany.mockResolvedValue({ count: 1 });
  mockDeletePrivateImageAsset.mockResolvedValue(undefined);
}

describe('VisionConversationRetentionService', () => {
  beforeEach(arrange);

  it('defaults to a read-only dry run and applies the seven-day grace cutoff', async () => {
    mockPrisma.visionCreationSession.findMany.mockResolvedValue([]);

    const result = await purgeExpiredVisionConversations({ now });

    expect(result).toMatchObject({
      dryRun: true,
      sessionsExamined: 0,
      purgedSessionIds: [],
      candidateAssetIdsDeleted: [],
    });
    expect(result.cutoffAt).toBe(cutoff.toISOString());
    expect(mockPrisma.visionCreationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { expiresAt: { lte: cutoff } },
        orderBy: { expiresAt: 'asc' },
        take: 50,
      })
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockDeletePrivateImageAsset).not.toHaveBeenCalled();
  });

  it('reports candidate cleanup and retained references without mutating in dry-run mode', async () => {
    const result = await purgeExpiredVisionConversations({ now });

    expect(result.candidateAssetIdsEligible).toEqual([candidateId]);
    expect(result.retainedReferenceAssetIds).toEqual([referenceId]);
    expect(result.purgedSessionIds).toEqual([]);
    expect(result.candidateAssetIdsDeleted).toEqual([]);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.visionCreationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { expiresAt: { lte: cutoff } },
      })
    );
    expect(mockDeletePrivateImageAsset).not.toHaveBeenCalled();
  });

  it('purges an old session under a row lock and requests storage cleanup only for an unshared owned output', async () => {
    const result = await purgeExpiredVisionConversations({ apply: true, now });

    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mockTx.$queryRaw.mock.calls[1][0][0]).toContain('FROM assets WHERE id = ');
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 30_000,
    });
    expect(mockTx.visionCreationSession.delete).toHaveBeenCalledWith({ where: { id: session.id } });
    expect(mockTx.asset.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: candidateId,
          userId: session.userId,
          visionScenes: { none: {} },
          visionCandidates: { none: {} },
          visionAppearanceReferences: { none: {} },
          visionGenerationReferences: { none: {} },
        }),
      })
    );
    expect(result).toMatchObject({
      dryRun: false,
      purgedSessionIds: [session.id],
      candidateAssetIdsEligible: [candidateId],
      candidateAssetIdsDeleted: [candidateId],
      retainedReferenceAssetIds: [referenceId],
      storageCleanupRequested: [candidateId],
    });
    expect(mockDeletePrivateImageAsset).toHaveBeenCalledWith(`private/${candidateId}.jpg`);
  });

  it('preserves candidate assets already on the board and still retains attached reference uploads', async () => {
    mockPrisma.visionScene.findFirst.mockResolvedValue({ id: 'board-scene' });
    mockTx.visionScene.findFirst.mockResolvedValue({ id: 'board-scene' });

    const dryRun = await purgeExpiredVisionConversations({ now });
    expect(dryRun.candidateAssetIdsEligible).toEqual([]);
    expect(dryRun.retainedReferenceAssetIds).toEqual([referenceId]);

    const applied = await purgeExpiredVisionConversations({ apply: true, now });
    expect(applied.purgedSessionIds).toEqual([session.id]);
    expect(applied.candidateAssetIdsDeleted).toEqual([]);
    expect(mockTx.asset.deleteMany).not.toHaveBeenCalled();
    expect(mockDeletePrivateImageAsset).not.toHaveBeenCalled();
  });

  it('keeps a produced image when another session draft references it, including object metadata', async () => {
    const otherSessionId = 'other-session';
    mockPrisma.visionCreationSession.findMany.mockImplementation(
      async (args?: { where?: Record<string, unknown> }) => {
        if (args?.where && 'expiresAt' in args.where) return [session];
        return [
          {
            id: otherSessionId,
            draftReferences: [{ assetId: candidateId, role: 'style', label: 'shared draft' }],
          },
        ];
      }
    );
    mockTx.visionCreationSession.findMany.mockResolvedValue([
      {
        id: otherSessionId,
        draftReferences: [{ assetId: candidateId, role: 'style', label: 'shared draft' }],
      },
    ]);

    const dryRun = await purgeExpiredVisionConversations({ now });
    expect(dryRun.candidateAssetIdsEligible).toEqual([]);
    expect(mockPrisma.visionCreationSession.findMany).toHaveBeenCalledWith({
      where: { userId: session.userId },
      select: { id: true, draftReferences: true },
    });

    const applied = await purgeExpiredVisionConversations({ apply: true, now });
    expect(applied.purgedSessionIds).toEqual([session.id]);
    expect(applied.candidateAssetIdsDeleted).toEqual([]);
    expect(mockTx.asset.deleteMany).not.toHaveBeenCalled();
    expect(mockDeletePrivateImageAsset).not.toHaveBeenCalled();
  });

  it('turns a serialization conflict into an operator-directed retry', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('serialization failure'), { code: 'P2034' })
    );

    await expect(purgeExpiredVisionConversations({ apply: true, now })).rejects.toThrow(
      'Review the dry-run and retry the purge.'
    );
  });
});
