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
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userSettings: {
    upsert: jest.fn(),
  },
  syncQueue: {
    deleteMany: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { authMiddleware } from '../../middleware/auth';
import authRouter from '../auth';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

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
// DELETE /api/auth/me
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/auth/me', () => {
  it('deletes user and returns 200 with deletedUserId', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.user.delete as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.syncQueue.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    const res = await request(buildApp()).delete('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.deletedUserId).toBe('db-user-1');
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
    (mockPrisma.user.delete as jest.Mock).mockRejectedValue(new Error('FK constraint'));

    const res = await request(buildApp()).delete('/api/auth/me');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('DELETE_ERROR');
  });
});
