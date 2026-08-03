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
  anchor: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  practiceSession: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  course: { findUnique: jest.fn() },
  waypoint: { findUnique: jest.fn() },
  courseEvent: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));
jest.mock('../../../services/PracticeAccessService', () => ({
  requireVisualizeAccess: jest.fn().mockResolvedValue(undefined),
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
    mockPrisma.practiceSession.findUnique.mockResolvedValue(null);
    mockPrisma.practiceSession.findFirst.mockResolvedValue(null);
    mockPrisma.practiceSession.findMany.mockResolvedValue([]);
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.anchor.findUnique.mockResolvedValue({ id: 'anchor-1', userId: MOCK_DB_USER.id });
    mockPrisma.anchor.update.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.user.update.mockResolvedValue({ id: MOCK_DB_USER.id });
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
    mockPrisma.user.update.mockResolvedValue({
      ...MOCK_DB_USER,
      stabilizesTotal: 11,
      stabilizeStreakDays: 4,
      lastStabilizeAt: new Date(VALID_BODY.completedAt),
    });
  });

  it('returns 200 and updated user on success', async () => {
    const res = await request(app).post('/api/practice/stabilize').send(VALID_BODY);

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

    const res = await request(app).post('/api/practice/stabilize').send(VALID_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found in database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/practice/stabilize').send(VALID_BODY);

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
      mockPrisma.user.findUnique.mockResolvedValue({
        ...MOCK_DB_USER,
        lastStabilizeAt: null,
        stabilizeStreakDays: 0,
      });

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

describe('canonical practice sessions', () => {
  let app: Application;
  const completedAt = new Date().toISOString();
  const body = {
    id: 'client-session-1',
    anchorId: 'anchor-1',
    anchorLocalId: 'local-anchor-1',
    anchorServerId: 'anchor-1',
    practiceMode: 'visualize',
    plannedDurationSeconds: 180,
    completedDurationSeconds: 180,
    completionStatus: 'completed',
    startedAt: new Date(Date.now() - 180_000).toISOString(),
    completedAt,
    localDateKey: completedAt.slice(0, 10),
    timeZone: 'UTC',
    utcOffsetMinutesAtCompletion: 0,
    completionSource: 'practice_screen',
    schemaVersion: 2,
    legacyType: null,
    guidanceVoice: 'none',
    backgroundAudio: 'ambient',
    sceneSnapshot: 'I meet the moment calmly and follow through with steady attention.',
    nextAction: null,
    clientVersion: '1.0.0',
  };

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = MOCK_AUTH_USER;
      next();
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      ...MOCK_DB_USER,
      isComped: true,
      subscriptionStatus: 'pro',
      subscriptionId: 'pro',
      trialStartedAt: new Date(),
    });
    mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.anchor.findUnique.mockResolvedValue({ id: 'anchor-1', userId: MOCK_DB_USER.id });
    mockPrisma.practiceSession.findUnique.mockResolvedValue(null);
    mockPrisma.practiceSession.findFirst.mockResolvedValue(null);
    mockPrisma.practiceSession.findMany.mockResolvedValue([]);
    mockPrisma.practiceSession.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      startedAt: new Date(data.startedAt),
      completedAt: new Date(data.completedAt),
    }));
    mockPrisma.anchor.update.mockResolvedValue({ id: 'anchor-1' });
    mockPrisma.user.update.mockResolvedValue({ id: MOCK_DB_USER.id });
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  });

  it('creates a completed Visualize session idempotently', async () => {
    const created = await request(app).post('/api/practice/sessions').send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.id).toBe(body.id);

    mockPrisma.practiceSession.findUnique.mockResolvedValue({
      ...body,
      userId: MOCK_DB_USER.id,
      anchorServerIdSnapshot: body.anchorServerId,
      startedAt: new Date(body.startedAt),
      completedAt: new Date(body.completedAt),
    });
    const retry = await request(app).post('/api/practice/sessions').send(body);
    expect(retry.status).toBe(200);
    expect(retry.body.idempotent).toBe(true);
  });

  it('accepts Chart context and emits exactly one PRACTICE_COMPLETED event across retries', async () => {
    const chartBody = {
      ...body,
      id: 'chart-session-1',
      courseId: 'course-1',
      waypointId: 'waypoint-1',
      practiceEntrySource: 'chart_waypoint_detail',
    };
    mockPrisma.course.findUnique.mockResolvedValue({ id: 'course-1', userId: MOCK_DB_USER.id });
    mockPrisma.waypoint.findUnique.mockResolvedValue({
      id: 'waypoint-1',
      userId: MOCK_DB_USER.id,
      courseId: 'course-1',
    });
    mockPrisma.courseEvent.findUnique.mockResolvedValue(null);
    mockPrisma.courseEvent.create.mockResolvedValue({ id: 'chart-event-1' });

    const created = await request(app).post('/api/practice/sessions').send(chartBody);
    expect(created.status).toBe(201);
    expect(mockPrisma.practiceSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: 'course-1',
          waypointId: 'waypoint-1',
          practiceEntrySource: 'chart_waypoint_detail',
        }),
      })
    );
    expect(mockPrisma.courseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'PRACTICE_COMPLETED' }),
      })
    );

    mockPrisma.practiceSession.findUnique.mockResolvedValue({
      ...chartBody,
      userId: MOCK_DB_USER.id,
      anchorServerIdSnapshot: chartBody.anchorServerId,
      startedAt: new Date(chartBody.startedAt),
      completedAt: new Date(chartBody.completedAt),
    });
    const retry = await request(app).post('/api/practice/sessions').send(chartBody);
    expect(retry.status).toBe(200);
    expect(mockPrisma.courseEvent.create).toHaveBeenCalledTimes(1);
  });

  it('accepts a pre-ledger legacy payload missing localDateKey/timeZone/utcOffset/completionSource/schemaVersion', async () => {
    const legacyCompletedAt = new Date().toISOString();
    const legacyBody = {
      id: 'legacy-client-session-1',
      anchorId: 'anchor-1',
      anchorLocalId: 'local-anchor-1',
      anchorServerId: 'anchor-1',
      practiceMode: 'focus',
      plannedDurationSeconds: 30,
      completedDurationSeconds: 30,
      completionStatus: 'completed',
      startedAt: new Date(Date.now() - 30_000).toISOString(),
      completedAt: legacyCompletedAt,
      guidanceVoice: 'none',
      backgroundAudio: 'off',
      sceneSnapshot: null,
      nextAction: null,
      clientVersion: '1.1.0',
    };

    const response = await request(app).post('/api/practice/sessions').send(legacyBody);

    expect(response.status).toBe(201);
    expect(response.body.data.completionSource).toBe('unknown');
    expect(response.body.data.schemaVersion).toBe(1);
    expect(response.body.data.timeZone).toBe('UTC');
    expect(response.body.data.localDateKey).toBe(legacyCompletedAt.slice(0, 10));
  });

  it('returns conflict when an id is reused with incompatible immutable data', async () => {
    mockPrisma.practiceSession.findUnique.mockResolvedValue({
      ...body,
      userId: MOCK_DB_USER.id,
      anchorServerIdSnapshot: body.anchorServerId,
      plannedDurationSeconds: 60,
      startedAt: new Date(body.startedAt),
      completedAt: new Date(body.completedAt),
    });
    const response = await request(app).post('/api/practice/sessions').send(body);
    expect(response.status).toBe(409);
  });

  it('rejects invalid Visualize scene text and partial completion', async () => {
    const invalidScene = await request(app)
      .post('/api/practice/sessions')
      .send({ ...body, sceneSnapshot: 'x'.repeat(181) });
    expect(invalidScene.status).toBe(400);
    const partial = await request(app)
      .post('/api/practice/sessions')
      .send({ ...body, completedDurationSeconds: 90 });
    expect(partial.status).toBe(400);
  });

  it('rejects invalid timezone metadata and a mismatched local date', async () => {
    const invalidZone = await request(app)
      .post('/api/practice/sessions')
      .send({ ...body, timeZone: 'Not/A_Real_Zone' });
    expect(invalidZone.status).toBe(400);

    const wrongDate = await request(app)
      .post('/api/practice/sessions')
      .send({ ...body, localDateKey: '2001-01-01' });
    expect(wrongDate.status).toBe(400);
  });

  it('rejects a UTC offset that does not match the completion timezone', async () => {
    const response = await request(app)
      .post('/api/practice/sessions')
      .send({ ...body, utcOffsetMinutesAtCompletion: 300 });

    expect(response.status).toBe(400);
  });

  it('updates next action only for an account-owned session', async () => {
    mockPrisma.practiceSession.findFirst.mockResolvedValue({
      id: body.id,
      userId: MOCK_DB_USER.id,
    });
    mockPrisma.practiceSession.update.mockResolvedValue({
      id: body.id,
      nextAction: 'Open the draft.',
    });
    const response = await request(app)
      .patch(`/api/practice/sessions/${body.id}/next-action`)
      .send({ nextAction: 'Open the draft.' });
    expect(response.status).toBe(200);

    mockPrisma.practiceSession.findFirst.mockResolvedValue(null);
    const missing = await request(app)
      .patch('/api/practice/sessions/someone-elses/next-action')
      .send({ nextAction: 'No.' });
    expect(missing.status).toBe(404);
  });

  it('retains a completed session after its anchor was deleted without recreating it', async () => {
    mockPrisma.anchor.findUnique.mockResolvedValue(null);
    const response = await request(app).post('/api/practice/sessions').send(body);
    expect(response.status).toBe(201);
    expect(mockPrisma.practiceSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          anchorId: null,
          anchorLocalId: body.anchorLocalId,
          anchorServerIdSnapshot: body.anchorServerId,
        }),
      })
    );
    expect(mockPrisma.anchor.update).not.toHaveBeenCalled();
  });

  it('accepts an identical retry after the anchor relation was set null', async () => {
    mockPrisma.practiceSession.findUnique.mockResolvedValue({
      ...body,
      anchorId: null,
      anchorServerIdSnapshot: body.anchorServerId,
      userId: MOCK_DB_USER.id,
      startedAt: new Date(body.startedAt),
      completedAt: new Date(body.completedAt),
    });
    const response = await request(app).post('/api/practice/sessions').send(body);
    expect(response.status).toBe(200);
    expect(response.body.idempotent).toBe(true);
  });

  it('rejects a live anchor owned by another account', async () => {
    mockPrisma.anchor.findUnique.mockResolvedValue({ id: body.anchorId, userId: 'other-user' });
    const response = await request(app).post('/api/practice/sessions').send(body);
    expect(response.status).toBe(404);
    expect(mockPrisma.practiceSession.create).not.toHaveBeenCalled();
  });
});
