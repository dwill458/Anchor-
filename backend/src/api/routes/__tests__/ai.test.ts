import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

jest.mock('../../middleware/auth', () => ({
  optionalAuthMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'firebase-user-1', email: 'test@example.com' };
    next();
  },
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

const mockPrisma = {
  user: { findUnique: jest.fn() },
  anchor: { findFirst: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

const mockEnhanceSigilWithAI = jest.fn();
const mockEnhanceSigilWithControlNet = jest.fn();
jest.mock('../../../services/AIEnhancer', () => ({
  enhanceSigilWithAI: (...args: unknown[]) => mockEnhanceSigilWithAI(...args),
  enhanceSigilWithControlNet: (...args: unknown[]) => mockEnhanceSigilWithControlNet(...args),
  estimateGenerationTime: jest.fn(() => 30),
  getCostEstimate: jest.fn(() => ({ amount: 1 })),
}));

const mockUploadImageFromUrl = jest.fn();
jest.mock('../../../services/StorageService', () => ({
  uploadImageFromUrl: (...args: unknown[]) => mockUploadImageFromUrl(...args),
}));

jest.mock('../../../services/MantraGenerator', () => ({
  generateMantra: jest.fn(),
  getRecommendedMantraStyle: jest.fn(),
}));

jest.mock('../../../services/TTSService', () => ({
  generateAllMantraAudio: jest.fn(),
  isTTSAvailable: jest.fn(() => false),
  getAvailableVoicePresets: jest.fn(() => []),
}));

import aiRouter from '../ai';

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
  app.use(errorHandler);
  return app;
}

describe('POST /api/ai/enhance-controlnet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'db-user-1' });
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
  });

  it('returns storage URLs exactly as returned by uploadImageFromUrl', async () => {
    mockEnhanceSigilWithAI.mockResolvedValue({
      variations: [
        {
          imageUrl: 'https://upstream.example.com/generated.png',
          structureMatch: {
            combinedScore: 0.95,
            iouScore: 0.96,
            edgeOverlapScore: 0.94,
            structurePreserved: true,
            classification: 'Structure Preserved',
          },
          wasComposited: false,
          seed: 42,
        },
      ],
      passingCount: 1,
      bestVariationIndex: 0,
      model: 'gemini-3.1-flash-image-preview',
      prompt: 'prompt',
      negativePrompt: 'negative',
      generationTime: 2,
      controlMethod: 'lineart',
      styleApplied: 'watercolor',
      structureThreshold: 0.8,
    });
    mockUploadImageFromUrl.mockResolvedValue(
      'http://localhost:8000/uploads/anchors/db-user-1/anchor-1/123e4567-variation-0.png'
    );

    const res = await request(buildApp())
      .post('/api/ai/enhance-controlnet')
      .send({
        sigilSvg: '<svg><rect/></svg>',
        styleChoice: 'watercolor',
        anchorId: 'anchor-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.variations[0].imageUrl).toBe(
      'http://localhost:8000/uploads/anchors/db-user-1/anchor-1/123e4567-variation-0.png'
    );
    expect(res.body.variationUrls[0]).toBe(
      'http://localhost:8000/uploads/anchors/db-user-1/anchor-1/123e4567-variation-0.png'
    );
  });
});
