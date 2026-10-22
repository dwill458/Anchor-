const mockPrisma = {
  anchor: { findFirst: jest.fn() },
  asset: { findFirst: jest.fn() },
  vision: { findFirst: jest.fn(), findUnique: jest.fn() },
  visionScene: { count: jest.fn() },
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
const mockImageGenerate = jest.fn();
jest.mock('../../image', () => {
  const actual = jest.requireActual('../../image');
  return { ...actual, imageGenerationService: { generate: (...args: unknown[]) => mockImageGenerate(...args) } };
});
jest.mock('../../StorageService', () => ({
  resolveStorageKeyUrl: jest.fn(async () => 'https://signed.example/image.jpg'),
  uploadImageAssetFromBuffer: jest.fn(),
  readPrivateImageAsset: jest.fn(),
}));

import sharp from 'sharp';
import { GeminiImageService } from '../../GeminiImageService';
import { readPrivateImageAsset } from '../../StorageService';
import { getMonetizationAccess } from '../../MonetizationAccessService';
import { visionService } from '../VisionService';
import { VisionGenerationService } from '../VisionGenerationService';
import { uploadImageAssetFromBuffer } from '../../StorageService';
import { VISION_MAX_IMAGES } from '../../../domain/v2/vision';

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
    const createdRoles = mockPrisma.visionGenerationCandidate.create.mock.calls
      .map(([call]) => call.data)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(data => data.role);
    expect(createdRoles).toEqual(plan.map(item => item.role));
    // Each image prompt is built from its own planned shot, not the raw description alone.
    const calledPrompts = mockGenerateVisionScene.mock.calls.map(([prompt]) => prompt);
    for (const item of plan) {
      expect(calledPrompts).toEqual(expect.arrayContaining([expect.stringContaining(JSON.stringify(item.scene))]));
    }
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
    mockGenerateVisionScene.mockImplementation(async (prompt: string) => {
      if (prompt.includes('Different scene 2')) {
        throw new Error('down');
      }
      return portrait;
    });

    await (service as any).run('job-1', 'I create freely', 'DESIRE');

    expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(8);
    const failedCall = mockPrisma.visionGenerationCandidate.create.mock.calls.find(
      ([call]) => call.data.sortOrder === 2
    );
    expect(failedCall?.[0].data).toEqual(expect.objectContaining({
      status: 'FAILED', assetId: null,
    }));
    expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETE' }),
    }));
  });

  it('renders candidates concurrently so both start before either finishes', async () => {
    const plan = [
      { role: 'Role 0', scene: 'Scene 0' },
      { role: 'Role 1', scene: 'Scene 1' },
    ];
    arrangeRun(plan);
    const portrait = await sharp({ create: { width: 9, height: 16, channels: 3, background: '#556677' } }).png().toBuffer();
    let startedCount = 0;
    let bothStartedBeforeFinish = false;
    let resolveFirst: (() => void) | null = null;
    const firstBarrier = new Promise<void>(res => { resolveFirst = res; });

    mockGenerateVisionScene.mockImplementation(async () => {
      startedCount += 1;
      if (startedCount === 2) {
        bothStartedBeforeFinish = true;
        resolveFirst?.();
      } else {
        await firstBarrier;
      }
      return portrait;
    });

    await (service as any).run('job-1', 'I create freely', 'DESIRE');
    expect(bothStartedBeforeFinish).toBe(true);
    expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(2);
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
      where: { visionId: 'vision-1', kind: 'SET', setNumber: { lt: 2 } },
    }));
    expect(mockPlanVisionScenes).toHaveBeenCalledWith('I create freely', 'DESIRE', description, earlier.map(item => item.scene), false, null);
  });
  describe('a described scene for the board', () => {
    const sceneText = 'Working from a beach house with my family nearby';

    beforeEach(() => {
      mockPrisma.visionScene.count.mockResolvedValue(3);
      mockPrisma.visionGeneration.findFirst.mockResolvedValue(null);
      mockPrisma.visionGeneration.findUnique.mockResolvedValue(null);
    });

    afterEach(() => { jest.restoreAllMocks(); });

    it('persists the pinned model with both scene variants for background execution and retries', async () => {
      jest.spyOn(service as any, 'run').mockResolvedValue(undefined);
      jest.spyOn(service, 'latest').mockResolvedValue({ id: 'scene-compare', status: 'QUEUED' } as never);
      await service.startScene(userId, anchorId, sceneText, 'scene-compare', null, null, 'gemini-nano-banana-2.1');
      const data = mockPrisma.visionGeneration.create.mock.calls[0][0].data;
      expect(data.plan.devImageModel).toBe('gemini-nano-banana-2.1');
      expect(data.plan.scenes).toHaveLength(2);
      expect(data.plan.scenes.every((item: { scene: string }) => item.scene === sceneText)).toBe(true);
    });

    it('creates a SCENE job with two planned shots, without touching the Vision description or the set count', async () => {
      const run = jest.spyOn(service as any, 'run').mockResolvedValue(undefined);
      jest.spyOn(service, 'latest').mockResolvedValue({ id: 'scene-job-000001', status: 'QUEUED' } as never);
      await service.startScene(userId, anchorId, sceneText, 'scene-job-000001');
      expect(visionService.createAnchorVision).not.toHaveBeenCalled();
      const data = mockPrisma.visionGeneration.create.mock.calls[0][0].data;
      expect(data).toEqual(expect.objectContaining({ kind: 'SCENE', setNumber: 1, description: sceneText, visionId: 'vision-1' }));
      expect(data.plan).toHaveLength(2);
      expect(data.plan.every((item: { scene: string }) => item.scene === sceneText)).toBe(true);
      expect(run).toHaveBeenCalledWith('scene-job-000001', 'I create freely', 'DESIRE');
    });

    it('accepts a full-length Vision description for the first image and keeps every word in both shots', async () => {
      jest.spyOn(service as any, 'run').mockResolvedValue(undefined);
      jest.spyOn(service, 'latest').mockResolvedValue({ id: 'scene-job-000006', status: 'QUEUED' } as never);
      const long = 'I see the number I worked toward. '.repeat(60).slice(0, 1999).trimEnd() + '.';
      expect(long.length).toBeLessThanOrEqual(2000);
      expect(long.length).toBeGreaterThan(1900);
      await service.startScene(userId, anchorId, long, 'scene-job-000006');
      const data = mockPrisma.visionGeneration.create.mock.calls[0][0].data;
      expect(data.plan).toHaveLength(2);
      expect(data.plan.every((item: { scene: string }) => item.scene === long)).toBe(true);
      await expect(service.startScene(userId, anchorId, `${long}${'x'.repeat(200)}`, 'scene-job-000007')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('needs an existing Vision with room on the board', async () => {
      mockPrisma.vision.findFirst.mockResolvedValueOnce(null);
      await expect(service.startScene(userId, anchorId, sceneText, 'scene-job-000002')).rejects.toMatchObject({ statusCode: 404 });
      mockPrisma.vision.findFirst.mockResolvedValueOnce({ id: 'vision-1' });
      mockPrisma.visionScene.count.mockResolvedValueOnce(VISION_MAX_IMAGES);
      await expect(service.startScene(userId, anchorId, sceneText, 'scene-job-000003')).rejects.toMatchObject({ code: 'VISION_IMAGE_LIMIT' });
      expect(mockPrisma.visionGeneration.create).not.toHaveBeenCalled();
    });

    it('is gated like every other generation, and a repeated tap returns the running job', async () => {
      (getMonetizationAccess as jest.Mock).mockResolvedValueOnce({ hasProAccess: false });
      await expect(service.startScene(userId, anchorId, sceneText, 'scene-job-000004')).rejects.toMatchObject({ statusCode: 403 });
      const running = { id: 'scene-job-old', status: 'RUNNING', updatedAt: new Date() };
      mockPrisma.visionGeneration.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(running);
      jest.spyOn(service, 'latest').mockResolvedValue({ id: 'scene-job-old', status: 'RUNNING' } as never);
      const result = await service.startScene(userId, anchorId, sceneText, 'scene-job-000005');
      expect(result).toEqual(expect.objectContaining({ id: 'scene-job-old' }));
      expect(mockPrisma.visionGeneration.create).not.toHaveBeenCalled();
    });

    it('shoots each candidate in the context of the Vision and what is already on the board', async () => {
      const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRuoAAAAASUVORK5CYII=', 'base64');
      mockGenerateVisionScene.mockResolvedValue(onePixelPng);
      const plan = [
        { role: 'The moment itself', scene: sceneText, framing: 'medium' },
        { role: 'The place around it', scene: sceneText, framing: 'wide' },
      ];
      mockPrisma.visionGeneration.findUnique.mockImplementation(async (query: { select?: unknown }) =>
        query.select ? { status: 'RUNNING', retryCount: 0 } : {
          id: 'scene-job-1', userId, anchorId, visionId: 'vision-1', kind: 'SCENE', description: sceneText, retryCount: 0, plan,
        });
      mockPrisma.vision.findUnique.mockResolvedValue({
        description: 'A calm, sunlit life by the water.',
        scenes: [{ prompt: 'A quiet dock at dawn' }, { prompt: null }],
      });
      mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.visionGeneration.update.mockResolvedValue({});
      mockPrisma.visionGenerationCandidate.findUnique.mockResolvedValue(null);
      mockPrisma.visionGenerationCandidate.create.mockResolvedValue({});
      (uploadImageAssetFromBuffer as jest.Mock).mockImplementation(async (_i, _u, _a, index) => ({ objectKey: `private/${index}.jpg` }));
      (visionService.createAsset as jest.Mock).mockImplementation(async (_u, input) => ({ id: input.storageKey }));

      await (service as any).run('scene-job-1', 'I create freely', 'DESIRE');

      expect(mockPlanVisionScenes).not.toHaveBeenCalled();
      expect(mockGenerateVisionScene).toHaveBeenCalledTimes(2);
      const prompt = mockGenerateVisionScene.mock.calls[0][0] as string;
      expect(prompt).toContain(JSON.stringify(sceneText));
      expect(prompt).not.toContain('A calm, sunlit life by the water.');
      // Earlier scenes' prompts never leak into the new scene.
      expect(prompt).not.toContain('A quiet dock at dawn');
      expect(prompt).toContain('Do not borrow rooms, places, props, light or compositions from any other moment');
      expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETE' }),
      }));
    });

    describe('continuing the world the person has already established', () => {
      const png = async (color: string) => sharp({ create: { width: 64, height: 96, channels: 3, background: color } }).png().toBuffer();
      const plan = [
        { role: 'The moment itself', scene: sceneText, framing: 'medium' },
        { role: 'The place around it', scene: sceneText, framing: 'wide' },
      ];
      const arrange = async (scenes: unknown[], unreadable = false, pinned = false) => {
        const provider = { planVisionScenes: mockPlanVisionScenes, generateVisionScene: async () => Buffer.alloc(0) };
        (GeminiImageService as unknown as jest.Mock).mockImplementationOnce(() => provider);
        mockImageGenerate.mockResolvedValue({ images: [{ buffer: await png('#334455') }] });
        (readPrivateImageAsset as jest.Mock).mockImplementation(async (key: string) => {
          if (unreadable) throw new Error('gone');
          return png(key.includes('mine') ? '#111111' : '#999999');
        });
        mockPrisma.visionGeneration.findUnique.mockImplementation(async (query: { select?: unknown }) =>
          query.select ? { status: 'RUNNING', retryCount: 0 } : {
            id: 'scene-job-1', userId, anchorId, visionId: 'vision-1', kind: 'SCENE', description: sceneText, retryCount: 0,
            plan: pinned ? { devImageModel: 'gemini-nano-banana-2.1', scenes: plan } : plan,
          });
        mockPrisma.vision.findUnique.mockResolvedValue({ description: 'I own a black 1987 Buick Regal.', scenes });
        mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.visionGeneration.update.mockResolvedValue({});
        mockPrisma.visionGenerationCandidate.findUnique.mockResolvedValue(null);
        mockPrisma.visionGenerationCandidate.create.mockResolvedValue({});
        (uploadImageAssetFromBuffer as jest.Mock).mockImplementation(async (_i, _u, _a, index) => ({ objectKey: `private/${index}.jpg` }));
        (visionService.createAsset as jest.Mock).mockImplementation(async (_u, input) => ({ id: input.storageKey }));
        await (service as any).run('scene-job-1', 'I own a Regal', 'DESIRE');
      };
      const scene = (id: string, sourceType: string, sortOrder: number, key: string) => ({
        id, prompt: null, sourceType, sortOrder, createdAt: new Date(2026, 8, sortOrder + 1), asset: { storageKey: key, mimeType: 'image/jpeg' },
      });

      it('loads the pinned model from a stored job and uses it for both candidates', async () => {
        await arrange([], false, true);
        expect(mockImageGenerate).toHaveBeenCalledTimes(2);
        mockImageGenerate.mock.calls.forEach(([input]) => expect(input.devImageModel).toBe('gemini-nano-banana-2.1'));
        expect(mockPlanVisionScenes).not.toHaveBeenCalled();
        expect(mockPrisma.visionGeneration.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETE' }),
        }));
      });

      it('never attaches an unrelated uploaded or generated board photograph to a new scene', async () => {
        await arrange([scene('g1', 'AI_GENERATED', 0, 'private/gen.jpg'), scene('own', 'USER_UPLOAD', 1, 'private/mine.jpg')]);
        expect(mockImageGenerate).toHaveBeenCalled();
        const request = mockImageGenerate.mock.calls[0][0];
        expect(request.type).toBe('vision');
        expect(request.referenceImages).toBeUndefined();
        expect(readPrivateImageAsset).not.toHaveBeenCalled();
        expect(request.prompt).not.toMatch(/own references/);
        expect(request.prompt).not.toContain('I own a black 1987 Buick Regal.');
      });

      it('sends only the explicitly approved appearance reference without board photos', async () => {
        const provider = { planVisionScenes: mockPlanVisionScenes, generateVisionScene: async () => Buffer.alloc(0) };
        (GeminiImageService as unknown as jest.Mock).mockImplementationOnce(() => provider);
        const { visionAppearanceReferenceService } = await import('../VisionAppearanceReferenceService');
        jest.spyOn(visionAppearanceReferenceService, 'resolveForGeneration')
          .mockResolvedValue({ id: 'ref-1', buffer: await png('#aa0000'), mimeType: 'image/jpeg' });
        jest.spyOn(visionAppearanceReferenceService, 'cleanupGenerationScoped').mockResolvedValue(undefined);
        mockPrisma.visionGeneration.findUnique.mockImplementation(async (query: { select?: unknown }) =>
          query.select ? { status: 'RUNNING', retryCount: 0 } : {
            id: 'scene-job-1', userId, anchorId, visionId: 'vision-1', kind: 'SCENE', description: sceneText, retryCount: 0, plan, appearanceReferenceId: 'ref-1',
          });
        mockImageGenerate.mockResolvedValue({ images: [{ buffer: await png('#334455') }] });
        (readPrivateImageAsset as jest.Mock).mockImplementation(async () => png('#111111'));
        mockPrisma.vision.findUnique.mockResolvedValue({ description: 'My Regal.', scenes: [scene('own', 'USER_UPLOAD', 0, 'private/mine.jpg')] });
        mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.visionGeneration.update.mockResolvedValue({});
        mockPrisma.visionGenerationCandidate.findUnique.mockResolvedValue(null);
        mockPrisma.visionGenerationCandidate.create.mockResolvedValue({});
        (uploadImageAssetFromBuffer as jest.Mock).mockImplementation(async (_i, _u, _a, index) => ({ objectKey: `private/${index}.jpg` }));
        (visionService.createAsset as jest.Mock).mockImplementation(async (_u, input) => ({ id: input.storageKey }));

        await (service as any).run('scene-job-1', 'I own a Regal', 'DESIRE');

        expect(mockImageGenerate.mock.calls[0][0].referenceImages.map((item: { role: string }) => item.role)).toEqual(['appearance']);
        expect(readPrivateImageAsset).not.toHaveBeenCalled();
      });

      it('attaches the start photo first, as role start, and keeps it out of the world count', async () => {
        mockPrisma.asset.findFirst.mockResolvedValue({ storageKey: 'private/start.jpg' });
        const provider = { planVisionScenes: mockPlanVisionScenes, generateVisionScene: async () => Buffer.alloc(0) };
        (GeminiImageService as unknown as jest.Mock).mockImplementationOnce(() => provider);
        mockImageGenerate.mockResolvedValue({ images: [{ buffer: await png('#334455') }] });
        (readPrivateImageAsset as jest.Mock).mockImplementation(async () => png('#445566'));
        mockPrisma.visionGeneration.findUnique.mockImplementation(async (query: { select?: unknown }) =>
          query.select ? { status: 'RUNNING', retryCount: 0 } : {
            id: 'scene-job-1', userId, anchorId, visionId: 'vision-1', kind: 'SCENE', description: sceneText, retryCount: 0, plan, startAssetId: 'start-asset',
          });
        mockPrisma.vision.findUnique.mockResolvedValue({ description: 'My kitchen.', scenes: [] });
        mockPrisma.visionGeneration.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.visionGeneration.update.mockResolvedValue({});
        mockPrisma.visionGenerationCandidate.findUnique.mockResolvedValue(null);
        mockPrisma.visionGenerationCandidate.create.mockResolvedValue({});
        (uploadImageAssetFromBuffer as jest.Mock).mockImplementation(async (_i, _u, _a, index) => ({ objectKey: `private/${index}.jpg` }));
        (visionService.createAsset as jest.Mock).mockImplementation(async (_u, input) => ({ id: input.storageKey }));

        await (service as any).run('scene-job-1', 'A home I love', 'DESIRE');

        const request = mockImageGenerate.mock.calls[0][0];
        expect(request.referenceImages.map((item: { role: string }) => item.role)).toEqual(['start']);
        expect(request.prompt).toMatch(/start photo/);
        expect(request.prompt).not.toMatch(/own references/);
      });

      it('still creates the moment when a Vision photograph cannot be read', async () => {
        const onlyScene = scene('own', 'USER_UPLOAD', 0, 'private/mine.jpg');
        await arrange([onlyScene], true);
        expect(mockImageGenerate.mock.calls[0][0].referenceImages).toBeUndefined();
        expect(mockPrisma.visionGenerationCandidate.create).toHaveBeenCalledTimes(2);
      });
    });
  });
});
