const mockPrisma = {
  visionGeneration: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  visionCreationSession: { findFirst: jest.fn() },
  visionGenerationCandidate: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  asset: { findFirst: jest.fn() },
  vision: { findUnique: jest.fn(), findMany: jest.fn() },
};
const mockImageGenerate = jest.fn();
const mockReadPrivateImageAsset = jest.fn();
const mockUploadImageAssetFromBuffer = jest.fn();
const mockResolveAppearance = jest.fn();
const mockCreateAsset = jest.fn();

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../GeminiImageService', () => ({
  GeminiError: class GeminiError extends Error {
    constructor(public type: string, message: string, public retryable = false) { super(message); }
  },
  GeminiErrorType: { INVALID_API_KEY: 'INVALID_API_KEY', INVALID_IMAGE: 'INVALID_IMAGE' },
  GeminiImageService: jest.fn().mockImplementation(() => ({
    planVisionScenes: jest.fn(),
    generateVisionScene: jest.fn(),
  })),
}));
jest.mock('../../image', () => {
  class ImageProviderError extends Error {
    constructor(public type: string, message: string) { super(message); }
  }
  return {
    ImageProviderError,
    ImageProviderErrorType: { AUTHENTICATION: 'AUTHENTICATION' },
    imageGenerationService: { generate: (...args: unknown[]) => mockImageGenerate(...args) },
  };
});
jest.mock('../../StorageService', () => ({
  readPrivateImageAsset: (...args: unknown[]) => mockReadPrivateImageAsset(...args),
  uploadImageAssetFromBuffer: (...args: unknown[]) => mockUploadImageAssetFromBuffer(...args),
  resolveStorageKeyUrl: jest.fn(async () => 'https://signed.example/unused.jpg'),
}));
jest.mock('../VisionAppearanceReferenceService', () => ({
  visionAppearanceReferenceService: {
    resolveForGeneration: (...args: unknown[]) => mockResolveAppearance(...args),
    cleanupGenerationScoped: jest.fn(),
  },
}));
jest.mock('../OnboardingContextService', () => ({ getOnboardingContext: jest.fn(async () => null) }));
jest.mock('../VisionService', () => ({ visionService: { createAsset: (...args: unknown[]) => mockCreateAsset(...args) } }));

import sharp from 'sharp';
import { VisionGenerationService } from '../VisionGenerationService';

const service = new VisionGenerationService();
const ownerId = 'owner-1';
const anchorId = 'anchor-1';
const sessionId = 'session-1';
const jobId = 'conversation-job-1';
const twoShotPlan = [
  { role: 'Option one', scene: 'Option scene one', framing: 'portrait' },
  { role: 'Option two', scene: 'Option scene two', framing: 'portrait' },
];
const roles = ['identity', 'place', 'object', 'inspiration', 'style'] as const;

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: jobId,
    userId: ownerId,
    anchorId,
    visionId: 'vision-1',
    description: 'An editorial image of a person learning to sail',
    retryCount: 0,
    status: 'QUEUED',
    operation: 'CREATE',
    sessionId,
    session: { status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000) },
    parentCandidateId: null,
    appearanceReferenceId: null,
    startAssetId: 'revenuecat-dashboard-photo',
    kind: 'SCENE',
    plan: twoShotPlan,
    references: [],
    ...overrides,
  };
}

async function tinyPng() {
  return sharp({ create: { width: 3, height: 5, channels: 3, background: '#b8a98b' } }).png().toBuffer();
}

async function arrange(job = makeJob()) {
  const png = await tinyPng();
  mockPrisma.visionGeneration.findUnique.mockImplementation(async (_query: unknown) => {
    const query = _query as { select?: unknown };
    return query.select ? {
      status: 'RUNNING', retryCount: 0,
      session: { status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000) },
    } : job;
  });
  mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.visionGeneration.update.mockResolvedValue({});
  mockPrisma.visionGeneration.findFirst.mockResolvedValue(null);
  mockPrisma.visionCreationSession.findFirst.mockResolvedValue(null);
  mockPrisma.visionGenerationCandidate.findUnique.mockResolvedValue(null);
  mockPrisma.visionGenerationCandidate.create.mockResolvedValue({});
  mockPrisma.visionGenerationCandidate.update.mockResolvedValue({});
  mockPrisma.visionGenerationCandidate.findFirst.mockResolvedValue(null);
  mockPrisma.asset.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({ storageKey: `private/${where.id}.jpg` }));
  mockReadPrivateImageAsset.mockResolvedValue(png);
  mockUploadImageAssetFromBuffer.mockImplementation(async (_buffer: Buffer, _owner: string, _anchor: string, index: number) => ({ objectKey: `private/output-${index}.jpg` }));
  mockCreateAsset.mockImplementation(async (_owner: string, input: { storageKey: string }) => ({ id: `asset:${input.storageKey}` }));
  mockResolveAppearance.mockResolvedValue(null);
  mockImageGenerate.mockResolvedValue({ images: [{ buffer: png }] });
  return png;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('VisionGenerationService conversation worker', () => {
  it('creates an independent Bloomberg-style article after a RevenueCat dashboard without reading old image bytes', async () => {
    await arrange(makeJob({
      operation: 'CREATE',
      description: 'A Bloomberg-style editorial article about Anchor reaching ten thousand users.',
      references: [],
    }));

    await (service as any).run(jobId, 'Live intentionally', 'DESIRE');

    expect(mockPrisma.vision.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.vision.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.asset.findFirst).not.toHaveBeenCalled();
    expect(mockReadPrivateImageAsset).not.toHaveBeenCalled();
    expect(mockImageGenerate).toHaveBeenCalledTimes(2);
    for (const [request] of mockImageGenerate.mock.calls) {
      expect(request.operation).toBe('CREATE');
      expect(request.referenceImages).toBeUndefined();
      expect(request.prompt).toContain('Bloomberg-style editorial article');
      expect(request.prompt).toContain('Create a NEW independent scene');
      expect(request.prompt).not.toContain('revenuecat-dashboard-photo');
    }
  });

  it('loads five role-labelled references in stored order for both outputs', async () => {
    const references = roles.map((role, index) => ({ assetId: `ref-${index + 1}`, role, label: `Label ${index + 1}` }));
    await arrange(makeJob({ operation: 'COMPOSE', references }));

    await (service as any).run(jobId, 'Live intentionally', 'DESIRE');

    expect(mockPrisma.asset.findFirst.mock.calls.map(([query]) => query.where.id)).toEqual([
      'ref-1', 'ref-2', 'ref-3', 'ref-4', 'ref-5',
    ]);
    expect(mockReadPrivateImageAsset.mock.calls.map(([key]) => key)).toEqual(roles.map((_, i) => `private/ref-${i + 1}.jpg`));
    expect(mockImageGenerate).toHaveBeenCalledTimes(2);
    for (const [request] of mockImageGenerate.mock.calls) {
      expect(request.referenceImages.map((reference: { role: string; label?: string }) => reference.role)).toEqual(roles);
      expect(request.referenceImages.map((reference: { label?: string }) => reference.label)).toEqual([
        'Label 1', 'Label 2', 'Label 3', 'Label 4', 'Label 5',
      ]);
    }
  });

  it('attaches the exact parent source plus five gallery references to both edit options and links both to one job', async () => {
    const references = roles.map((role, index) => ({ assetId: `ref-${index + 1}`, role, label: null }));
    await arrange(makeJob({ operation: 'EDIT', parentCandidateId: 'selected-candidate', references }));
    mockPrisma.visionGenerationCandidate.findFirst.mockResolvedValue({ assetId: 'parent-asset' });

    await (service as any).run(jobId, 'Live intentionally', 'DESIRE');

    expect(mockPrisma.visionGenerationCandidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'selected-candidate',
        status: 'SUCCEEDED',
        generation: { sessionId, userId: ownerId, anchorId },
      }),
    }));
    for (const [request] of mockImageGenerate.mock.calls) {
      expect(request.operation).toBe('EDIT');
      expect(request.referenceImages.map((reference: { role: string }) => reference.role)).toEqual(['edit_source', ...roles]);
      expect(request.prompt).toContain('Edit the exact source candidate supplied as Image 1');
    }
    expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.visionGenerationCandidate.create.mock.calls.map(([call]) => call.data.generationId)).toEqual([jobId, jobId]);
    expect(mockPrisma.visionGenerationCandidate.create.mock.calls.map(([call]) => call.data.sortOrder).sort()).toEqual([0, 1]);
  });

  it('fails an edit with a missing selected parent and never falls back to independent creation', async () => {
    await arrange(makeJob({ operation: 'EDIT', parentCandidateId: 'missing-parent' }));

    await (service as any).run(jobId, 'Live intentionally', 'DESIRE');

    expect(mockImageGenerate).not.toHaveBeenCalled();
    expect(mockPrisma.visionGenerationCandidate.create).not.toHaveBeenCalled();
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
  });

  it('fails a conversation when an explicit reference is missing instead of silently dropping it', async () => {
    await arrange(makeJob({
      operation: 'COMPOSE',
      references: [{ assetId: 'missing-ref', role: 'inspiration', label: null }],
    }));
    mockPrisma.asset.findFirst.mockResolvedValue(null);

    await (service as any).run(jobId, 'Live intentionally', 'DESIRE');

    expect(mockImageGenerate).not.toHaveBeenCalled();
    expect(mockPrisma.visionGenerationCandidate.create).not.toHaveBeenCalled();
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
  });

  it('retains a successful option when the other provider render fails', async () => {
    await arrange();
    const png = await tinyPng();
    mockImageGenerate.mockImplementation(async (request: { prompt: string }) => {
      if (request.prompt.includes('option 2')) throw new Error('provider unavailable');
      return { images: [{ buffer: png }] };
    });

    await (service as any).run(jobId, 'Live intentionally', 'DESIRE');

    expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(2);
    const created = mockPrisma.visionGenerationCandidate.create.mock.calls.map(([call]) => call.data);
    expect(created).toEqual(expect.arrayContaining([
      expect.objectContaining({ generationId: jobId, status: 'SUCCEEDED', assetId: expect.any(String) }),
      expect.objectContaining({ generationId: jobId, status: 'FAILED', assetId: null }),
    ]));
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETE' }),
    }));
  });

  it.each([
    ['abandoned', { status: 'ABANDONED', expiresAt: new Date(Date.now() + 86_400_000) }],
    ['expired', { status: 'ACTIVE', expiresAt: new Date(Date.now() - 1_000) }],
  ])('does not call a provider for an %s session', async (_label, session) => {
    const job = makeJob({ session });
    await arrange(job);

    await (service as any).run(jobId, 'Live intentionally', 'DESIRE');

    expect(mockImageGenerate).not.toHaveBeenCalled();
    expect(mockReadPrivateImageAsset).not.toHaveBeenCalled();
    expect(mockPrisma.visionGeneration.updateMany).not.toHaveBeenCalled();
  });

  it('denies retry when the conversation session has ended', async () => {
    await arrange();
    mockPrisma.visionGeneration.findFirst.mockResolvedValue(makeJob({ status: 'FAILED' }));
    mockPrisma.visionCreationSession.findFirst.mockResolvedValue(null);

    await expect(service.retry(ownerId, anchorId, jobId))
      .rejects.toMatchObject({ statusCode: 409, code: 'VISION_SESSION_ENDED' });

    expect(mockPrisma.visionCreationSession.findFirst).toHaveBeenCalledWith({
      where: { id: sessionId, userId: ownerId, anchorId, status: 'ACTIVE', expiresAt: { gt: expect.any(Date) } },
      select: { id: true },
    });
    expect(mockPrisma.visionGeneration.updateMany).not.toHaveBeenCalled();
    expect(mockImageGenerate).not.toHaveBeenCalled();
  });
});
