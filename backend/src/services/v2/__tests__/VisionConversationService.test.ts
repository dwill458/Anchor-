import { createHash } from 'crypto';

const mockTx = {
  $queryRaw: jest.fn(),
  visionCreationSession: {
    findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
  },
  visionGeneration: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  visionGenerationCandidate: { findFirst: jest.fn() },
  visionScene: { count: jest.fn(), findFirst: jest.fn() },
};

const mockPrisma = {
  $transaction: jest.fn(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
  anchor: { findFirst: jest.fn() },
  asset: { findFirst: jest.fn() },
  vision: { findFirst: jest.fn() },
  visionCreationSession: { findFirst: jest.fn(), updateMany: jest.fn() },
  visionGeneration: { findFirst: jest.fn(), updateMany: jest.fn() },
};

const mockGetMonetizationAccess = jest.fn();
const mockCreateAnchorVision = jest.fn();
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../MonetizationAccessService', () => ({ getMonetizationAccess: (...args: unknown[]) => mockGetMonetizationAccess(...args) }));
jest.mock('../VisionService', () => ({ visionService: { createAnchorVision: (...args: unknown[]) => mockCreateAnchorVision(...args) } }));
jest.mock('../visionScenePlanning', () => ({ buildVisionSceneVariantPlan: jest.fn(() => [{ role: 'moment-one', scene: 'A clear first image' }]) }));
jest.mock('../visionConversationContracts', () => ({
  conversationRoundInclude: {},
  privatePreview: jest.fn(async (key?: string | null) => key ? `https://preview.test/${key}` : null),
  serializeVisionRound: jest.fn(async (round: unknown) => round),
}));

import { UpdateVisionSessionSchema, type VisionReferenceInput, type VisionSceneGenerationInput } from '../../../domain/v2/vision';
import { VisionConversationService } from '../VisionConversationService';

const service = new VisionConversationService();
const userId = 'user-owner';
const anchorId = 'anchor-owner';
const visionId = 'vision-owner';
const sessionId = '00000000-0000-4000-8000-000000000101';
const candidateId = '00000000-0000-4000-8000-000000000201';
const otherCandidateId = '00000000-0000-4000-8000-000000000202';
const requestId = 'vision-request-0001';
const anchor = { id: anchorId, intentionText: 'A meaningful future', category: 'DESIRE' };
const activeSession = {
  id: sessionId, userId, anchorId, visionId, status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000),
  selectedCandidateId: null, viewedRoundId: null, draftReferences: [], rounds: [],
};

function references(count: number): VisionReferenceInput[] {
  return Array.from({ length: count }, (_, index) => ({
    assetId: `00000000-0000-4000-8000-${String(index + 301).padStart(12, '0')}`,
    role: index === 0 ? 'identity' : 'inspiration',
  }));
}

function request(overrides: Partial<VisionSceneGenerationInput> = {}): VisionSceneGenerationInput {
  return {
    sceneDescription: 'A warm, vivid moment with the people I love.',
    idempotencyKey: requestId,
    operation: 'EDIT',
    sessionId,
    parentCandidateId: candidateId,
    ...overrides,
  };
}

function fingerprint(input: VisionSceneGenerationInput) {
  return createHash('sha256').update(JSON.stringify({
    description: input.sceneDescription,
    operation: input.operation ?? 'CREATE',
    sessionId: input.sessionId ?? null,
    parentCandidateId: input.parentCandidateId ?? null,
    references: input.references ?? [],
    devImageModel: input.devImageModel ?? null,
  })).digest('hex');
}

function arrangeStart() {
  mockPrisma.anchor.findFirst.mockResolvedValue(anchor);
  mockPrisma.vision.findFirst.mockResolvedValue({ id: visionId });
  mockPrisma.visionCreationSession.findFirst.mockResolvedValue(null);
  mockPrisma.visionCreationSession.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.visionGeneration.findFirst.mockResolvedValue(null);
  mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset', mimeType: 'image/jpeg', fileSizeBytes: 1024 });
  mockTx.visionCreationSession.findUnique.mockResolvedValue(null);
  mockTx.visionCreationSession.findFirst.mockResolvedValue(activeSession);
  mockTx.visionCreationSession.create.mockResolvedValue(activeSession);
  mockTx.visionCreationSession.update.mockResolvedValue(activeSession);
  mockTx.visionCreationSession.updateMany.mockResolvedValue({ count: 1 });
  mockTx.visionGeneration.findUnique.mockResolvedValue(null);
  mockTx.visionGeneration.findFirst.mockImplementation(async (query: { where?: Record<string, unknown>; orderBy?: unknown }) => {
    if (query.where?.kind === 'SCENE') return { id: 'older-job', setNumber: 2, roundNumber: 1 };
    if (query.orderBy) return { roundNumber: 3 };
    return null;
  });
  mockTx.visionGeneration.create.mockResolvedValue({ id: requestId });
  mockTx.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
  mockTx.visionGenerationCandidate.findFirst.mockResolvedValue({ id: candidateId, assetId: 'asset-owner' });
  mockTx.visionScene.count.mockResolvedValue(0);
  mockGetMonetizationAccess.mockResolvedValue({ hasProAccess: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  arrangeStart();
  mockPrisma.anchor.findFirst.mockResolvedValue(anchor);
});

describe('VisionConversationService', () => {
  it('rejects a foreign Anchor before it reads or mutates a conversation', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue(null);
    await expect(service.start(userId, anchorId, request())).rejects.toMatchObject({ statusCode: 404, code: 'ANCHOR_NOT_FOUND' });
    expect(mockPrisma.anchor.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: anchorId, userId, isArchived: false } }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows five owner-owned references and persists them in the requested order', async () => {
    const refs = references(5);
    await service.start(userId, anchorId, request({ operation: 'COMPOSE', parentCandidateId: undefined, references: refs }));

    expect(mockPrisma.asset.findFirst).toHaveBeenCalledTimes(5);
    for (const ref of refs) expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({ where: { id: ref.assetId, userId }, select: { id: true, mimeType: true, fileSizeBytes: true } });
    const create = mockTx.visionGeneration.create.mock.calls[0][0].data;
    expect(create.references.create).toEqual(refs.map((ref, sortOrder) => ({ ...ref, sortOrder })));
  });

  it('rejects a reference that belongs to another account before opening a transaction', async () => {
    mockPrisma.asset.findFirst.mockResolvedValue(null);
    await expect(service.start(userId, anchorId, request({ references: references(1) })))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_VISION_REFERENCE' });
    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: references(1)[0].assetId, userId } }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('replays the same idempotency key and rejects the same key with a different request body', async () => {
    const input = request();
    mockPrisma.visionGeneration.findFirst.mockResolvedValue({ id: requestId, plan: { requestFingerprint: fingerprint(input) } });
    await expect(service.start(userId, anchorId, input)).resolves.toMatchObject({ jobId: requestId, enqueue: false, anchor });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    mockPrisma.visionGeneration.findFirst.mockResolvedValue({ id: requestId, plan: { requestFingerprint: fingerprint(input) } });
    await expect(service.start(userId, anchorId, { ...input, sceneDescription: 'A different scene from the same key.' }))
      .rejects.toMatchObject({ statusCode: 409, code: 'VISION_IDEMPOTENCY_CONFLICT' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes an older parent candidate to the owner and session, then assigns a stable next round', async () => {
    const olderParent = { id: otherCandidateId, assetId: 'older-owner-asset' };
    mockTx.visionGenerationCandidate.findFirst.mockResolvedValue(olderParent);
    await service.start(userId, anchorId, request({ parentCandidateId: otherCandidateId }));

    expect(mockTx.visionGenerationCandidate.findFirst).toHaveBeenCalledWith({
      where: {
        id: otherCandidateId,
        status: 'SUCCEEDED',
        asset: { userId },
        generation: { sessionId, userId, anchorId, visionId },
      },
      select: { assetId: true },
    });
    const create = mockTx.visionGeneration.create.mock.calls[0][0].data;
    expect(create).toEqual(expect.objectContaining({ roundNumber: 4, parentCandidateId: otherCandidateId, sessionId, userId, anchorId }));
  });

  it('rejects a foreign or missing parent candidate without creating a child round', async () => {
    mockTx.visionGenerationCandidate.findFirst.mockResolvedValue(null);
    await expect(service.start(userId, anchorId, request({ parentCandidateId: otherCandidateId })))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_VISION_CANDIDATE' });
    expect(mockTx.visionGeneration.create).not.toHaveBeenCalled();
    expect(mockTx.visionGenerationCandidate.findFirst.mock.calls[0][0].where).toEqual(expect.objectContaining({
      id: otherCandidateId, asset: { userId }, generation: { sessionId, userId, anchorId, visionId },
    }));
  });

  it('updates selected candidate and viewed round without allowing lineage to be rewritten', async () => {
    const selectedId = otherCandidateId;
    mockPrisma.visionCreationSession.findFirst.mockResolvedValue(activeSession);
    mockTx.visionCreationSession.findFirst.mockResolvedValue(activeSession);
    mockTx.visionGenerationCandidate.findFirst.mockResolvedValue({ assetId: 'older-owner-asset' });
    mockTx.visionGeneration.findFirst.mockResolvedValue({ id: 'older-round' });
    const input = { selectedCandidateId: selectedId, viewedRoundId: requestId };
    await expect(service.update(userId, anchorId, sessionId, input)).resolves.toMatchObject({ id: sessionId });
    expect(mockTx.visionCreationSession.update).toHaveBeenCalledWith({ where: { id: sessionId }, data: input });
    expect(mockTx.visionGenerationCandidate.findFirst.mock.calls[0][0].where).toEqual(expect.objectContaining({
      id: selectedId, asset: { userId }, generation: { sessionId, userId, anchorId },
    }));
    expect(mockTx.visionGeneration.findFirst.mock.calls[0][0].where).toEqual({ id: requestId, sessionId, userId, anchorId });
    expect(mockTx.visionGeneration.updateMany).not.toHaveBeenCalled();
    expect(UpdateVisionSessionSchema.safeParse({ ...input, parentCandidateId: candidateId }).success).toBe(false);
  });

  it('abandons the session and cancels queued, running, and partial rounds in the same transaction', async () => {
    mockTx.visionCreationSession.findFirst.mockResolvedValue(activeSession);

    await expect(service.update(userId, anchorId, sessionId, { status: 'ABANDONED' }))
      .resolves.toMatchObject({ id: sessionId, status: 'ABANDONED' });

    expect(mockTx.visionCreationSession.update).toHaveBeenCalledWith({
      where: { id: sessionId }, data: { status: 'ABANDONED' },
    });
    expect(mockTx.visionGeneration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId, anchorId, sessionId: { not: null }, status: { in: ['QUEUED', 'RUNNING', 'PARTIAL'] },
        session: { OR: [{ status: { not: 'ACTIVE' } }, { expiresAt: { lte: expect.any(Date) } }] },
      }),
      data: expect.objectContaining({ status: 'FAILED', stage: 'cancelled' }),
    }));
  });

  it('replays a lost seal acknowledgement only for the exact candidate already on the board', async () => {
    mockTx.visionCreationSession.findFirst.mockResolvedValue({ ...activeSession, status: 'SEALED', selectedCandidateId: candidateId });
    mockTx.visionGenerationCandidate.findFirst.mockResolvedValue({ assetId: 'kept-asset' });
    mockTx.visionScene.findFirst.mockResolvedValue({ id: 'kept-scene' });
    await expect(service.update(userId, anchorId, sessionId, { status: 'SEALED', selectedCandidateId: candidateId }))
      .resolves.toEqual({ id: sessionId, status: 'SEALED' });
    expect(mockTx.visionScene.findFirst).toHaveBeenCalledWith({ where: {
      visionId, userId, assetId: 'kept-asset', isArchived: false,
    } });
    mockTx.visionCreationSession.update.mockClear();
    await expect(service.update(userId, anchorId, sessionId, { status: 'SEALED', selectedCandidateId: otherCandidateId }))
      .rejects.toMatchObject({ statusCode: 409, code: 'VISION_SESSION_SEALED' });
    expect(mockTx.visionCreationSession.update).not.toHaveBeenCalled();
  });

  it('expires stale sessions, returns null for an absent current session, and reports a missing requested session', async () => {
    mockPrisma.visionCreationSession.findFirst.mockResolvedValue(null);
    await expect(service.read(userId, anchorId)).resolves.toBeNull();
    expect(mockPrisma.visionCreationSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId, anchorId, status: 'ACTIVE', expiresAt: { lte: expect.any(Date) } }),
      data: { status: 'EXPIRED' },
    }));
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId, anchorId, sessionId: { not: null }, status: { in: ['QUEUED', 'RUNNING', 'PARTIAL'] },
        session: { OR: [{ status: { not: 'ACTIVE' } }, { expiresAt: { lte: expect.any(Date) } }] },
      }),
      data: expect.objectContaining({ status: 'FAILED', stage: 'cancelled' }),
    }));
    await expect(service.read(userId, anchorId, sessionId)).rejects.toMatchObject({ statusCode: 404, code: 'VISION_SESSION_NOT_FOUND' });
  });

  it('keeps an unavailable reference in the draft with no signed image URL', async () => {
    const ref = references(1)[0];
    mockPrisma.visionCreationSession.findFirst.mockResolvedValue({ ...activeSession, draftReferences: [ref] });
    mockPrisma.asset.findFirst.mockResolvedValue(null);
    const result = await service.read(userId, anchorId, sessionId);
    expect(result?.references).toEqual([{ ...ref, imageUrl: null }]);
    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({ where: { id: ref.assetId, userId }, select: { storageKey: true } });
  });
});
