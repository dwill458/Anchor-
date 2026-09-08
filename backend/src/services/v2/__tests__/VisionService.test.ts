const mockPrisma = {
  $transaction: jest.fn(),
  anchor: {
    findFirst: jest.fn(),
  },
  vision: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  visionScene: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  visionView: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  asset: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../StorageService', () => ({
  resolveStorageKeyUrl: jest.fn((key: string) => Promise.resolve(`https://signed.cdn/${key}`)),
  uploadImageAssetFromBuffer: jest.fn(),
}));

import { visionService, computeLocalDateKey } from '../VisionService';
import { resolveStorageKeyUrl } from '../../StorageService';
import { AppError } from '../../../api/middleware/errorHandler';

describe('VisionService (Anchor 2.0 V2)', () => {
  const USER_ID = 'user-test-1';
  const OTHER_USER_ID = 'user-test-2';
  const ANCHOR_ID = 'anchor-test-1';
  const VISION_ID = 'vision-test-1';

  beforeEach(() => {
    jest.resetAllMocks();
    (resolveStorageKeyUrl as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(`https://signed.cdn/${key}`)
    );
  });

  describe('computeLocalDateKey', () => {
    it('computes correct YYYY-MM-DD for a specific IANA timeZone', () => {
      // 2026-09-08 02:00:00 UTC is 2026-09-07 22:00:00 EDT (America/New_York)
      const date = new Date('2026-09-08T02:00:00.000Z');
      expect(computeLocalDateKey(date, 'America/New_York')).toBe('2026-09-07');
      expect(computeLocalDateKey(date, 'UTC')).toBe('2026-09-08');
      expect(computeLocalDateKey(date, 'Asia/Tokyo')).toBe('2026-09-08');
    });

    it('falls back safely if timezone is invalid', () => {
      const date = new Date('2026-09-08T02:00:00.000Z');
      expect(computeLocalDateKey(date, 'Invalid/Timezone')).toBe('2026-09-08');
    });
  });

  describe('createAnchorVision & ownership enforcement', () => {
    it('owner can create Vision with scenes and asset references', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValue({
        id: ANCHOR_ID,
        userId: USER_ID,
        isArchived: false,
      });
      mockPrisma.vision.findFirst
        .mockResolvedValueOnce(null) // existing active check
        .mockResolvedValueOnce({
          // reload in getAnchorVision
          id: VISION_ID,
          anchorId: ANCHOR_ID,
          userId: USER_ID,
          title: 'My 10k Users Vision',
          description: 'A thriving SaaS with 10k users',
          status: 'ACTIVE',
          createdAt: new Date('2026-09-01T10:00:00.000Z'),
          updatedAt: new Date('2026-09-01T10:00:00.000Z'),
          scenes: [
            {
              id: 'scene-1',
              visionId: VISION_ID,
              sourceType: 'USER_UPLOAD',
              assetId: 'asset-1',
              prompt: null,
              sortOrder: 0,
              isArchived: false,
              asset: { storageKey: 'visions/user-test-1/asset-1.png' },
              createdAt: new Date('2026-09-01T10:00:00.000Z'),
              updatedAt: new Date('2026-09-01T10:00:00.000Z'),
            },
          ],
          views: [],
        });

      mockPrisma.vision.create.mockResolvedValueOnce({
        id: VISION_ID,
        anchorId: ANCHOR_ID,
        userId: USER_ID,
        title: 'My 10k Users Vision',
        description: 'A thriving SaaS with 10k users',
        status: 'ACTIVE',
      });
      mockPrisma.asset.findFirst.mockResolvedValueOnce({
        id: 'asset-1',
        userId: USER_ID,
      });
      mockPrisma.visionScene.create.mockResolvedValueOnce({
        id: 'scene-1',
      });

      const vision = await visionService.createAnchorVision(USER_ID, ANCHOR_ID, {
        title: 'My 10k Users Vision',
        description: 'A thriving SaaS with 10k users',
        scenes: [
          {
            sourceType: 'USER_UPLOAD',
            assetId: 'asset-1',
            sortOrder: 0,
          },
        ],
      });

      expect(vision.id).toBe(VISION_ID);
      expect(vision.title).toBe('My 10k Users Vision');
      expect(vision.scenes).toHaveLength(1);
      expect(vision.scenes[0].resolvedImageUrl).toContain('https://signed.cdn/');
      expect(vision.seenToday).toBe(false);
    });

    it('rejects creation if user does not own the anchor', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce(null);

      await expect(
        visionService.createAnchorVision(OTHER_USER_ID, ANCHOR_ID, {
          title: 'Unauthorized Vision',
        })
      ).rejects.toThrow('Anchor not found');
    });

    it('rejects linking another user asset in scene creation', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValue({
        id: ANCHOR_ID,
        userId: USER_ID,
        isArchived: false,
      });
      mockPrisma.vision.findFirst.mockResolvedValueOnce(null);
      mockPrisma.vision.create.mockResolvedValueOnce({
        id: VISION_ID,
        anchorId: ANCHOR_ID,
        userId: USER_ID,
      });
      // Asset belongs to someone else
      mockPrisma.asset.findFirst.mockResolvedValueOnce(null);

      await expect(
        visionService.createAnchorVision(USER_ID, ANCHOR_ID, {
          title: 'Test Vision',
          scenes: [{ sourceType: 'USER_UPLOAD', assetId: 'foreign-asset-id' }],
        })
      ).rejects.toThrow('Asset not found or not owned by user');
    });
  });

  describe('seenToday tracking & timezone behaviour', () => {
    it('returns seenToday: false before view, and seenToday: true after view in matching timezone', async () => {
      const now = new Date('2026-09-07T22:00:00.000Z');
      const timeZone = 'America/New_York';
      const localDateKey = computeLocalDateKey(now, timeZone); // '2026-09-07'

      mockPrisma.anchor.findFirst.mockResolvedValue({
        id: ANCHOR_ID,
        userId: USER_ID,
        isArchived: false,
      });

      // 1. Before view: no views
      mockPrisma.vision.findFirst.mockResolvedValueOnce({
        id: VISION_ID,
        anchorId: ANCHOR_ID,
        userId: USER_ID,
        title: 'Vision',
        status: 'ACTIVE',
        scenes: [],
        views: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const before = await visionService.getAnchorVision(USER_ID, ANCHOR_ID, timeZone);
      expect(before?.seenToday).toBe(false);

      // 2. Record view
      mockPrisma.vision.findFirst.mockResolvedValueOnce({
        id: VISION_ID,
        userId: USER_ID,
        status: 'ACTIVE',
      });
      mockPrisma.visionView.create.mockResolvedValueOnce({
        id: 'view-1',
        visionId: VISION_ID,
        userId: USER_ID,
        viewedAt: now,
        localDateKey,
        timeZone,
      });

      const viewRecord = await visionService.recordVisionView(USER_ID, VISION_ID, timeZone, now);
      expect(viewRecord.seenToday).toBe(true);
      expect(viewRecord.localDateKey).toBe(localDateKey);

      // 3. After view: has view with matching localDateKey
      mockPrisma.vision.findFirst.mockResolvedValueOnce({
        id: VISION_ID,
        anchorId: ANCHOR_ID,
        userId: USER_ID,
        title: 'Vision',
        status: 'ACTIVE',
        scenes: [],
        views: [
          {
            id: 'view-1',
            viewedAt: now,
            localDateKey,
            timeZone,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const after = await visionService.getAnchorVision(USER_ID, ANCHOR_ID, timeZone, now);
      expect(after?.seenToday).toBe(true);
    });

    it('repeated same-day view is safe and remains seenToday: true', async () => {
      mockPrisma.vision.findFirst.mockResolvedValue({
        id: VISION_ID,
        userId: USER_ID,
        status: 'ACTIVE',
      });
      mockPrisma.visionView.create.mockResolvedValue({
        id: 'view-2',
        visionId: VISION_ID,
        userId: USER_ID,
        viewedAt: new Date(),
        localDateKey: '2026-09-07',
        timeZone: 'UTC',
      });

      const view1 = await visionService.recordVisionView(USER_ID, VISION_ID, 'UTC');
      const view2 = await visionService.recordVisionView(USER_ID, VISION_ID, 'UTC');
      expect(view1.seenToday).toBe(true);
      expect(view2.seenToday).toBe(true);
    });
  });

  describe('archived/deleted Vision', () => {
    it('archived Vision is not returned as active vision for the anchor', async () => {
      mockPrisma.anchor.findFirst.mockResolvedValueOnce({
        id: ANCHOR_ID,
        userId: USER_ID,
        isArchived: false,
      });
      // Query filters status: 'ACTIVE', so null is returned if archived
      mockPrisma.vision.findFirst.mockResolvedValueOnce(null);

      const result = await visionService.getAnchorVision(USER_ID, ANCHOR_ID);
      expect(result).toBeNull();
    });

    it('archiveVision updates status to ARCHIVED', async () => {
      mockPrisma.vision.findFirst.mockResolvedValueOnce({
        id: VISION_ID,
        userId: USER_ID,
      });
      mockPrisma.vision.update.mockResolvedValueOnce({
        id: VISION_ID,
        status: 'ARCHIVED',
      });

      const res = await visionService.archiveVision(USER_ID, VISION_ID);
      expect(res.success).toBe(true);
      expect(mockPrisma.vision.update).toHaveBeenCalledWith({
        where: { id: VISION_ID },
        data: { status: 'ARCHIVED' },
      });
    });
  });

  describe('scenes reorder and archive', () => {
    it('reorders scenes in a transaction', async () => {
      mockPrisma.vision.findFirst.mockResolvedValueOnce({
        id: VISION_ID,
        userId: USER_ID,
        status: 'ACTIVE',
      });
      mockPrisma.$transaction.mockResolvedValueOnce([]);
      mockPrisma.visionScene.findMany.mockResolvedValueOnce([
        {
          id: 'scene-2',
          visionId: VISION_ID,
          sourceType: 'AI_GENERATED',
          assetId: null,
          prompt: 'scene 2',
          sortOrder: 0,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'scene-1',
          visionId: VISION_ID,
          sourceType: 'USER_UPLOAD',
          assetId: null,
          prompt: 'scene 1',
          sortOrder: 1,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const reordered = await visionService.reorderScenes(USER_ID, VISION_ID, {
        sceneOrders: [
          { id: 'scene-2', sortOrder: 0 },
          { id: 'scene-1', sortOrder: 1 },
        ],
      });

      expect(reordered).toHaveLength(2);
      expect(reordered[0].id).toBe('scene-2');
      expect(reordered[1].id).toBe('scene-1');
    });

    it('archives a scene', async () => {
      mockPrisma.visionScene.findFirst.mockResolvedValueOnce({
        id: 'scene-1',
        visionId: VISION_ID,
        userId: USER_ID,
      });
      mockPrisma.visionScene.update.mockResolvedValueOnce({
        id: 'scene-1',
        isArchived: true,
      });

      const res = await visionService.archiveScene(USER_ID, VISION_ID, 'scene-1');
      expect(res.success).toBe(true);
      expect(mockPrisma.visionScene.update).toHaveBeenCalledWith({
        where: { id: 'scene-1' },
        data: { isArchived: true },
      });
    });
  });
});
