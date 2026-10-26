const mockPrisma = {
  anchor: { findFirst: jest.fn() }, vision: { findFirst: jest.fn(), updateMany: jest.fn() },
  visionScene: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  asset: { findFirst: jest.fn() }, visionGenerationCandidate: { findFirst: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../milestones/MilestoneService', () => ({ milestoneService: { evaluateQuietly: jest.fn() } }));
jest.mock('../../StorageService', () => ({ resolveStorageKeyUrl: async (key: string) => `https://cdn.test/${key}` }));

import { visionService } from '../VisionService';
import { UpdateVisionSceneCaptionSchema } from '../../../domain/v2/vision';

const date = new Date('2026-10-01T00:00:00Z');
function fixture(count: number) {
  return {
    id: 'vision', anchorId: 'anchor', userId: 'owner', title: 'My future', description: 'A room to create', status: 'ACTIVE',
    boardLayout: 'CLASSIC', notes: [], views: [], createdAt: date, updatedAt: date,
    scenes: Array.from({ length: count }, (_, i) => ({
      id: `scene-${i}`, visionId: 'vision', userId: 'owner', assetId: `original-${i}`, sourceType: 'USER_UPLOAD',
      prompt: null, caption: `My original caption ${i}`, slotIndex: i, sortOrder: i, focalX: .3, focalY: .7,
      isArchived: false, asset: { storageKey: `vision-assets/owner/original-${i}.jpg` }, createdAt: date, updatedAt: date,
    })),
  };
}
let stored = fixture(8);
const replacement = { assetId: 'new-asset', sourceType: 'USER_UPLOAD' as const };

describe('atomic replacement through the existing Vision scene PATCH', () => {
  beforeEach(() => {
    jest.resetAllMocks(); stored = fixture(8);
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor' });
    mockPrisma.vision.findFirst.mockImplementation(async ({ where }) => where.userId === 'owner' ? structuredClone(stored) : null);
    mockPrisma.visionScene.findFirst.mockImplementation(async ({ where }) => stored.scenes.find(scene => scene.id === where.id && scene.userId === where.userId) ?? null);
    mockPrisma.asset.findFirst.mockResolvedValue({ id: 'new-asset', userId: 'owner', storageKey: 'vision-assets/owner/new-asset.jpg' });
    mockPrisma.visionGenerationCandidate.findFirst.mockResolvedValue(null);
    mockPrisma.visionScene.updateMany.mockImplementation(async ({ where, data }) => {
      const scene = stored.scenes.find(item => item.id === where.id && item.userId === where.userId && !item.isArchived &&
        (!where.updatedAt || item.updatedAt.getTime() === where.updatedAt.getTime()));
      if (!scene) return { count: 0 };
      Object.assign(scene, data, { updatedAt: new Date('2026-10-02T00:00:00Z') });
      if (data.assetId) scene.asset = { storageKey: `vision-assets/owner/${data.assetId}.jpg` };
      return { count: 1 };
    });
  });

  it('accepts a replacement in the additive existing PATCH schema', () => {
    expect(UpdateVisionSceneCaptionSchema.parse({ replacement, expectedUpdatedAt: date.toISOString() }))
      .toEqual({ replacement, expectedUpdatedAt: date.toISOString() });
  });

  it('advances the photo conflict token even when two edits share a millisecond', async () => {
    const clock=jest.spyOn(Date,'now').mockReturnValue(date.getTime());
    try {
      await visionService.updateSceneCaption('owner','vision','scene-0',{caption:'Updated',expectedUpdatedAt:date.toISOString()});
      expect(mockPrisma.visionScene.updateMany.mock.calls[0][0].data.updatedAt.getTime()).toBeGreaterThan(date.getTime());
    } finally { clock.mockRestore(); }
  });

  it.each([1, 8])('replaces one asset on a %s-photo board without archiving, reordering, changing crops or losing captions', async count => {
    stored = fixture(count); const before = structuredClone(stored);
    const result = await visionService.updateSceneCaption('owner', 'vision', 'scene-0', { replacement, expectedUpdatedAt: date.toISOString() });
    expect(result.scenes).toHaveLength(count);
    expect(result.scenes[0]).toMatchObject({ id: 'scene-0', assetId: 'new-asset', sourceType: 'USER_UPLOAD',
      caption: 'My original caption 0', slotIndex: 0, sortOrder: 0, focal: { x: .3, y: .7 }, isArchived: false });
    expect(stored.scenes.slice(1)).toEqual(before.scenes.slice(1));
    expect(mockPrisma.visionScene.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.visionScene.create).not.toHaveBeenCalled();
    expect(mockPrisma.visionScene.update).not.toHaveBeenCalled();
  });

  it.each([1, 8])('keeps every original asset and caption after a failed replacement write on a %s-photo board', async count => {
    stored = fixture(count); const before = structuredClone(stored);
    mockPrisma.visionScene.updateMany.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(visionService.updateSceneCaption('owner', 'vision', 'scene-0', { replacement, expectedUpdatedAt: date.toISOString() }))
      .rejects.toThrow('Database unavailable');
    expect(stored).toEqual(before);
    expect(mockPrisma.visionScene.create).not.toHaveBeenCalled();
  });

  it('checks replacement asset ownership before changing the original scene', async () => {
    const before = structuredClone(stored);
    mockPrisma.asset.findFirst.mockResolvedValueOnce(null);
    await expect(visionService.updateSceneCaption('owner', 'vision', 'scene-0', { replacement, expectedUpdatedAt: date.toISOString() }))
      .rejects.toMatchObject({ statusCode: 404, code: 'ASSET_NOT_FOUND' });
    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({ where: { id: 'new-asset', userId: 'owner' } });
    expect(mockPrisma.visionScene.updateMany).not.toHaveBeenCalled(); expect(stored).toEqual(before);
  });

  it('rejects a generated asset belonging to another Vision or Anchor', async () => {
    const before = structuredClone(stored);
    await expect(visionService.updateSceneCaption('owner', 'vision', 'scene-0', {
      replacement: { ...replacement, sourceType: 'AI_GENERATED' }, expectedUpdatedAt: date.toISOString(),
    })).rejects.toMatchObject({ code: 'INVALID_VISION_CANDIDATE' });
    expect(mockPrisma.visionGenerationCandidate.findFirst).toHaveBeenCalledWith({
      where: { assetId: 'new-asset', generation: { userId: 'owner', anchorId: 'anchor', visionId: 'vision' } }, select: { id: true },
    });
    expect(mockPrisma.visionScene.updateMany).not.toHaveBeenCalled(); expect(stored).toEqual(before);
  });

  it('accepts an owned generated candidate and an explicit replacement caption', async () => {
    mockPrisma.visionGenerationCandidate.findFirst.mockResolvedValueOnce({ id: 'owned-candidate' });
    const result = await visionService.updateSceneCaption('owner', 'vision', 'scene-0', {
      replacement: { ...replacement, sourceType: 'AI_GENERATED', caption: ' My new caption ', prompt: 'The future room' }, expectedUpdatedAt: date.toISOString(),
    });
    expect(result.scenes[0]).toMatchObject({ assetId: 'new-asset', sourceType: 'AI_GENERATED', caption: 'My new caption', prompt: 'The future room' });
  });

  it('returns a recoverable 409 for a stale replacement instead of overwriting another device', async () => {
    const before = structuredClone(stored);
    await expect(visionService.updateSceneCaption('owner', 'vision', 'scene-0', {
      replacement, expectedUpdatedAt: '2026-09-01T00:00:00Z',
    })).rejects.toMatchObject({ statusCode: 409, code: 'VISION_CONFLICT' });
    expect(stored).toEqual(before);
  });

  it('rejects a foreign Vision before validating or changing any assets', async () => {
    const before = structuredClone(stored);
    await expect(visionService.updateSceneCaption('intruder', 'vision', 'scene-0', { replacement, expectedUpdatedAt: date.toISOString() }))
      .rejects.toMatchObject({ code: 'VISION_NOT_FOUND' });
    expect(mockPrisma.asset.findFirst).not.toHaveBeenCalled(); expect(stored).toEqual(before);
  });
});
