const mockPrisma = {
  anchor: { findFirst: jest.fn() },
  vision: { findFirst: jest.fn() },
  visionGeneration: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(async (): Promise<unknown[]> => []),
  },
  visionGenerationCandidate: { findUnique: jest.fn(), create: jest.fn() },
};
const mockPlanVisionScenes = jest.fn();
const mockGenerateVisionScene = jest.fn();

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../MonetizationAccessService', () => ({
  getMonetizationAccess: jest.fn(),
}));
jest.mock('../VisionService', () => ({
  visionService: { createAnchorVision: jest.fn(), createAsset: jest.fn() },
}));
jest.mock('../../GeminiImageService', () => {
  class GeminiError extends Error {
    constructor(public type: string, message: string, public retryable = false) { super(message); }
  }
  return {
    GeminiError,
    GeminiErrorType: { INVALID_API_KEY: 'INVALID_API_KEY', INVALID_IMAGE: 'INVALID_IMAGE' },
    GeminiImageService: jest.fn().mockImplementation(() => ({
      planVisionScenes: mockPlanVisionScenes,
      generateVisionScene: mockGenerateVisionScene,
    })),
  };
});
jest.mock('../../StorageService', () => ({
  resolveStorageKeyUrl: jest.fn(async () => 'https://signed.example/image.jpg'),
  uploadImageAssetFromBuffer: jest.fn(),
}));

import sharp from 'sharp';
import { getMonetizationAccess } from '../../MonetizationAccessService';
import { visionService } from '../VisionService';
import { VisionGenerationService } from '../VisionGenerationService';
import { uploadImageAssetFromBuffer } from '../../StorageService';

describe('VisionGenerationService', () => {
  const service = new VisionGenerationService();
  const userId = 'owner';
  const anchorId = 'anchor-1';
  const description = 'I spend my days making meaningful work with my family nearby.';

  beforeEach(() => {
    jest.clearAllMocks();
    (getMonetizationAccess as jest.Mock).mockResolvedValue({ hasProAccess: true });
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: anchorId, intentionText: 'I create freely', category: 'DESIRE' });
    mockPrisma.vision.findFirst.mockResolvedValue({ id: 'vision-1' });
    mockPrisma.visionGeneration.findFirst.mockResolvedValue(null);
    mockPrisma.visionGeneration.create.mockResolvedValue({ id: 'job-1' });
    (visionService.createAnchorVision as jest.Mock).mockResolvedValue({ id: 'vision-1' });
  });

  it('rejects a foreign Anchor before creating a Vision or job', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue(null);
    await expect(service.start(userId, anchorId, description, 'job-foreign-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(visionService.createAnchorVision).not.toHaveBeenCalled();
    expect(mockPrisma.visionGeneration.create).not.toHaveBeenCalled();
  });

  it('enforces the third set limit before changing the saved Vision description', async () => {
    mockPrisma.visionGeneration.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'job-3', setNumber: 3, status: 'COMPLETE', updatedAt: new Date() });
    await expect(service.start(userId, anchorId, description, 'job-fourth-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(visionService.createAnchorVision).not.toHaveBeenCalled();
    expect(mockPrisma.visionGeneration.create).not.toHaveBeenCalled();
  });

  it('returns the active job on a repeated tap without consuming another set', async () => {
    const job = {
      id: 'job-1', visionId: 'vision-1', anchorId, setNumber: 1, retryCount: 0,
      status: 'RUNNING', stage: 'creating_images', error: null,
      updatedAt: new Date(), candidates: [],
    };
    mockPrisma.visionGeneration.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(job);
    const result = await service.start(userId, anchorId, description, 'job-repeat-1');
    expect(result?.status).toBe('RUNNING');
    expect(visionService.createAnchorVision).not.toHaveBeenCalled();
    expect(mockPrisma.visionGeneration.create).not.toHaveBeenCalled();
  });

  it('requires entitlement before starting a provider job', async () => {
    (getMonetizationAccess as jest.Mock).mockResolvedValue({ hasProAccess: false });
    await expect(service.start(userId, anchorId, description, 'job-gated-1')).rejects.toMatchObject({ statusCode: 403 });
    expect(mockPrisma.anchor.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.visionGeneration.create).not.toHaveBeenCalled();
  });

  it('persists eight distinct planned candidates and completes only after storage succeeds', async () => {
    const plan = Array.from({ length: 8 }, (_, index) => ({ role: `Role ${index}`, scene: `Different scene ${index}` }));
    const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRuoAAAAASUVORK5CYII=', 'base64');
    mockPlanVisionScenes.mockResolvedValue(plan);
    mockGenerateVisionScene.mockResolvedValue(onePixelPng);
    mockPrisma.visionGeneration.findUnique.mockImplementation(async (query: { select?: unknown }) =>
      query.select ? { status: 'RUNNING', retryCount: 0 } : {
        id: 'job-1', userId, anchorId, visionId: 'vision-1', description, retryCount: 0, plan: null,
      });
    mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.visionGeneration.update.mockResolvedValue({});
    mockPrisma.visionGenerationCandidate.findUnique.mockResolvedValue(null);
    mockPrisma.visionGenerationCandidate.create.mockResolvedValue({});
    (uploadImageAssetFromBuffer as jest.Mock).mockImplementation(async (_image, _user, _anchor, index) => ({ objectKey: `private/${index}.jpg` }));
    (visionService.createAsset as jest.Mock).mockImplementation(async (_user, input) => ({ id: input.storageKey }));

    await (service as any).run('job-1', 'I create freely', 'DESIRE');

    expect(mockPlanVisionScenes).toHaveBeenCalledWith('I create freely', 'DESIRE', description, [], false, null);
    expect(mockGenerateVisionScene).toHaveBeenCalledTimes(8);
    expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(8);
    expect(mockPrisma.visionGenerationCandidate.create.mock.calls.map(([call]) => call.data.role)).toEqual(plan.map(item => item.role));
    // Each image prompt is built from its own planned shot, not the raw description alone.
    expect(mockGenerateVisionScene.mock.calls.map(([prompt]) => prompt)).toEqual(
      plan.map(item => expect.stringContaining(JSON.stringify(item.scene))),
    );
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETE' }),
    }));
  });

  function arrangeRun(plan: Array<{ role: string; scene: string }>) {
    mockPlanVisionScenes.mockResolvedValue(plan);
    mockPrisma.visionGeneration.findUnique.mockImplementation(async (query: { select?: unknown }) =>
      query.select ? { status: 'RUNNING', retryCount: 0 } : {
        id: 'job-1', userId, anchorId, visionId: 'vision-1', description, retryCount: 0, plan: null,
      });
    mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.visionGeneration.update.mockResolvedValue({});
    mockPrisma.visionGenerationCandidate.findUnique.mockResolvedValue(null);
    mockPrisma.visionGenerationCandidate.create.mockResolvedValue({});
    (uploadImageAssetFromBuffer as jest.Mock).mockImplementation(async (_image, _user, _anchor, index) => ({ objectKey: `private/${index}.jpg` }));
    (visionService.createAsset as jest.Mock).mockImplementation(async (_user, input) => ({ id: input.storageKey }));
  }

  it('stores the provider portrait as-is, never squaring or upscaling it', async () => {
    const plan = Array.from({ length: 8 }, (_, index) => ({ role: `Role ${index}`, scene: `Different scene ${index}` }));
    arrangeRun(plan);
    const portrait = await sharp({ create: { width: 90, height: 160, channels: 3, background: '#556677' } }).png().toBuffer();
    mockGenerateVisionScene.mockResolvedValue(portrait);

    await (service as any).run('job-1', 'I create freely', 'DESIRE');

    const stored = (uploadImageAssetFromBuffer as jest.Mock).mock.calls[0][0] as Buffer;
    const meta = await sharp(stored).metadata();
    expect([meta.width, meta.height]).toEqual([90, 160]);
    expect((visionService.createAsset as jest.Mock).mock.calls[0][1].metadata).toEqual(expect.objectContaining({
      width: 90, height: 160, aspectRatio: '9:16',
    }));
    expect(mockGenerateVisionScene.mock.calls[0][0]).toContain('9:16 portrait');
  });

  it('retries one failed image instead of stopping the whole set', async () => {
    const plan = Array.from({ length: 8 }, (_, index) => ({ role: `Role ${index}`, scene: `Different scene ${index}` }));
    arrangeRun(plan);
    const portrait = await sharp({ create: { width: 9, height: 16, channels: 3, background: '#556677' } }).png().toBuffer();
    mockGenerateVisionScene.mockRejectedValueOnce(new Error('provider hiccup')).mockResolvedValue(portrait);

    await (service as any).run('job-1', 'I create freely', 'DESIRE');

    expect(mockGenerateVisionScene).toHaveBeenCalledTimes(9);
    expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(8);
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETE' }),
    }));
  });

  it('keeps successful moments when one scene fails twice', async () => {
    const plan = Array.from({ length: 8 }, (_, index) => ({ role: `Role ${index}`, scene: `Different scene ${index}` }));
    arrangeRun(plan);
    const portrait = await sharp({ create: { width: 9, height: 16, channels: 3, background: '#556677' } }).png().toBuffer();
    mockGenerateVisionScene
      .mockResolvedValueOnce(portrait).mockResolvedValueOnce(portrait)
      .mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValue(portrait);

    await (service as any).run('job-1', 'I create freely', 'DESIRE');

    expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(8);
    expect(mockPrisma.visionGenerationCandidate.create.mock.calls[2][0].data).toEqual(expect.objectContaining({
      status: 'FAILED', assetId: null,
    }));
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETE' }),
    }));
  });

  it('tells the planner which scenes earlier sets already showed', async () => {
    const earlier = Array.from({ length: 8 }, (_, index) => ({ role: `Earlier ${index}`, scene: `Earlier scene ${index}` }));
    mockPrisma.visionGeneration.findMany.mockResolvedValue([{ plan: earlier }, { plan: null }]);
    mockPlanVisionScenes.mockRejectedValue(new Error('stop after planning'));
    mockPrisma.visionGeneration.findUnique.mockResolvedValue({
      id: 'job-2', userId, anchorId, visionId: 'vision-1', description, retryCount: 0, plan: null, setNumber: 2,
    });
    mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });

    await (service as any).run('job-2', 'I create freely', 'DESIRE');

    expect(mockPrisma.visionGeneration.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { visionId: 'vision-1', setNumber: { lt: 2 } },
    }));
    expect(mockPlanVisionScenes).toHaveBeenCalledWith('I create freely', 'DESIRE', description, earlier.map(item => item.scene), false, null);
  });
});
