const mockPrisma = {
  anchor: { findFirst: jest.fn() }, vision: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  visionScene: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  asset: { findFirst: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../StorageService', () => ({ resolveStorageKeyUrl: async () => 'https://cdn.test/photo.jpg' }));
import { visionService } from '../VisionService';

const date = new Date('2026-10-07T00:00:00Z');
const scene = { id: 'scene', visionId: 'vision', userId: 'user', sourceType: 'USER_UPLOAD', assetId: 'asset',
  prompt: null, caption: 'Finished work in my studio.', sortOrder: 0, isArchived: false, createdAt: date, updatedAt: date,
  asset: { storageKey: 'owned-photo' } };
const vision = { id: 'vision', anchorId: 'anchor', userId: 'user', title: null, description: 'A finished studio.',
  status: 'ACTIVE', scenes: [scene], views: [], createdAt: date, updatedAt: date };

describe('Vision caption persistence and old response compatibility', () => {
  beforeEach(() => {
    jest.resetAllMocks(); mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor' });
    mockPrisma.vision.findFirst.mockResolvedValue(vision);
    mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset', userId: 'user', storageKey: 'vision-assets/user/photo.jpg' });
    mockPrisma.visionScene.create.mockResolvedValue(scene); mockPrisma.visionScene.count.mockResolvedValue(0);
    mockPrisma.visionScene.findMany.mockResolvedValue([]); mockPrisma.vision.update.mockResolvedValue(vision);
  });
  it('persists caption when creating a Vision and returns it on the read model', async () => {
    const result = await visionService.createAnchorVision('user', 'anchor', {
      description: vision.description, scenes: [{ assetId: 'asset', sourceType: 'USER_UPLOAD', caption: scene.caption }],
    });
    expect(mockPrisma.visionScene.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ caption: scene.caption }) }));
    expect(result.scenes[0].caption).toBe(scene.caption);
  });
  it('persists caption when adding a scene and returns it', async () => {
    mockPrisma.visionScene.findFirst.mockResolvedValue(null);
    const result = await visionService.addScene('user', 'vision', { assetId: 'asset', sourceType: 'USER_UPLOAD', caption: scene.caption });
    expect(mockPrisma.visionScene.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ caption: scene.caption }) }));
    expect(result.caption).toBe(scene.caption);
  });
  it('returns null for an old scene without caption', async () => {
    mockPrisma.vision.findFirst.mockResolvedValue({ ...vision, scenes: [{ ...scene, caption: undefined }] });
    const result = await visionService.getAnchorVision('user', 'anchor');
    expect(result?.scenes[0].caption).toBeNull();
  });
});
