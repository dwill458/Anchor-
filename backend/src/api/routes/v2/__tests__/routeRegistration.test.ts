import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-user-1' };
    req.dbUser = { id: 'db-user-1' };
    next();
  },
}));

const mockPrisma = {
  user: { findUnique: jest.fn(), updateMany: jest.fn() },
};
const mockVisionService = { getAnchorVision: jest.fn() };
const mockIntentionCompletionService = { completeIntention: jest.fn() };
const mockRecommendationService = {
  getRecommendationContext: jest.fn(),
  acknowledgeSignal: jest.fn(),
};
const mockThreadStrengthService = { calculateForPracticeSession: jest.fn() };

jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../../../services/RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../../services/MonetizationAccessService', () => ({
  resolveMonetizationAccess: jest.fn().mockResolvedValue({
    hasProAccess: false,
    entitlementVerified: false,
    isTrialPeriod: true,
    isComped: false,
    legacyMigrationAccess: false,
    source: 'free',
    productIdentifier: null,
    expiresAt: null,
  }),
}));
jest.mock('../../../../services/v2/ThreadStrengthService', () => ({
  threadStrengthService: mockThreadStrengthService,
}));
jest.mock('../../../../services/v2/VisionService', () => ({
  visionService: mockVisionService,
}));
jest.mock('../../../../services/v2/IntentionCompletionService', () => ({
  intentionCompletionService: mockIntentionCompletionService,
}));
jest.mock('../../../../services/v2/RecommendationService', () => ({
  recommendationService: mockRecommendationService,
}));

import v2Router, { v2BillingRoutes, v2ThreadRoutes } from '../index';

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v2/billing', v2BillingRoutes);
  app.use('/api/v2/thread', v2ThreadRoutes);
  app.use('/api/v2', v2Router);
  app.use(errorHandler);
  return app;
}

describe('V2 route registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.THREAD_V2_AUTHORITY = 'true';
  });

  afterAll(() => {
    delete process.env.THREAD_V2_AUTHORITY;
  });

  it('preserves the dedicated billing route', async () => {
    const startedAt = new Date('2026-09-08T00:00:00.000Z');
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'db-user-1', isComped: false, trialStartedAt: null })
      .mockResolvedValueOnce({ id: 'db-user-1', isComped: false, trialStartedAt: startedAt });
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const response = await request(buildApp()).post('/api/v2/billing/trial/activate').send({});

    expect(response.status).toBe(200);
    expect(response.body.data.trialState).toBe('ACTIVE');
  });

  it('preserves the dedicated thread route', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'db-user-1' });
    mockThreadStrengthService.calculateForPracticeSession.mockResolvedValueOnce({
      anchorId: 'anchor-1',
      sessionId: 'session-1',
      afterStrength: 42,
    });

    const response = await request(buildApp())
      .post('/api/v2/thread/completions/session-1')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.sessionId).toBe('session-1');
  });

  it('registers the additive Vision, completion, and recommendation routes', async () => {
    mockVisionService.getAnchorVision.mockResolvedValueOnce({ id: 'vision-1' });
    mockIntentionCompletionService.completeIntention.mockResolvedValueOnce({
      id: 'anchor-1',
      lifecycleState: 'completed',
    });
    mockRecommendationService.getRecommendationContext.mockResolvedValueOnce({
      anchorId: 'anchor-1',
      recommendation: { action: 'Focus', reason: 'daily_focus' },
    });

    const app = buildApp();
    await request(app).get('/api/v2/anchors/anchor-1/vision').expect(200);
    await request(app).post('/api/v2/anchors/anchor-1/complete').expect(200);
    await request(app).get('/api/v2/anchors/anchor-1/recommendation-context').expect(200);
  });
});
