import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

jest.mock('../../middleware/auth');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  anchor: { findFirst: jest.fn() },
  visualizationScene: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
const mockRequireAccess = jest.fn();
jest.mock('../../../services/PracticeAccessService', () => ({
  requireVisualizeAccess: (...args: unknown[]) => mockRequireAccess(...args),
}));
jest.mock('../../../services/VisualizationSceneService', () => {
  const actual = jest.requireActual('../../../services/VisualizationSceneService');
  return {
    ...actual,
    generateVisualizationSceneSuggestions: jest.fn().mockResolvedValue({
      suggestions: [
        'I pause and choose calmly.',
        'I respond with steady attention.',
        'I follow through without rushing.',
      ],
      source: 'deterministic_fallback',
      version: 'scene-v1',
    }),
  };
});

import { authMiddleware } from '../../middleware/auth';
import visualizationSceneRouter from '../visualizationScenes';

const mockedAuth = authMiddleware as jest.Mock;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/anchors', visualizationSceneRouter);
  app.use(errorHandler);
  return app;
};

describe('visualization scene routes', () => {
  const app = buildApp();
  const scene = {
    id: 'scene-1',
    userId: 'user-1',
    anchorId: 'anchor-1',
    currentText: 'I pause and choose calmly.',
    originalSuggestion: 'I pause and choose calmly.',
    generationSource: 'deterministic_fallback',
    generationVersion: 'scene-v1',
    clientUpdatedAt: new Date(Date.now() - 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { uid: 'firebase-1' };
      next();
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isComped: true,
      subscriptionStatus: 'pro',
      subscriptionId: 'pro',
      trialStartedAt: new Date(),
    });
    mockPrisma.anchor.findFirst.mockResolvedValue({
      id: 'anchor-1',
      intentionText: 'Act calmly',
      category: 'custom',
    });
    mockRequireAccess.mockResolvedValue(undefined);
    mockPrisma.visualizationScene.findFirst.mockResolvedValue(null);
    mockPrisma.visualizationScene.findUnique.mockResolvedValue(scene);
    mockPrisma.visualizationScene.create.mockResolvedValue(scene);
    mockPrisma.visualizationScene.updateMany.mockResolvedValue({ count: 1 });
  });

  it('requires an account-owned anchor and server entitlement', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue(null);
    expect((await request(app).get('/api/anchors/anchor-2/visualization-scene')).status).toBe(404);
    expect(mockRequireAccess).toHaveBeenCalled();
  });

  it('returns the authoritative record for a stale last-write-wins update', async () => {
    mockPrisma.visualizationScene.findFirst.mockResolvedValue(scene);
    const response = await request(app)
      .put('/api/anchors/anchor-1/visualization-scene')
      .send({
        currentText: 'I respond with steady attention.',
        originalSuggestion: scene.originalSuggestion,
        generationSource: 'user_edited',
        generationVersion: 'scene-v1',
        clientUpdatedAt: new Date(Date.now() - 120_000).toISOString(),
      });
    expect(response.status).toBe(200);
    expect(response.body.stale).toBe(true);
    expect(response.body.data.currentText).toBe(scene.currentText);
    expect(mockPrisma.visualizationScene.updateMany).not.toHaveBeenCalled();
  });

  it('upserts a valid newer scene and generates three suggestions', async () => {
    const put = await request(app).put('/api/anchors/anchor-1/visualization-scene').send({
      currentText: scene.currentText,
      originalSuggestion: scene.originalSuggestion,
      generationSource: scene.generationSource,
      generationVersion: scene.generationVersion,
      clientUpdatedAt: new Date().toISOString(),
    });
    expect(put.status).toBe(200);
    expect(mockPrisma.visualizationScene.create).toHaveBeenCalled();
    const generated = await request(app)
      .post('/api/anchors/anchor-1/visualization-scene/suggestions')
      .send({});
    expect(generated.status).toBe(200);
    expect(generated.body.data.suggestions).toHaveLength(3);
  });

  it('does not overwrite a scene that wins a concurrent update', async () => {
    const older = { ...scene, clientUpdatedAt: new Date(Date.now() - 120_000) };
    const authoritative = {
      ...scene,
      currentText: 'I follow through without rushing.',
      clientUpdatedAt: new Date(),
    };
    mockPrisma.visualizationScene.findFirst.mockResolvedValue(older);
    mockPrisma.visualizationScene.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.visualizationScene.findUnique.mockResolvedValue(authoritative);

    const response = await request(app)
      .put('/api/anchors/anchor-1/visualization-scene')
      .send({
        currentText: 'I respond with steady attention.',
        originalSuggestion: scene.originalSuggestion,
        generationSource: 'user_edited',
        generationVersion: 'scene-v1',
        clientUpdatedAt: new Date(Date.now() - 30_000).toISOString(),
      });

    expect(response.status).toBe(200);
    expect(response.body.stale).toBe(true);
    expect(response.body.data.currentText).toBe(authoritative.currentText);
  });
});
