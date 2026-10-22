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

const mockStartScene = jest.fn();
const mockStartGeneration = jest.fn();
const mockLatestGeneration = jest.fn();
const mockConversationRead = jest.fn();
const mockConversationCreate = jest.fn();
const mockConversationUpdate = jest.fn();
const mockLimiterCalls: string[] = [];

jest.mock('../../../../services/v2/VisionGenerationService', () => ({
  visionGenerationService: {
    startScene: (...args: unknown[]) => mockStartScene(...args),
    start: (...args: unknown[]) => mockStartGeneration(...args),
    latest: (...args: unknown[]) => mockLatestGeneration(...args),
  },
}));
jest.mock('../../../../services/v2/VisionConversationService', () => ({
  visionConversationService: {
    read: (...args: unknown[]) => mockConversationRead(...args),
    create: (...args: unknown[]) => mockConversationCreate(...args),
    update: (...args: unknown[]) => mockConversationUpdate(...args),
  },
}));
jest.mock('../../../../services/v2/VisionService', () => ({ visionService: {} }));
jest.mock('../../../../services/v2/VisionAppearanceReferenceService', () => ({ visionAppearanceReferenceService: {} }));
jest.mock('../../../../services/StorageService', () => ({ uploadImageAssetFromBuffer: jest.fn() }));
jest.mock('../../../../services/GeminiImageService', () => ({ GeminiImageService: jest.fn() }));
jest.mock('../../../../services/v2/visionPhotoExpand', () => ({
  expandPhotoToVision: jest.fn(),
  PhotoExpandError: class PhotoExpandError extends Error {},
}));
jest.mock('../../../../services/MonetizationAccessService', () => ({ getMonetizationAccess: jest.fn() }));
jest.mock('../../../../api/middleware/aiRateLimit', () => ({
  globalAiCeilingLimiter: (_req: unknown, _res: unknown, next: () => void) => { mockLimiterCalls.push('global'); next(); },
  visionGenerationLimiter: (_req: unknown, _res: unknown, next: () => void) => { mockLimiterCalls.push('vision'); next(); },
  visionAppearanceLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAiDeveloper: jest.fn(() => false),
}));

import visionRouter from '../visionRoutes';

const app = express();
app.use(express.json());
app.use('/api/v2', visionRouter);
app.use(errorHandler);

const anchorId = 'anchor-1';
const sessionId = '81b25d8b-4e3c-4f87-89a6-a2fa600b821a';
const parentCandidateId = '76c21423-3908-493c-aa29-8a71ac57d184';
const refIds = [
  '6167fcb1-dc3f-4c09-8f6a-d6fdff2389cb',
  'ed570ab8-89b2-4d4d-8e0e-8f5c9a2f9695',
  '1c7506f4-341e-4ed2-9c65-45244f28d9a8',
  '3b999c8d-9a1a-4633-8b5a-33c4f792c889',
  '249f2de2-4567-48e3-94e4-c103248eb617',
  '1f9f065e-e66c-4db5-99f8-8e1eab642e13',
];
const refs = refIds.slice(0, 5).map((assetId, index) => ({
  assetId,
  role: (['identity', 'place', 'object', 'inspiration', 'identity'] as const)[index],
  label: `Reference ${index + 1}`,
}));

function sceneRequest(overrides: Record<string, unknown> = {}) {
  return {
    sceneDescription: 'A thoughtful scene about learning to build a boat',
    idempotencyKey: 'request-key-0001',
    ...overrides,
  };
}

describe('Vision conversation routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLimiterCalls.length = 0;
    mockStartScene.mockResolvedValue({ id: 'job-1', status: 'QUEUED' });
    mockStartGeneration.mockResolvedValue({ id: 'set-1', status: 'QUEUED' });
    mockLatestGeneration.mockResolvedValue(null);
    mockConversationRead.mockResolvedValue({ id: sessionId });
    mockConversationCreate.mockResolvedValue({ id: sessionId });
    mockConversationUpdate.mockResolvedValue({ id: sessionId });
  });

  it('keeps the legacy single start photo path compatible', async () => {
    const startAssetId = refIds[0];
    await request(app)
      .post(`/api/v2/anchors/${anchorId}/vision/scene-generation`)
      .send(sceneRequest({ startAssetId }))
      .expect(202);

    expect(mockStartScene).toHaveBeenCalledWith(
      'db-user-1', anchorId, 'A thoughtful scene about learning to build a boat',
      'request-key-0001', undefined, startAssetId, undefined, undefined,
    );
    expect(mockLimiterCalls).toEqual(['global', 'vision']);
  });

  it('dispatches five structured references in the submitted order and preserves EDIT lineage fields', async () => {
    await request(app)
      .post(`/api/v2/anchors/${anchorId}/vision/scene-generation`)
      .send(sceneRequest({
        operation: 'EDIT', sessionId, parentCandidateId, references: refs,
      }))
      .expect(202);

    expect(mockStartScene).toHaveBeenCalledWith(
      'db-user-1', anchorId, 'A thoughtful scene about learning to build a boat',
      'request-key-0001', undefined, undefined, undefined,
      { operation: 'EDIT', references: refs, sessionId, parentCandidateId },
    );
    expect(mockLimiterCalls).toEqual(['global', 'vision']);
  });

  it.each([
    ['EDIT without a parent', { operation: 'EDIT', sessionId }],
    ['EDIT without a session', { operation: 'EDIT', parentCandidateId }],
    ['six references', { operation: 'COMPOSE', references: [...refs, { ...refs[0], assetId: refIds[5] }] }],
    ['duplicate references', { operation: 'COMPOSE', references: [refs[0], { ...refs[1], assetId: refs[0].assetId }] }],
    ['mixed structured and legacy reference inputs', { operation: 'COMPOSE', references: refs.slice(0, 2), startAssetId: refIds[5] }],
    ['mixed structured and appearance reference inputs', { operation: 'COMPOSE', references: refs.slice(0, 2), appearanceReferenceId: sessionId }],
  ])('rejects %s before invoking the generation service', async (_label, input) => {
    await request(app)
      .post(`/api/v2/anchors/${anchorId}/vision/scene-generation`)
      .send(sceneRequest(input))
      .expect(400);

    expect(mockStartScene).not.toHaveBeenCalled();
  });

  it('rejects a non-developer dev image model before generation dispatch', async () => {
    await request(app)
      .post(`/api/v2/anchors/${anchorId}/vision/scene-generation`)
      .send(sceneRequest({ devImageModel: 'gemini-nano-banana-2.1' }))
      .expect(403);

    expect(mockStartScene).not.toHaveBeenCalled();
    expect(mockLimiterCalls).toEqual(['global', 'vision']);
  });

  it('keeps the legacy full-set generation endpoint behind both AI limiters', async () => {
    await request(app)
      .post(`/api/v2/anchors/${anchorId}/vision/generation`)
      .send({ description: 'A clear picture of a meaningful future with room to grow.', idempotencyKey: 'request-key-0002' })
      .expect(202);

    expect(mockStartGeneration).toHaveBeenCalledWith(
      'db-user-1', anchorId, 'A clear picture of a meaningful future with room to grow.',
      'request-key-0002', undefined, undefined,
    );
    expect(mockLimiterCalls).toEqual(['global', 'vision']);
  });

  it('propagates the authenticated owner and route params through session read/create/update', async () => {
    await request(app)
      .get(`/api/v2/anchors/${anchorId}/vision/creation-sessions`)
      .expect(200);
    expect(mockConversationRead).toHaveBeenLastCalledWith('db-user-1', anchorId);

    await request(app)
      .get(`/api/v2/anchors/${anchorId}/vision/creation-sessions/${sessionId}`)
      .expect(200);
    expect(mockConversationRead).toHaveBeenLastCalledWith('db-user-1', anchorId, sessionId);

    await request(app)
      .post(`/api/v2/anchors/${anchorId}/vision/creation-sessions`)
      .send({ id: sessionId, description: 'A new scene idea' })
      .expect(201);
    expect(mockConversationCreate).toHaveBeenCalledWith('db-user-1', anchorId, sessionId, 'A new scene idea');

    const update = { draftPrompt: 'Make the light softer', viewedRoundId: 'round-00000001' };
    await request(app)
      .patch(`/api/v2/anchors/${anchorId}/vision/creation-sessions/${sessionId}`)
      .send(update)
      .expect(200);
    expect(mockConversationUpdate).toHaveBeenCalledWith('db-user-1', anchorId, sessionId, update);
  });
});
