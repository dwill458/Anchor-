/**
 * Route tests for /api/practice
 *
 * Covers:
 *   POST /api/practice/stabilize
 */

import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../middleware/auth');

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { authMiddleware } from '../../middleware/auth';
import practiceRouter from '../practice';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

// ── App setup ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/practice', practiceRouter);
  app.use(errorHandler);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AUTH_USER = { uid: 'firebase-uid-1', email: 'user@example.com' };
const MOCK_DB_USER = {
  id: 'db-user-1',
  authUid: 'firebase-uid-1',
  email: 'user@example.com',
  stabilizeStreakDays: 3,
  stabilizesTotal: 10,
  lastStabilizeAt: null as Date | null,
};

const VALID_BODY = {
  completedAt: new Date().toISOString(),
  timezoneOffsetMinutes: -300,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/practice/stabilize', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    // Default: authenticated
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = MOCK_AUTH_USER;
      next();
    });

    mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER);
    mockPrisma.user.update.mockResolvedValue({
      ...MOCK_DB_USER,
      stabilizesTotal: 11,
      stabilizeStreakDays: 4,
      lastStabilizeAt: new Date(VALID_BODY.completedAt),
    });
  });

  it('returns 200 and updated user on success', async () => {
    const res = await request(app)
      .post('/api/practice/stabilize')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('stabilizesTotal');
  });

  it('increments stabilize total via prisma update', async () => {
    await request(app).post('/api/practice/stabilize').send(VALID_BODY);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stabilizesTotal: { increment: 1 },
        }),
      })
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockedAuthMiddleware.mockImplementation((_req: any, _res: any, next: any) => {
      next(); // no req.user set
    });

    const res = await request(app)
      .post('/api/practice/stabilize')
      .send(VALID_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found in database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/practice/stabilize')
      .send(VALID_BODY);

    expect(res.status).toBe(404);
  });

  it('returns 400 when completedAt is missing', async () => {
    const res = await request(app)
      .post('/api/practice/stabilize')
      .send({ timezoneOffsetMinutes: -300 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when timezoneOffsetMinutes is missing', async () => {
    const res = await request(app)
      .post('/api/practice/stabilize')
      .send({ completedAt: new Date().toISOString() });

    expect(res.status).toBe(400);
  });

  it('returns 400 when completedAt is not a valid date', async () => {
    const res = await request(app)
      .post('/api/practice/stabilize')
      .send({ completedAt: 'not-a-date', timezoneOffsetMinutes: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when timezoneOffsetMinutes is out of range', async () => {
    const res = await request(app)
      .post('/api/practice/stabilize')
      .send({ completedAt: new Date().toISOString(), timezoneOffsetMinutes: 9999 });

    expect(res.status).toBe(400);
  });

  describe('streak logic', () => {
    it('sets streak to 1 when no prior stabilize', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...MOCK_DB_USER, lastStabilizeAt: null, stabilizeStreakDays: 0 });

      await request(app).post('/api/practice/stabilize').send(VALID_BODY);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stabilizeStreakDays: 1 }),
        })
      );
    });

    it('extends streak by 1 when last stabilize was yesterday', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_DB_USER,
        lastStabilizeAt: yesterday,
        stabilizeStreakDays: 5,
      });

      const today = new Date();
      await request(app)
        .post('/api/practice/stabilize')
        .send({ completedAt: today.toISOString(), timezoneOffsetMinutes: 0 });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stabilizeStreakDays: 6 }),
        })
      );
    });

    it('resets streak to 1 when last stabilize was 2+ days ago', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_DB_USER,
        lastStabilizeAt: twoDaysAgo,
        stabilizeStreakDays: 10,
      });

      await request(app).post('/api/practice/stabilize').send(VALID_BODY);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stabilizeStreakDays: 1 }),
        })
      );
    });

    it('preserves streak when stabilizing twice same day', async () => {
      const now = new Date();
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_DB_USER,
        lastStabilizeAt: now,
        stabilizeStreakDays: 7,
      });

      await request(app)
        .post('/api/practice/stabilize')
        .send({ completedAt: now.toISOString(), timezoneOffsetMinutes: 0 });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stabilizeStreakDays: 7 }),
        })
      );
    });
  });

  it('returns 500 when prisma update throws an unexpected error', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('DB connection failed'));

    const res = await request(app).post('/api/practice/stabilize').send(VALID_BODY);

    expect(res.status).toBe(500);
  });
});
