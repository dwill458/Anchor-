import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-user-1', emailVerified: true };
    req.dbUser = { id: 'db-user-1' };
    next();
  },
}));

const mockVisionService = {
  getAnchorVision: jest.fn(),
  createAnchorVision: jest.fn(),
  updateVision: jest.fn(),
  archiveVision: jest.fn(),
  addScene: jest.fn(),
  reorderScenes: jest.fn(),
  archiveScene: jest.fn(),
  recordVisionView: jest.fn(),
  createAsset: jest.fn(),
};

const mockIntentionCompletionService = {
  completeIntention: jest.fn(),
  getLifecycleState: jest.fn(),
};

const mockRecommendationService = {
  getRecommendationContext: jest.fn(),
  acknowledgeSignal: jest.fn(),
};
const mockUploadImageAssetFromBuffer = jest.fn();

jest.mock('../../../../services/v2/VisionService', () => ({
  visionService: mockVisionService,
}));
jest.mock('../../../../services/v2/IntentionCompletionService', () => ({
  intentionCompletionService: mockIntentionCompletionService,
}));
jest.mock('../../../../services/v2/RecommendationService', () => ({
  recommendationService: mockRecommendationService,
}));
jest.mock('../../../../services/StorageService', () => ({
  uploadImageAssetFromBuffer: mockUploadImageAssetFromBuffer,
}));

import v2Router from '../index';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v2', v2Router);
  app.use(errorHandler);
  return app;
};

describe('V2 API Routes (/api/v2)', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadImageAssetFromBuffer.mockResolvedValue({
      objectKey: 'mock-key',
      url: 'https://signed.example.com/mock.png',
      externalUrl: 'https://signed.example.com/mock.png',
    });
  });

  describe('Vision Endpoints', () => {
    it('GET /api/v2/anchors/:anchorId/vision returns anchor vision', async () => {
      mockVisionService.getAnchorVision.mockResolvedValueOnce({
        id: 'vision-1',
        anchorId: 'anchor-1',
        title: 'Vision 1',
        scenes: [],
        seenToday: false,
      });

      const res = await request(app)
        .get('/api/v2/anchors/anchor-1/vision?timeZone=America/New_York')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('vision-1');
      expect(mockVisionService.getAnchorVision).toHaveBeenCalledWith(
        'db-user-1',
        'anchor-1',
        'America/New_York'
      );
    });

    it('POST /api/v2/anchors/:anchorId/vision creates vision', async () => {
      mockVisionService.createAnchorVision.mockResolvedValueOnce({
        id: 'vision-1',
        anchorId: 'anchor-1',
        title: 'New Vision',
        scenes: [],
        seenToday: false,
      });

      const res = await request(app)
        .post('/api/v2/anchors/anchor-1/vision')
        .send({ title: 'New Vision' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Vision');
    });

    it('PATCH /api/v2/visions/:visionId updates vision', async () => {
      mockVisionService.updateVision.mockResolvedValueOnce({
        id: 'vision-1',
        title: 'Updated Title',
      });

      const res = await request(app)
        .patch('/api/v2/visions/vision-1')
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Title');
    });

    it('DELETE /api/v2/visions/:visionId archives vision', async () => {
      mockVisionService.archiveVision.mockResolvedValueOnce({ success: true });

      const res = await request(app).delete('/api/v2/visions/vision-1').expect(200);

      expect(res.body.success).toBe(true);
      expect(mockVisionService.archiveVision).toHaveBeenCalledWith('db-user-1', 'vision-1');
    });

    it('POST /api/v2/visions/:visionId/scenes adds a scene', async () => {
      mockVisionService.addScene.mockResolvedValueOnce({
        id: 'scene-1',
        sourceType: 'USER_UPLOAD',
        sortOrder: 0,
      });

      const res = await request(app)
        .post('/api/v2/visions/vision-1/scenes')
        .send({ sourceType: 'USER_UPLOAD', assetId: 'asset-1' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('scene-1');
    });

    it('PUT /api/v2/visions/:visionId/scenes/reorder updates sort order', async () => {
      mockVisionService.reorderScenes.mockResolvedValueOnce([
        { id: 'scene-2', sortOrder: 0 },
        { id: 'scene-1', sortOrder: 1 },
      ]);

      const res = await request(app)
        .put('/api/v2/visions/vision-1/scenes/reorder')
        .send({
          sceneOrders: [
            { id: 'scene-2', sortOrder: 0 },
            { id: 'scene-1', sortOrder: 1 },
          ],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('DELETE /api/v2/visions/:visionId/scenes/:sceneId archives scene', async () => {
      mockVisionService.archiveScene.mockResolvedValueOnce({ success: true });

      const res = await request(app).delete('/api/v2/visions/vision-1/scenes/scene-1').expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /api/v2/visions/:visionId/view records view and returns seenToday', async () => {
      mockVisionService.recordVisionView.mockResolvedValueOnce({
        visionId: 'vision-1',
        viewedAt: '2026-09-08T00:00:00.000Z',
        seenToday: true,
        localDateKey: '2026-09-07',
      });

      const res = await request(app)
        .post('/api/v2/visions/vision-1/view')
        .send({ timeZone: 'America/New_York' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.seenToday).toBe(true);
      expect(mockVisionService.recordVisionView).toHaveBeenCalledWith(
        'db-user-1',
        'vision-1',
        'America/New_York'
      );
    });

    it('POST /api/v2/assets/upload validates and privately stores a bounded image', async () => {
      const png =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      mockVisionService.createAsset.mockResolvedValueOnce({
        id: 'asset-1',
        storageKey: 'anchors/db-user-1/vision-assets/mock.png',
        resolvedUrl: 'https://signed.example.com/mock.png',
        mimeType: 'image/png',
      });

      const res = await request(app)
        .post('/api/v2/assets/upload')
        .send({ base64Image: png, mimeType: 'image/png' })
        .expect(201);

      expect(res.body.data.resolvedUrl).toContain('https://signed.example.com');
      expect(mockUploadImageAssetFromBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        'db-user-1',
        'vision-assets',
        0,
        { visibility: 'private', contentType: 'image/png' }
      );
      expect(mockVisionService.createAsset).toHaveBeenCalledWith(
        'db-user-1',
        expect.objectContaining({ storageKey: 'mock-key', mimeType: 'image/png' })
      );
    });

    it('rejects malformed base64 and direct public URL registration', async () => {
      await request(app)
        .post('/api/v2/assets/upload')
        .send({ base64Image: 'not base64' })
        .expect(400);

      await request(app)
        .post('/api/v2/assets/upload')
        .send({ publicUrl: 'https://public.example.com/image.png', storageKey: 'key' })
        .expect(400);
    });
  });

  describe('Anchor Lifecycle Endpoints (CCR-1)', () => {
    it('POST /api/v2/anchors/:id/complete marks intention complete', async () => {
      mockIntentionCompletionService.completeIntention.mockResolvedValueOnce({
        id: 'anchor-1',
        lifecycleState: 'completed',
        intentionCompletedAt: '2026-09-08T00:00:00.000Z',
        isArchived: false,
      });

      const res = await request(app).post('/api/v2/anchors/anchor-1/complete').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.lifecycleState).toBe('completed');
      expect(mockIntentionCompletionService.completeIntention).toHaveBeenCalledWith(
        'db-user-1',
        'anchor-1'
      );
    });

    it('PATCH /api/v2/anchors/:id/complete is supported as an alias', async () => {
      mockIntentionCompletionService.completeIntention.mockResolvedValueOnce({
        id: 'anchor-1',
        lifecycleState: 'completed',
        intentionCompletedAt: '2026-09-08T00:00:00.000Z',
        isArchived: false,
      });

      const res = await request(app).patch('/api/v2/anchors/anchor-1/complete').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.lifecycleState).toBe('completed');
    });
  });

  describe('Recommendation Context & Signal Acknowledgment Endpoints (CCR-2)', () => {
    it('GET /api/v2/anchors/:anchorId/recommendation-context returns context', async () => {
      mockRecommendationService.getRecommendationContext.mockResolvedValueOnce({
        anchorId: 'anchor-1',
        completionSignal: {
          id: 'evt-1',
          type: 'destination_reached',
          courseId: 'c-1',
          destinationTitle: 'Target reached',
        },
        vision: { exists: true, seenToday: false },
        thread: { delta7d: null, delta7dStatus: 'UNAVAILABLE', status: 'UNAVAILABLE' },
        recommendation: { action: 'Release', reason: 'destination_reached' },
      });

      const res = await request(app)
        .get('/api/v2/anchors/anchor-1/recommendation-context')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendation.action).toBe('Release');
      expect(mockRecommendationService.getRecommendationContext).toHaveBeenCalledWith(
        'db-user-1',
        'anchor-1',
        'UTC'
      );
    });

    it('POST /api/v2/anchors/:anchorId/recommendation-signals/:signalId/ack consumes signal', async () => {
      mockRecommendationService.acknowledgeSignal.mockResolvedValueOnce({
        success: true,
        signalKey: 'evt-1',
        acknowledgedAt: '2026-09-08T00:00:00.000Z',
      });

      const res = await request(app)
        .post('/api/v2/anchors/anchor-1/recommendation-signals/evt-1/ack')
        .send({ signalType: 'destination_reached' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockRecommendationService.acknowledgeSignal).toHaveBeenCalledWith(
        'db-user-1',
        'evt-1',
        'destination_reached'
      );
    });

    it('POST /api/v2/recommendations/signals/:signalId/ack is supported as alias', async () => {
      mockRecommendationService.acknowledgeSignal.mockResolvedValueOnce({
        success: true,
        signalKey: 'evt-1',
        acknowledgedAt: '2026-09-08T00:00:00.000Z',
      });

      const res = await request(app).post('/api/v2/recommendations/signals/evt-1/ack').expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
