import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

jest.mock('../../middleware/auth', () => ({
  optionalAuthMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'firebase-user-1', email: 'test@example.com' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'firebase-user-1', email: 'test@example.com' };
    next();
  },
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
import { generateAllMantraAudio, isTTSAvailable } from '../../../services/TTSService';

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

describe('POST /api/ai/mantra/audio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'db-user-1' });
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1', userId: 'db-user-1' });
    (isTTSAvailable as jest.Mock).mockReturnValue(true);
    (generateAllMantraAudio as jest.Mock).mockResolvedValue({
      syllabic: 'https://cdn.example.com/syllabic.mp3',
      rhythmic: 'https://cdn.example.com/rhythmic.mp3',
      phonetic: 'https://cdn.example.com/phonetic.mp3',
    });
  });

  it('ignores client-supplied userId and uses the authenticated anchor owner', async () => {
    const res = await request(buildApp())
      .post('/api/ai/mantra/audio')
      .send({
        mantras: {
          syllabic: 'CL-OS',
          rhythmic: 'CLO / S',
          phonetic: 'klos',
        },
        userId: 'attacker-user',
        anchorId: 'anchor-1',
        voicePreset: 'neutral_calm',
      });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { authUid: 'firebase-user-1' },
      select: { id: true },
    });
    expect(mockPrisma.anchor.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'anchor-1',
        userId: 'db-user-1',
      },
      select: {
        id: true,
        userId: true,
      },
    });
    expect(generateAllMantraAudio).toHaveBeenCalledWith(
      {
        syllabic: 'CL-OS',
        rhythmic: 'CLO / S',
        phonetic: 'klos',
      },
      'db-user-1',
      'anchor-1',
      'neutral_calm'
    );
  });

  it('fails closed when the authenticated user does not own the anchor', async () => {
    mockPrisma.anchor.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/ai/mantra/audio')
      .send({
        mantras: {
          syllabic: 'CL-OS',
          rhythmic: 'CLO / S',
          phonetic: 'klos',
        },
        userId: 'attacker-user',
        anchorId: 'anchor-1',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Anchor not found');
    expect(generateAllMantraAudio).not.toHaveBeenCalled();
  });
});
