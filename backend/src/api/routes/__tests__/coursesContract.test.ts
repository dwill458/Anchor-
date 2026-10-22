/**
 * Wire contract for /api/courses and /api/reflections.
 *
 * courses.test.ts covers the flag/migration gate. This file covers what the
 * mobile client actually parses: the response envelope, the request schemas for
 * every waypoint transition, pagination, and the shape of an error payload.
 */

import express, { Application } from 'express';
import request from 'supertest';
import { AppError, errorHandler } from '../../middleware/errorHandler';

jest.mock('../../middleware/auth');

const mockPrisma = { user: { findUnique: jest.fn() } };
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('../../../config/chartFlags', () => ({
  requireChartEnabled: jest.fn(),
  requireChartWriteEnabled: jest.fn(),
  requireChartInitialized: jest.fn(),
  requireChartReflectionWritesEnabled: jest.fn(),
}));

// Route tests exercise request validation and response contracts. The
// server-authoritative capability projection is covered separately; stub it
// here so the route fixture represents an account with Chart access enabled.
const mockGetChartCapabilities = jest.fn();
jest.mock('../../../services/ChartCapabilityService', () => ({
  getChartCapabilities: (...args: unknown[]) => mockGetChartCapabilities(...args),
}));

const mockCourseService = {
  initializeChartForUser: jest.fn(),
  listCourses: jest.fn(),
  getCourse: jest.fn(),
  listLog: jest.fn(),
  createCourse: jest.fn(),
  updateCourse: jest.fn(),
  archiveCourse: jest.fn(),
  restoreCourse: jest.fn(),
  softDeleteCourse: jest.fn(),
  addWaypoint: jest.fn(),
  editWaypoint: jest.fn(),
  reorderWaypoints: jest.fn(),
  completeWaypoint: jest.fn(),
  skipWaypoint: jest.fn(),
  cancelWaypoint: jest.fn(),
  linkAnchor: jest.fn(),
  unlinkAnchor: jest.fn(),
};
jest.mock('../../../services/CourseService', () => ({ courseService: mockCourseService }));

const mockReflectionService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
jest.mock('../../../services/ReflectionService', () => ({
  reflectionService: mockReflectionService,
}));

import { authMiddleware } from '../../middleware/auth';
import {
  requireChartEnabled,
  requireChartInitialized,
  requireChartReflectionWritesEnabled,
  requireChartWriteEnabled,
} from '../../../config/chartFlags';
import coursesRouter from '../courses';
import reflectionsRouter from '../reflections';

const mockedAuth = authMiddleware as jest.Mock;
const mockedEnabled = requireChartEnabled as jest.Mock;
const mockedWriteEnabled = requireChartWriteEnabled as jest.Mock;
const mockedInitialized = requireChartInitialized as jest.Mock;
const mockedReflectionWrites = requireChartReflectionWritesEnabled as jest.Mock;

const COURSE_ID = 'course-chart-phase0';
const WAYPOINT_ID = 'wp-current';

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', coursesRouter);
  app.use('/api/reflections', reflectionsRouter);
  app.use(errorHandler);
  return app;
}

const validCompletion = () => ({
  idempotencyKey: 'complete-1',
  expectedCourseVersion: 7,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedAuth.mockImplementation((req: any, _res: any, next: any) => {
    req.user = { uid: 'firebase-user-1' };
    next();
  });
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', chartSchemaVersion: 1 });
  mockedEnabled.mockImplementation(() => undefined);
  mockedWriteEnabled.mockImplementation(() => undefined);
  mockedInitialized.mockImplementation(() => undefined);
  mockedReflectionWrites.mockImplementation(() => undefined);
  mockGetChartCapabilities.mockResolvedValue({
    canViewChart: true,
    canEditCourse: true,
    canCreateOrEditReflections: true,
  });
  mockCourseService.completeWaypoint.mockResolvedValue({
    course: { id: COURSE_ID, version: 8, currentWaypointId: 'wp-5k' },
    completedWaypoint: { id: WAYPOINT_ID, state: 'REACHED' },
    nextWaypoint: { id: 'wp-5k', state: 'CURRENT' },
    courseCompleted: false,
    completionEventId: 'event-1',
    replayed: false,
  });
  mockCourseService.skipWaypoint.mockResolvedValue({ id: COURSE_ID, version: 8 });
  mockCourseService.cancelWaypoint.mockResolvedValue({ id: COURSE_ID, version: 8 });
});

// ── Envelope ────────────────────────────────────────────────────────────────

describe('Response envelope', () => {
  it('wraps a successful read in { success, data }', async () => {
    mockCourseService.getCourse.mockResolvedValue({ id: COURSE_ID, version: 7 });
    const response = await request(buildApp()).get(`/api/courses/${COURSE_ID}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { id: COURSE_ID, version: 7 } });
  });

  it('wraps an error in { success: false, error: { code, message } }', async () => {
    mockCourseService.getCourse.mockRejectedValue(
      new AppError('Course not found', 404, 'COURSE_NOT_FOUND'),
    );
    const response = await request(buildApp()).get(`/api/courses/${COURSE_ID}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('COURSE_NOT_FOUND');
  });

  it('exposes AppError meta as error.details so the client can read the refreshed course', async () => {
    mockCourseService.completeWaypoint.mockRejectedValue(
      new AppError('Course has changed on another device', 409, 'COURSE_VERSION_CONFLICT', {
        course: { id: COURSE_ID, version: 9 },
      }),
    );
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send(validCompletion());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('COURSE_VERSION_CONFLICT');
    // ChartApiClient.getConflictCourse() reads exactly this path.
    expect(response.body.error.details.course.version).toBe(9);
  });
});

// ── Completion route ────────────────────────────────────────────────────────

describe('POST /:courseId/waypoints/:waypointId/complete', () => {
  it('passes the validated request through to the service', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send(validCompletion());

    expect(response.status).toBe(200);
    expect(mockCourseService.completeWaypoint).toHaveBeenCalledWith(
      'user-1',
      COURSE_ID,
      WAYPOINT_ID,
      validCompletion(),
    );
  });

  it('returns the authoritative course, both waypoints, and the pointer', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send(validCompletion());

    expect(response.body.data).toMatchObject({
      course: { currentWaypointId: 'wp-5k', version: 8 },
      completedWaypoint: { state: 'REACHED' },
      nextWaypoint: { id: 'wp-5k' },
      courseCompleted: false,
      replayed: false,
    });
  });

  it('requires an idempotency key', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send({ expectedCourseVersion: 7 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCourseService.completeWaypoint).not.toHaveBeenCalled();
  });

  it('requires an expected course version of at least 1', async () => {
    for (const expectedCourseVersion of [0, -1, 1.5]) {
      const response = await request(buildApp())
        .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
        .send({ idempotencyKey: 'k', expectedCourseVersion });
      expect(response.status).toBe(400);
    }
    expect(mockCourseService.completeWaypoint).not.toHaveBeenCalled();
  });

  it('accepts a structured completion reflection', async () => {
    const reflection = {
      structuredContent: { whatHelped: 'Turning up.', whatLearned: 'Consistency.' },
      moodAfter: 'FOCUSED',
      promptType: 'WAYPOINT_COMPLETION',
      promptVersion: 1,
      idempotencyKey: 'reflection-1',
    };
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send({ ...validCompletion(), reflection });

    expect(response.status).toBe(200);
    expect(mockCourseService.completeWaypoint).toHaveBeenCalledWith(
      'user-1',
      COURSE_ID,
      WAYPOINT_ID,
      expect.objectContaining({ reflection }),
    );
  });

  it('rejects a freeform reflection body instead of silently discarding it', async () => {
    // The service stores body: null for a completion reflection. Accepting a
    // body would 200 while dropping the user's text.
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send({
        ...validCompletion(),
        reflection: {
          body: 'this would be discarded',
          promptType: 'WAYPOINT_COMPLETION',
          promptVersion: 1,
          idempotencyKey: 'reflection-body',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCourseService.completeWaypoint).not.toHaveBeenCalled();
  });

  it('rejects an unknown reflection prompt type', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send({
        ...validCompletion(),
        reflection: {
          structuredContent: { whatHelped: 'x' },
          promptType: 'COURSE_STATUS',
          promptVersion: 1,
          idempotencyKey: 'reflection-wrong-type',
        },
      });

    expect(response.status).toBe(400);
  });

  it('rejects unknown top-level fields', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send({ ...validCompletion(), makeThisCurrent: true });

    expect(response.status).toBe(400);
    expect(mockCourseService.completeWaypoint).not.toHaveBeenCalled();
  });

  it('fails closed when writes are disabled', async () => {
    mockedWriteEnabled.mockImplementation(() => {
      throw new AppError('Chart is currently disabled', 403, 'FEATURE_DISABLED');
    });
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send(validCompletion());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FEATURE_DISABLED');
    expect(mockCourseService.completeWaypoint).not.toHaveBeenCalled();
  });

  it('fails closed before migration', async () => {
    mockedInitialized.mockImplementation(() => {
      throw new AppError('Chart migration is required', 409, 'MIGRATION_REQUIRED');
    });
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/complete`)
      .send(validCompletion());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('MIGRATION_REQUIRED');
    expect(mockCourseService.completeWaypoint).not.toHaveBeenCalled();
  });
});

// ── Skip and cancel ─────────────────────────────────────────────────────────

describe('Skip and cancel routes', () => {
  it('routes skip to skipWaypoint with an optional reason', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/skip`)
      .send({ idempotencyKey: 'skip-1', expectedCourseVersion: 7, reason: 'Overtaken' });

    expect(response.status).toBe(200);
    expect(mockCourseService.skipWaypoint).toHaveBeenCalledWith('user-1', COURSE_ID, WAYPOINT_ID, {
      idempotencyKey: 'skip-1',
      expectedCourseVersion: 7,
      reason: 'Overtaken',
    });
  });

  it('routes cancel to cancelWaypoint and accepts no reason', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/cancel`)
      .send({ idempotencyKey: 'cancel-1', expectedCourseVersion: 7 });

    expect(response.status).toBe(200);
    expect(mockCourseService.cancelWaypoint).toHaveBeenCalledWith(
      'user-1',
      COURSE_ID,
      WAYPOINT_ID,
      { idempotencyKey: 'cancel-1', expectedCourseVersion: 7 },
    );
  });

  it('rejects a cancellation reason — the snapshot carries only waypointTitle', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/cancel`)
      .send({ idempotencyKey: 'cancel-2', expectedCourseVersion: 7, reason: 'nope' });

    expect(response.status).toBe(400);
    expect(mockCourseService.cancelWaypoint).not.toHaveBeenCalled();
  });

  it('exposes no route that sets the current waypoint directly', async () => {
    for (const path of [
      `/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/make-current`,
      `/api/courses/${COURSE_ID}/current-waypoint`,
      `/api/courses/${COURSE_ID}/pause`,
      `/api/courses/${COURSE_ID}/resume`,
    ]) {
      const response = await request(buildApp()).post(path).send({});
      expect(response.status).toBe(404);
    }
  });

  it('does not accept currentWaypointId on a course update', async () => {
    const response = await request(buildApp())
      .patch(`/api/courses/${COURSE_ID}`)
      .send({ expectedCourseVersion: 7, currentWaypointId: 'wp-5k' });

    expect(response.status).toBe(400);
    expect(mockCourseService.updateCourse).not.toHaveBeenCalled();
  });

  it('does not accept a PAUSED status on a course update', async () => {
    const response = await request(buildApp())
      .patch(`/api/courses/${COURSE_ID}`)
      .send({ expectedCourseVersion: 7, status: 'PAUSED' });

    expect(response.status).toBe(400);
  });
});

// ── Anchor links ────────────────────────────────────────────────────────────

describe('Anchor link routes', () => {
  it('creates a link with an expected version and idempotency key', async () => {
    mockCourseService.linkAnchor.mockResolvedValue({ id: COURSE_ID, version: 8 });
    const body = {
      idempotencyKey: 'link-1',
      expectedCourseVersion: 7,
      anchorId: 'anchor-current',
      role: 'WAYPOINT_PRIMARY',
      waypointId: WAYPOINT_ID,
    };
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/anchor-links`)
      .send(body);

    expect(response.status).toBe(201);
    expect(mockCourseService.linkAnchor).toHaveBeenCalledWith('user-1', COURSE_ID, body);
  });

  it('rejects an unknown anchor role', async () => {
    const response = await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/anchor-links`)
      .send({
        idempotencyKey: 'link-2',
        expectedCourseVersion: 7,
        anchorId: 'anchor-current',
        role: 'DESTINATION_MARKER',
      });

    expect(response.status).toBe(400);
  });

  it('requires an expected version to unlink', async () => {
    const response = await request(buildApp())
      .delete(`/api/courses/${COURSE_ID}/anchor-links/link-1`)
      .send({});

    expect(response.status).toBe(400);
    expect(mockCourseService.unlinkAnchor).not.toHaveBeenCalled();
  });
});

// ── Course Log ──────────────────────────────────────────────────────────────

describe('GET /:courseId/log', () => {
  beforeEach(() => {
    mockCourseService.listLog.mockResolvedValue({
      data: [{ id: 'e1', eventType: 'WAYPOINT_REACHED' }],
      pagination: { nextCursor: 'e1', hasMore: true },
    });
  });

  it('returns data and pagination as siblings in the envelope', async () => {
    const response = await request(buildApp()).get(`/api/courses/${COURSE_ID}/log`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [{ id: 'e1', eventType: 'WAYPOINT_REACHED' }],
      pagination: { nextCursor: 'e1', hasMore: true },
    });
  });

  it('defaults the page size to 25', async () => {
    await request(buildApp()).get(`/api/courses/${COURSE_ID}/log`);
    expect(mockCourseService.listLog).toHaveBeenCalledWith('user-1', COURSE_ID, 25, undefined);
  });

  it('passes an explicit limit and cursor through', async () => {
    await request(buildApp()).get(`/api/courses/${COURSE_ID}/log?limit=10&cursor=e5`);
    expect(mockCourseService.listLog).toHaveBeenCalledWith('user-1', COURSE_ID, 10, 'e5');
  });

  it('rejects a page size above 100', async () => {
    const response = await request(buildApp()).get(`/api/courses/${COURSE_ID}/log?limit=101`);
    expect(response.status).toBe(400);
    expect(mockCourseService.listLog).not.toHaveBeenCalled();
  });

  it('rejects an unknown query parameter', async () => {
    const response = await request(buildApp()).get(
      `/api/courses/${COURSE_ID}/log?limit=10&includeDeleted=true`,
    );
    expect(response.status).toBe(400);
  });

  it('returns an empty paginated log with migrationRequired before initialization', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', chartSchemaVersion: 0 });
    const response = await request(buildApp()).get(`/api/courses/${COURSE_ID}/log`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [],
      pagination: { nextCursor: null, hasMore: false },
      migrationRequired: true,
    });
    expect(mockCourseService.listLog).not.toHaveBeenCalled();
  });
});

// ── Ownership ───────────────────────────────────────────────────────────────

describe('Ownership resolution', () => {
  it('resolves the Chart user from the authenticated uid, never from the body', async () => {
    mockCourseService.getCourse.mockResolvedValue({ id: COURSE_ID });
    await request(buildApp()).get(`/api/courses/${COURSE_ID}`);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { authUid: 'firebase-user-1' },
      select: {
        id: true,
        chartSchemaVersion: true,
        isComped: true,
        subscriptionStatus: true,
        subscriptionId: true,
        trialStartedAt: true,
      },
    });
    expect(mockCourseService.getCourse).toHaveBeenCalledWith('user-1', COURSE_ID);
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mockedAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.user = undefined;
      next();
    });
    const response = await request(buildApp()).get(`/api/courses/${COURSE_ID}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the authenticated uid has no user row', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const response = await request(buildApp()).get(`/api/courses/${COURSE_ID}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('ignores a userId supplied in a mutation body', async () => {
    await request(buildApp())
      .post(`/api/courses/${COURSE_ID}/waypoints/${WAYPOINT_ID}/skip`)
      .send({ idempotencyKey: 'skip-x', expectedCourseVersion: 7, userId: 'someone-else' });

    // Strict schemas reject the extra field outright.
    expect(mockCourseService.skipWaypoint).not.toHaveBeenCalled();
  });
});

// ── Reflection routes ───────────────────────────────────────────────────────

describe('Reflection routes', () => {
  it('creates a reflection bound to the authenticated user', async () => {
    mockReflectionService.create.mockResolvedValue({ id: 'reflection-1' });
    const body = {
      idempotencyKey: 'reflection-1',
      source: 'MANUAL_COURSE',
      promptType: 'COURSE_STATUS',
      promptVersion: 1,
      body: 'Private note',
      courseId: COURSE_ID,
    };
    const response = await request(buildApp()).post('/api/reflections').send(body);

    expect(response.status).toBe(201);
    expect(mockReflectionService.create).toHaveBeenCalledWith('user-1', body);
  });

  it('soft-deletes rather than hard-deleting', async () => {
    mockReflectionService.delete.mockResolvedValue(undefined);
    const response = await request(buildApp()).delete('/api/reflections/reflection-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { deleted: true } });
    expect(mockReflectionService.delete).toHaveBeenCalledWith('user-1', 'reflection-1');
  });

  it('fails closed when reflection writes are disabled', async () => {
    mockedReflectionWrites.mockImplementation(() => {
      throw new AppError('Chart reflections are disabled', 403, 'FEATURE_DISABLED');
    });
    const response = await request(buildApp())
      .post('/api/reflections')
      .send({
        idempotencyKey: 'reflection-2',
        source: 'MANUAL_COURSE',
        promptType: 'COURSE_STATUS',
        promptVersion: 1,
      });

    expect(response.status).toBe(403);
    expect(mockReflectionService.create).not.toHaveBeenCalled();
  });

  it('fails closed before Chart migration', async () => {
    mockedInitialized.mockImplementation(() => {
      throw new AppError('Chart migration is required', 409, 'MIGRATION_REQUIRED');
    });
    const response = await request(buildApp())
      .post('/api/reflections')
      .send({
        idempotencyKey: 'reflection-3',
        source: 'MANUAL_COURSE',
        promptType: 'COURSE_STATUS',
        promptVersion: 1,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('MIGRATION_REQUIRED');
  });

  it('rejects an unknown reflection source and unknown fields', async () => {
    const badSource = await request(buildApp()).post('/api/reflections').send({
      idempotencyKey: 'reflection-4',
      source: 'CHART_PROTOTYPE',
      promptType: 'COURSE_STATUS',
      promptVersion: 1,
    });
    expect(badSource.status).toBe(400);

    const unknownField = await request(buildApp()).post('/api/reflections').send({
      idempotencyKey: 'reflection-5',
      source: 'MANUAL_COURSE',
      promptType: 'COURSE_STATUS',
      promptVersion: 1,
      deletedAt: null,
    });
    expect(unknownField.status).toBe(400);
  });

  it('does not let an update change the reflection’s course or waypoint binding', async () => {
    const response = await request(buildApp())
      .patch('/api/reflections/reflection-1')
      .send({ body: 'edited', courseId: 'other-course' });

    expect(response.status).toBe(400);
    expect(mockReflectionService.update).not.toHaveBeenCalled();
  });
});
