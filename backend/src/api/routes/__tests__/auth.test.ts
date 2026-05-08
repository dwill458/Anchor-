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
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userSettings: {
    upsert: jest.fn(),
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
  hapticIntensity: 3,
  vaultViewType: 'grid',
  updatedAt: new Date('2024-01-01'),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.COMPED_ACCESS_EMAILS;
  (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback(mockPrisma));

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
    (mockPrisma.user.upsert as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test@example.com');
    expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it('promotes onboarding completion when requested during sync', async () => {
    (mockPrisma.user.upsert as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      hasCompletedOnboarding: true,
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({
        displayName: 'Test User',
        authProvider: 'email',
        hasCompletedOnboarding: true,
      });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ hasCompletedOnboarding: true }),
        create: expect.objectContaining({ hasCompletedOnboarding: true }),
      })
    );
  });

  it('marks allowlisted emails as comped during sync', async () => {
    process.env.COMPED_ACCESS_EMAILS = 'test@example.com,other@example.com';
    (mockPrisma.user.upsert as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      isComped: true,
    });
    (mockPrisma.userSettings.upsert as jest.Mock).mockResolvedValue(MOCK_SETTINGS);

    const res = await request(buildApp())
      .post('/api/auth/sync')
      .send({ displayName: 'Test User', authProvider: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.data.isComped).toBe(true);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ isComped: true }),
        create: expect.objectContaining({ isComped: true }),
      })
    );
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
    (mockPrisma.user.upsert as jest.Mock).mockRejectedValue(new Error('DB error'));

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
    expect(res.body.data.settings).toBeDefined();
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
      anchors: [],
      activations: [],
      charges: [],
      orders: [],
    });
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
    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({});

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
