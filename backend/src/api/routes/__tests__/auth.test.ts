/**
 * Route tests for /api/auth
 *
 * Covers:
 *   POST   /sync     upsert user profile
 *   GET    /me       get current user
 *   PUT    /profile  update display name
 *   PUT    /settings update settings
 *   DELETE /me       delete account
 */

import express, { Application } from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../../middleware/errorHandler';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../middleware/auth');
jest.mock('../../../config/firebase');
jest.mock('express-rate-limit', () => jest.fn(() => (_req: any, _res: any, next: any) => next()));

// Prisma mock — provide jest.fn() for every method used in auth routes
const mockPrisma = {
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userSettings: {
    upsert: jest.fn(),
  },
  anchor: {
    findMany: jest.fn(),
  },
  activation: {
    findMany: jest.fn(),
  },
  charge: {
    findMany: jest.fn(),
  },
  practiceSession: {
    findMany: jest.fn(),
  },
  visualizationScene: {
    findMany: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
  },
  burnedAnchor: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  flaggedContent: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  syncQueue: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  course: { findMany: jest.fn(), deleteMany: jest.fn() },
  waypoint: { findMany: jest.fn() },
  courseAnchorLink: { findMany: jest.fn() },
  reflection: { findMany: jest.fn(), deleteMany: jest.fn() },
  courseEvent: { findMany: jest.fn() },
  aIPlanProposal: { findMany: jest.fn(), deleteMany: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { authMiddleware } from '../../middleware/auth';
import { getFirebaseAdmin } from '../../../config/firebase';
import authRouter from '../auth';

const mockedAuthMiddleware = authMiddleware as jest.Mock;
const mockedGetFirebaseAdmin = getFirebaseAdmin as jest.Mock;

// ── Test App ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USER_AUTH = { uid: 'firebase-uid-1', email: 'test@example.com' };

const MOCK_DB_USER = {
  id: 'db-user-1',
  authUid: 'firebase-uid-1',
  email: 'test@example.com',
  displayName: 'Test User',
  hasCompletedOnboarding: false,
  isComped: false,
  subscriptionStatus: 'free',
  totalAnchorsCreated: 0,
  totalActivations: 0,
  currentStreak: 0,
  longestStreak: 0,
  stabilizesTotal: 0,
  stabilizeStreakDays: 0,
  lastStabilizeAt: null,
  createdAt: new Date('2024-01-01'),
  trialStartedAt: new Date(),
  updatedAt: new Date('2024-01-01'),
  lastSeenAt: new Date('2024-01-01'),
};

const MOCK_SETTINGS = {
  id: 'settings-1',
  userId: 'db-user-1',
  notificationsEnabled: true,
  dailyReminderTime: '09:00',
  streakProtection: false,
  defaultChargeDuration: 300,
  focusSessionMode: 'quick',
  focusSessionDuration: 30,
  focusSessionAudio: 'ambient',
  primeSessionDuration: 120,
  visualizeSessionDuration: 180,
  primeSessionAudio: 'ambient',
  sessionAudioDefaults: {
    focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    visualize: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
  },
  hapticIntensity: 3,
  vaultViewType: 'grid',
  updatedAt: new Date('2024-01-01'),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.COMPED_ACCESS_EMAILS;
  (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) =>
    callback(mockPrisma)
  );
  (mockPrisma.practiceSession.findMany as jest.Mock).mockResolvedValue([]);
  (mockPrisma.visualizationScene.findMany as jest.Mock).mockResolvedValue([]);

  mockedGetFirebaseAdmin.mockReturnValue({
    auth: () => ({
      getUser: jest.fn(),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    }),
  });

  mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
    req.user = MOCK_USER_AUTH;
    next();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/sync
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/sync', () => {
  it('creates or updates user and returns profile', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_DB_USER);
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@example.com');
    expect(res.body.data.trialStartedAt).toBe(MOCK_DB_USER.trialStartedAt.toISOString());
    expect(res.body.data.isTrialExpired).toBe(false);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it('promotes onboarding completion when requested during sync', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      hasCompletedOnboarding: true,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      hasCompletedOnboarding: true,
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp()).post('/api/auth/sync').send({
      displayName: 'Test User',
      authProvider: 'email',
      hasCompletedOnboarding: true,
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasCompletedOnboarding: true }),
      })
    );
  });

  it('marks allowlisted emails as comped during sync', async () => {
    process.env.COMPED_ACCESS_EMAILS = 'test@example.com,other@example.com';
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      isComped: true,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      isComped: true,
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.data.isComped).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isComped: true }),
      })
    );
  });

  it('links an existing user by email when auth uid changes', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValueOnce(MOCK_DB_USER);
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      authUid: 'firebase-uid-1',
      authProvider: 'google',
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'google' });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOCK_DB_USER.id },
        data: expect.objectContaining({
          authUid: 'firebase-uid-1',
          authProvider: 'google',
        }),
      })
    );
  });

  it('links an existing user by email when sign-in sync disallows creation', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValueOnce(MOCK_DB_USER);
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      authUid: 'firebase-uid-1',
      authProvider: 'google',
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'google', allowCreate: false });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOCK_DB_USER.id },
        data: expect.objectContaining({
          authUid: 'firebase-uid-1',
          authProvider: 'google',
        }),
      })
    );
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('does not create a user when sign-in sync disallows creation and no match exists', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'google', allowCreate: false });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('creates a user when no auth uid or email match exists', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.user.create as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'google' });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
  });

  it('recovers when a concurrent sync creates the same email first', async () => {
    const uniqueEmailConflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }
    );

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...MOCK_DB_USER,
      authUid: 'firebase-uid-from-winning-request',
    });
    (mockPrisma.user.create as jest.Mock).mockRejectedValueOnce(uniqueEmailConflict);
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      authProvider: 'google',
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'google' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(2);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOCK_DB_USER.id },
        data: expect.objectContaining({
          authUid: 'firebase-uid-1',
          authProvider: 'google',
          email: 'test@example.com',
        }),
      })
    );
    expect(mockPrisma.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: MOCK_DB_USER.id },
      update: {},
      create: { userId: MOCK_DB_USER.id },
    });
  });

  it('links an existing user by email case-insensitively and normalizes the stored email', async () => {
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { uid: 'firebase-uid-2', email: 'Test@Example.com ' };
      next();
    });

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_DB_USER,
      email: 'TEST@example.com',
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      authUid: 'firebase-uid-2',
      authProvider: 'google',
      email: 'test@example.com',
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'google' });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'test@example.com',
          mode: 'insensitive',
        },
      },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOCK_DB_USER.id },
        data: expect.objectContaining({
          email: 'test@example.com',
          authUid: 'firebase-uid-2',
          authProvider: 'google',
        }),
      })
    );
    expect(res.body.data.email).toBe('test@example.com');
  });

  it('returns 400 when user has no email in token', async () => {
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { uid: 'firebase-uid-1' }; // no email
      next();
    });

    const res = await request(buildApp()).post('/api/auth/sync').send({ authProvider: 'email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_AUTH_CONTEXT');
  });

  it('returns 500 on database error', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await request(buildApp()).post('/api/auth/sync').send({ authProvider: 'google' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SYNC_ERROR');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/auth/me', () => {
  it('returns 200 with user profile and settings', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      settings: MOCK_SETTINGS,
    });

    const res = await request(buildApp()).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
    expect(res.body.data.isComped).toBe(false);
    expect(res.body.data.trialStartedAt).toBe(MOCK_DB_USER.trialStartedAt.toISOString());
    expect(res.body.data.isTrialExpired).toBe(false);
    expect(res.body.data.settings).toBeDefined();
  });

  it('returns only the exact safe Chart capability projection', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      // Canary values prove the route does not accidentally project billing or
      // provider state while adding account-authoritative Chart decisions.
      subscriptionId: 'private-subscription-canary',
      plannerModel: 'private-provider-model-canary',
      plannerApiKey: 'private-provider-key-canary',
      rolloutBucket: 17,
      settings: MOCK_SETTINGS,
    });

    const res = await request(buildApp()).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.chartCapabilities).sort()).toEqual([
      'canAcceptExistingChartPlan',
      'canCompleteExistingCourse',
      'canCreateAnchor',
      'canCreateManualCourse',
      'canCreateOrEditReflections',
      'canEditCourse',
      'canGenerateChartPlan',
      'canRetrieveOwnedChartPlan',
      'canViewChart',
      'canViewOwnedCourseHistory',
      'chartAiPlannerEnabled',
      'chartEnabled',
      'chartReflectionsEnabled',
      'plannerQuota',
    ].sort());
    expect(Object.keys(res.body.data.chartCapabilities.plannerQuota).sort()).toEqual([
      'eligible',
      'limit',
      'reason',
      'remaining',
      'resetAt',
    ]);
    expect(JSON.stringify(res.body.data.chartCapabilities)).not.toMatch(
      /private-subscription-canary|private-provider-model-canary|private-provider-key-canary|rolloutBucket/i
    );
  });

  it('returns 404 when user does not exist', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).get('/api/auth/me');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me/export
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/auth/me/export', () => {
  it('exports flagged content keyed by either DB user id or legacy auth uid', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      settings: MOCK_SETTINGS,
    });
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activation.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.charge.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.practiceSession.findMany as jest.Mock).mockResolvedValue([
      { id: 'session-1', sceneSnapshot: 'I follow through calmly.' },
    ]);
    (mockPrisma.visualizationScene.findMany as jest.Mock).mockResolvedValue([
      { id: 'scene-1', currentText: 'I follow through calmly.' },
    ]);
    (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.syncQueue.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.burnedAnchor.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.flaggedContent.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(buildApp()).get('/api/auth/me/export');

    expect(res.status).toBe(200);
    expect(mockPrisma.flaggedContent.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: 'db-user-1' }, { userId: 'firebase-uid-1' }],
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(res.body.data.account.passwordHash).toBeUndefined();
    expect(res.body.data.exportVersion).toBe(4);
    expect(res.body.data.account.practiceSessions).toEqual([
      expect.objectContaining({ id: 'session-1' }),
    ]);
    expect(res.body.data.account.visualizationScenes).toEqual([
      expect.objectContaining({ id: 'scene-1' }),
    ]);
  });

  it('returns partial export data when an optional export section fails', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      settings: MOCK_SETTINGS,
      passwordHash: 'should-not-export',
    });
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([{ id: 'anchor-1' }]);
    (mockPrisma.activation.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.charge.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.order.findMany as jest.Mock).mockRejectedValue(new Error('orders unavailable'));
    (mockPrisma.syncQueue.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.burnedAnchor.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.flaggedContent.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(buildApp()).get('/api/auth/me/export');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.account.anchors).toEqual([{ id: 'anchor-1' }]);
    expect(res.body.data.account.orders).toEqual([]);
    expect(res.body.data.account.passwordHash).toBeUndefined();
  });

  it('fails closed when a progression-critical export section is unavailable', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      settings: MOCK_SETTINGS,
    });
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activation.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.charge.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.syncQueue.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.burnedAnchor.findMany as jest.Mock).mockRejectedValue(
      new Error('burned history unavailable')
    );
    (mockPrisma.flaggedContent.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(buildApp()).get('/api/auth/me/export');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('EXPORT_ERROR');
  });

  it('exports only the authenticated account burned-anchor snapshots while retaining prior fields in v4', async () => {
    const burnedAnchor = {
      id: 'burned-1',
      originalAnchorId: 'anchor-1',
      userId: 'db-user-1',
      intentionText: 'Archived intention',
      category: 'custom',
      distilledLetters: ['A'],
      baseSigilSvg: '<svg/>',
      enhancedImageUrl: null,
      activationCount: 2,
      activationHistory: [
        {
          id: 'activation-1',
          anchorId: 'anchor-1',
          activationType: 'visual',
          durationSeconds: 30,
          activatedAt: '2026-07-10T09:00:00.000Z',
        },
      ],
      chargeHistory: [
        {
          id: 'charge-1',
          anchorId: 'anchor-1',
          chargeType: 'initial_deep',
          durationSeconds: 300,
          completed: true,
          chargedAt: '2026-07-11T10:00:00.000Z',
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      burnedAt: new Date('2026-07-12T00:00:00.000Z'),
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      settings: MOCK_SETTINGS,
    });
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activation.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.charge.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.syncQueue.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.burnedAnchor.findMany as jest.Mock).mockResolvedValue([burnedAnchor]);
    (mockPrisma.flaggedContent.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(buildApp()).get('/api/auth/me/export');

    expect(res.status).toBe(200);
    expect(res.body.data.exportVersion).toBe(4);
    expect(mockPrisma.burnedAnchor.findMany).toHaveBeenCalledWith({
      where: { userId: 'db-user-1' },
      orderBy: { burnedAt: 'desc' },
    });
    expect(res.body.data.burnedAnchors).toEqual([
      expect.objectContaining({
        originalAnchorId: 'anchor-1',
        activationHistory: [expect.objectContaining({ id: 'activation-1' })],
        chargeHistory: [expect.objectContaining({ id: 'charge-1' })],
      }),
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/auth/profile
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/auth/profile', () => {
  it('updates displayName and returns 200', async () => {
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      displayName: 'New Name',
    });

    const res = await request(buildApp())
      .put('/api/auth/profile')
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('New Name');
  });

  it('returns 400 when displayName exceeds 100 characters', async () => {
    const res = await request(buildApp())
      .put('/api/auth/profile')
      .send({ displayName: 'x'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when displayName is empty string', async () => {
    const res = await request(buildApp()).put('/api/auth/profile').send({ displayName: '' });

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/auth/settings
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/auth/settings', () => {
  it('updates settings and returns 200', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue({
      ...MOCK_SETTINGS,
      notificationsEnabled: false,
    });

    const res = await request(buildApp())
      .put('/api/auth/settings')
      .send({ notificationsEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data.notificationsEnabled).toBe(false);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('updates session audio defaults and returns 200', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue({
      ...MOCK_SETTINGS,
      focusSessionAudio: 'silent',
      primeSessionAudio: 'silent',
    });

    const res = await request(buildApp()).put('/api/auth/settings').send({
      focusSessionAudio: 'silent',
      primeSessionAudio: 'silent',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.focusSessionAudio).toBe('silent');
    expect(res.body.data.primeSessionAudio).toBe('silent');
  });

  it('validates and persists structured Voice & Sound defaults', async () => {
    const sessionAudioDefaults = {
      focus: { guidanceVoice: 'none', backgroundAudio: 'ambient' },
      deep_prime: { guidanceVoice: 'male', backgroundAudio: 'off' },
      visualize: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    };
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue({
      ...MOCK_SETTINGS,
      sessionAudioDefaults,
    });

    const res = await request(buildApp()).put('/api/auth/settings').send({ sessionAudioDefaults });

    expect(res.status).toBe(200);
    expect(res.body.data.sessionAudioDefaults).toEqual(sessionAudioDefaults);
    expect(mockPrisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sessionAudioDefaults }),
        update: expect.objectContaining({ sessionAudioDefaults }),
      })
    );
  });

  it.each([
    {
      focus: { guidanceVoice: 'robot', backgroundAudio: 'ambient' },
      deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
      visualize: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    },
    {
      focus: { guidanceVoice: 'female', backgroundAudio: 'loud' },
      deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
      visualize: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    },
    {
      focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    },
  ])('rejects malformed structured Voice & Sound defaults', async sessionAudioDefaults => {
    const res = await request(buildApp()).put('/api/auth/settings').send({ sessionAudioDefaults });
    expect(res.status).toBe(400);
    expect(mockPrisma.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('updates session mode and duration defaults and returns 200', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue({
      ...MOCK_SETTINGS,
      focusSessionMode: 'deep',
      focusSessionDuration: 60,
      primeSessionDuration: 300,
    });

    const res = await request(buildApp()).put('/api/auth/settings').send({
      focusSessionMode: 'deep',
      focusSessionDuration: 60,
      primeSessionDuration: 300,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.focusSessionMode).toBe('deep');
    expect(res.body.data.focusSessionDuration).toBe(60);
    expect(res.body.data.primeSessionDuration).toBe(300);
  });

  it('returns 400 for invalid dailyReminderTime format', async () => {
    const res = await request(buildApp())
      .put('/api/auth/settings')
      .send({ dailyReminderTime: '9am' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for hapticIntensity out of range', async () => {
    const res = await request(buildApp()).put('/api/auth/settings').send({ hapticIntensity: 10 });

    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .put('/api/auth/settings')
      .send({ notificationsEnabled: true });

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/auth/notification-state
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/auth/notification-state', () => {
  it('syncs merged notification state for the authenticated user', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        notification_state: {
          notification_enabled: true,
          active_hours_end: 21,
        },
        notifications_enabled: true,
        expo_push_token: null,
        fcm_token: null,
        apns_token: null,
      },
    ]);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        notificationState: {
          notification_enabled: true,
          active_hours_end: 21,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notificationsEnabled).toBe(true);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { authUid: 'firebase-uid-1' },
      select: { id: true },
    });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('derives notification-state ownership from the authenticated JWT context', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        notification_state: {
          notification_enabled: true,
        },
        notifications_enabled: true,
        expo_push_token: null,
        fcm_token: null,
        apns_token: null,
      },
    ]);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        userId: 'forged-user-id',
        notificationState: {
          notification_enabled: true,
        },
      });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { authUid: 'firebase-uid-1' },
      select: { id: true },
    });
  });

  it('upserts expo, FCM, and APNS tokens alongside notification state', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        notification_state: {
          notification_enabled: true,
          timezone: 'UTC',
        },
        notifications_enabled: true,
        expo_push_token: 'ExponentPushToken[abc123]',
        fcm_token: 'fcm-token-1',
        apns_token: 'apns-token-1',
      },
    ]);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        notificationState: {
          notification_enabled: true,
          timezone: 'UTC',
        },
        pushTokens: {
          expoPushToken: 'ExponentPushToken[abc123]',
          fcmToken: 'fcm-token-1',
          apnsToken: 'apns-token-1',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.expoPushToken).toBe('ExponentPushToken[abc123]');
    expect(res.body.data.fcmToken).toBe('fcm-token-1');
    expect(res.body.data.apnsToken).toBe('apns-token-1');
  });

  it('allows token-only cleanup payloads without notificationState', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        notification_state: {},
        notifications_enabled: true,
        expo_push_token: null,
        fcm_token: null,
        apns_token: null,
      },
    ]);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        pushTokens: {
          expoPushToken: null,
          fcmToken: null,
          apnsToken: null,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.expoPushToken).toBeNull();
    expect(res.body.data.fcmToken).toBeNull();
    expect(res.body.data.apnsToken).toBeNull();
  });

  it('returns 404 when the authenticated user has no database row', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        notificationState: {
          notification_enabled: false,
        },
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 500 when notification-state persistence fails', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('permission denied'));

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        notificationState: {
          notification_enabled: false,
        },
      });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('UPDATE_ERROR');
  });

  it('returns 400 when notificationState is missing', async () => {
    const res = await request(buildApp()).put('/api/auth/notification-state').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/auth/me
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/auth/me', () => {
  it('deletes user and returns 200 with deletedUserId', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.user.delete as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.flaggedContent.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.burnedAnchor.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.syncQueue.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    const res = await request(buildApp()).delete('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.deletedUserId).toBe('db-user-1');
    expect(res.body.data.authAccountDeleted).toBe(true);
    expect(mockPrisma.flaggedContent.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: 'db-user-1' }, { userId: 'firebase-uid-1' }],
      },
    });
    expect(mockPrisma.burnedAnchor.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'db-user-1' },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'db-user-1' } })
    );
  });

  it('returns 404 when user not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).delete('/api/auth/me');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 500 on database deletion error', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.$transaction as jest.Mock).mockRejectedValue(new Error('FK constraint'));

    const res = await request(buildApp()).delete('/api/auth/me');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('DELETE_ERROR');
  });

  it('returns success when app data is deleted but firebase auth cleanup fails', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.user.delete as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.flaggedContent.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.burnedAnchor.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.syncQueue.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    mockedGetFirebaseAdmin.mockReturnValue({
      auth: () => ({
        getUser: jest.fn(),
        deleteUser: jest.fn().mockRejectedValue({ code: 'auth/internal-error' }),
      }),
    });

    const res = await request(buildApp()).delete('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.authAccountDeleted).toBe(false);
  });
});
