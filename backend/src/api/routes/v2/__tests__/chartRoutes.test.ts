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

const mockFlags = { enabled: true, write: true };
jest.mock('../../../../config/chartFlags', () => {
  const { AppError } = jest.requireActual('../../../middleware/errorHandler');
  return {
    requireChartEnabled: () => {
      if (!mockFlags.enabled) throw new AppError('Chart is currently disabled', 403, 'FEATURE_DISABLED');
    },
    requireChartWriteEnabled: () => {
      if (!mockFlags.enabled || !mockFlags.write) throw new AppError('Chart writes are currently disabled', 403, 'FEATURE_DISABLED');
    },
  };
});

const mockPrisma = { user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));

const mockChartService = {
  getChartForAnchor: jest.fn(),
  createChart: jest.fn(),
  applyRoute: jest.fn(),
  addMove: jest.fn(),
  updateMove: jest.fn(),
  completeMove: jest.fn(),
  dismissMove: jest.fn(),
  replaceSuggestedMoves: jest.fn(),
  updateWaypointProgress: jest.fn(),
  archiveChart: jest.fn(),
  deleteChart: jest.fn(),
};
const mockPlanner = { generate: jest.fn(), adjust: jest.fn(), suggestMoves: jest.fn(), get: jest.fn() };
jest.mock('../../../../services/chart/ChartService', () => ({ chartService: mockChartService }));
jest.mock('../../../../services/chart/ChartPlannerService', () => ({ chartPlannerService: mockPlanner }));

const mockAccess = { hasProAccess: true };
const mockCourseService = { completeWaypoint: jest.fn(), getCourse: jest.fn() };
jest.mock('../../../../services/CourseService', () => ({ courseService: mockCourseService }));
const mockEvaluateMilestones = jest.fn();
jest.mock('../../../../services/v2/milestones/MilestoneService', () => ({
  milestoneService: { evaluateQuietly: (...args: unknown[]) => mockEvaluateMilestones(...args) },
}));
jest.mock('../../../../services/MonetizationAccessService', () => ({
  getMonetizationAccess: jest.fn(async () => mockAccess),
}));

import chartRoutes from '../chartRoutes';

function app(): Application {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v2', chartRoutes);
  instance.use(errorHandler);
  return instance;
}

const key = 'idempotency-key-123';

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags.enabled = true;
  mockFlags.write = true;
  mockAccess.hasProAccess = true;
});

describe('Chart v2 routes', () => {
  it('completes an owned waypoint through v2 for an existing free-account Chart', async () => {
    mockAccess.hasProAccess = false;
    const completion = { course: { anchorId: 'a1' }, completedWaypoint: { id: 'w1', title: 'First' }, courseCompleted: false, replayed: false };
    const chart = { id: 'c1', version: 3 };
    mockCourseService.completeWaypoint.mockResolvedValue(completion);
    mockCourseService.getCourse.mockResolvedValue(chart);
    const response = await request(app()).post('/api/v2/charts/c1/waypoints/w1/complete')
      .send({ idempotencyKey: key, expectedCourseVersion: 2 });
    expect(response.status).toBe(200);
    expect(mockCourseService.completeWaypoint).toHaveBeenCalledWith('db-user-1', 'c1', 'w1', { idempotencyKey: key, expectedCourseVersion: 2 });
    expect(response.body.data).toEqual({ ...completion, chart });
    expect(mockEvaluateMilestones).toHaveBeenCalledWith('db-user-1', 'a1', { kind: 'chart', sourceEntityId: 'c1', eventId: 'w1' });
  });

  it('validates waypoint completion and respects write shutdown', async () => {
    const invalid = await request(app()).post('/api/v2/charts/c1/waypoints/w1/complete').send({ idempotencyKey: key });
    expect(invalid.status).toBe(400);
    mockFlags.write = false;
    const disabled = await request(app()).post('/api/v2/charts/c1/waypoints/w1/complete').send({ idempotencyKey: key, expectedCourseVersion: 2 });
    expect(disabled.status).toBe(403);
    expect(mockCourseService.completeWaypoint).not.toHaveBeenCalled();
  });

  it.each([[404, 'COURSE_NOT_FOUND'], [409, 'COURSE_VERSION_CONFLICT']])('preserves canonical completion errors (%s)', async (status, code) => {
    const { AppError } = jest.requireActual('../../../middleware/errorHandler');
    mockCourseService.completeWaypoint.mockRejectedValueOnce(new AppError('Completion refused', status, code));
    const response = await request(app()).post('/api/v2/charts/c1/waypoints/w1/complete')
      .send({ idempotencyKey: key, expectedCourseVersion: 2 });
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(mockCourseService.getCourse).not.toHaveBeenCalled();
    expect(mockEvaluateMilestones).not.toHaveBeenCalled();
  });

  it('reads the Chart for an Anchor', async () => {
    mockChartService.getChartForAnchor.mockResolvedValue({ chart: null });
    const response = await request(app()).get('/api/v2/anchors/a1/chart');
    expect(response.status).toBe(200);
    expect(mockChartService.getChartForAnchor).toHaveBeenCalledWith('db-user-1', 'a1');
  });

  it('respects the Chart feature flag', async () => {
    mockFlags.enabled = false;
    const response = await request(app()).get('/api/v2/anchors/a1/chart');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FEATURE_DISABLED');
  });

  it('plans with only the validated fields and initializes the Chart schema flag', async () => {
    mockPlanner.generate.mockResolvedValue({ status: 'needs_context', followUpQuestion: 'Where are you starting from now?' });
    const response = await request(app())
      .post('/api/v2/anchors/a1/chart/plan')
      .send({ idempotencyKey: key, startingContext: '100 users' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('needs_context');
    expect(mockPlanner.generate).toHaveBeenCalledWith('db-user-1', {
      anchorId: 'a1',
      idempotencyKey: key,
      startingContext: '100 users',
      destinationDescription: null,
      actualStartingPoint: null,
      followUp: null,
      requestId: undefined,
    });
    expect(mockPrisma.user.updateMany).toHaveBeenCalled();
  });

  it('accepts additive references, and a follow-up answered by a reference alone', async () => {
    mockPlanner.generate.mockResolvedValue({ status: 'needs_context', followUpQuestion: 'q?' });
    const assetId = '3f2b8c1e-6d1a-4c55-9a0e-1b2c3d4e5f60';
    const response = await request(app())
      .post('/api/v2/anchors/a1/chart/plan')
      .send({
        idempotencyKey: key,
        followUp: { question: 'What do you see?', answer: '' },
        references: [
          { kind: 'photo', assetId, role: 'start' },
          { kind: 'place', label: 'Mike’s Auto Body', latitude: 40.1, longitude: -74.2 },
          { kind: 'document', name: 'quote.txt', text: 'Estimate: $4,000' },
        ],
      });
    expect(response.status).toBe(200);
    const sent = mockPlanner.generate.mock.calls[0][1];
    expect(sent.references).toHaveLength(3);
    expect(sent.followUp).toEqual({ question: 'What do you see?', answer: '' });
  });

  it('rejects an empty follow-up with no reference, bad references, and too many references', async () => {
    const empty = await request(app())
      .post('/api/v2/anchors/a1/chart/plan')
      .send({ idempotencyKey: key, followUp: { question: 'q?', answer: '' } });
    expect(empty.status).toBe(400);
    const bad = await request(app())
      .post('/api/v2/anchors/a1/chart/plan')
      .send({ idempotencyKey: key, references: [{ kind: 'photo', assetId: 'not-a-uuid' }] });
    expect(bad.status).toBe(400);
    const place = { kind: 'place', label: 'x' };
    const many = await request(app())
      .post('/api/v2/anchors/a1/chart/plan')
      .send({ idempotencyKey: key, references: [place, place, place, place, place] });
    expect(many.status).toBe(400);
    expect(mockPlanner.generate).not.toHaveBeenCalled();
  });

  it('rejects unknown fields and oversized input before any service call', async () => {
    const extra = await request(app()).post('/api/v2/anchors/a1/chart/plan').send({ idempotencyKey: key, destination: 'x' });
    expect(extra.status).toBe(400);
    const long = await request(app()).post('/api/v2/anchors/a1/chart/plan').send({ idempotencyKey: key, startingContext: 'x'.repeat(501) });
    expect(long.status).toBe(400);
    expect(mockPlanner.generate).not.toHaveBeenCalled();
  });

  it('requires exactly one of courseId or draft to adjust', async () => {
    const neither = await request(app()).post('/api/v2/anchors/a1/chart/plan/adjust').send({ idempotencyKey: key, reason: 'OTHER' });
    expect(neither.status).toBe(400);
    mockPlanner.adjust.mockResolvedValue({ status: 'proposal', proposal: {} });
    const ok = await request(app())
      .post('/api/v2/anchors/a1/chart/plan/adjust')
      .send({ idempotencyKey: key, reason: 'FURTHER_ALONG', courseId: 'c1', detail: 'Retention is the problem' });
    expect(ok.status).toBe(200);
  });

  it('creates a Chart from a reviewed route (1–12 waypoints)', async () => {
    mockChartService.createChart.mockResolvedValue({ id: 'c1' });
    const waypoints = [{ title: 'Reach 1,000 users', kind: 'METRIC', metricTarget: 1000, metricLabel: 'users' }, { title: 'Reach 10,000 users' }];
    const response = await request(app())
      .post('/api/v2/anchors/a1/chart')
      .send({ idempotencyKey: key, destinationText: 'Reach 10,000 users', waypoints, oneMove: { title: 'Finish onboarding' } });
    expect(response.status).toBe(201);
    expect(mockChartService.createChart.mock.calls[0][1]).toMatchObject({ anchorId: 'a1', waypoints, oneMove: { title: 'Finish onboarding' } });

    const tooMany = await request(app())
      .post('/api/v2/anchors/a1/chart')
      .send({ idempotencyKey: key, destinationText: 'x', waypoints: Array.from({ length: 13 }, (_, i) => ({ title: `W${i}` })) });
    expect(tooMany.status).toBe(400);
  });

  it.each([3, 4, 5, 6, 7, 8, 12])('passes all %i reviewed waypoints through the API contract', async count => {
    const waypoints = Array.from({ length: count }, (_, index) => ({ title: `State ${index + 1}` }));
    mockChartService.createChart.mockResolvedValue({ id: 'c1', waypoints, waypointCount: count });
    const response = await request(app()).post('/api/v2/anchors/a1/chart').send({ idempotencyKey: key, destinationText: 'A meaningful destination', waypoints });
    expect(response.status).toBe(201);
    expect(mockChartService.createChart.mock.calls[0][1].waypoints).toEqual(waypoints);
  });

  it('completes a Move', async () => {
    mockChartService.completeMove.mockResolvedValue({ replayed: false });
    const response = await request(app()).post('/api/v2/charts/c1/moves/m1/complete');
    expect(response.status).toBe(200);
    expect(mockChartService.completeMove).toHaveBeenCalledWith('db-user-1', 'c1', 'm1');
  });

  it('keeps AI move suggestions optional: unavailable is not an error', async () => {
    mockPlanner.suggestMoves.mockResolvedValue({ available: false, moves: [] });
    const response = await request(app()).post('/api/v2/charts/c1/waypoints/w1/suggest-moves');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ available: false, chart: null });
    expect(mockChartService.replaceSuggestedMoves).not.toHaveBeenCalled();
  });

  it('archives a Chart by courseId and anchorId', async () => {
    mockChartService.archiveChart.mockResolvedValue({ id: 'c1', status: 'ARCHIVED' });
    const res1 = await request(app()).post('/api/v2/charts/c1/archive').send({ expectedCourseVersion: 5 });
    expect(res1.status).toBe(200);
    expect(mockChartService.archiveChart).toHaveBeenCalledWith('db-user-1', { courseId: 'c1' }, 5);

    const res2 = await request(app()).post('/api/v2/anchors/a1/chart/archive');
    expect(res2.status).toBe(200);
    expect(mockChartService.archiveChart).toHaveBeenCalledWith('db-user-1', { anchorId: 'a1' }, undefined);
  });

  it('deletes a Chart by courseId and anchorId', async () => {
    mockChartService.deleteChart.mockResolvedValue({ deleted: true });
    const res1 = await request(app()).delete('/api/v2/charts/c1').send({ expectedCourseVersion: 5 });
    expect(res1.status).toBe(200);
    expect(mockChartService.deleteChart).toHaveBeenCalledWith('db-user-1', { courseId: 'c1' }, 5);

    const res2 = await request(app()).delete('/api/v2/anchors/a1/chart');
    expect(res2.status).toBe(200);
    expect(mockChartService.deleteChart).toHaveBeenCalledWith('db-user-1', { anchorId: 'a1' }, undefined);
  });

  it('blocks writes when Chart writes are disabled', async () => {
    mockFlags.write = false;
    const response = await request(app()).post('/api/v2/charts/c1/moves/m1/complete');
    expect(response.status).toBe(403);
  });

  describe('GET /charts/:courseId/proposals/:proposalId', () => {
    it('returns the person’s own proposal for that Chart', async () => {
      mockPlanner.get.mockResolvedValue({ proposalId: 'p1', courseId: 'course-1', waypoints: [] });
      const response = await request(app()).get('/api/v2/charts/course-1/proposals/p1');
      expect(response.status).toBe(200);
      expect(response.body.data.proposalId).toBe('p1');
      expect(mockPlanner.get).toHaveBeenCalledWith('db-user-1', 'p1');
    });

    it('does not return a proposal that belongs to a different Chart', async () => {
      mockPlanner.get.mockResolvedValue({ proposalId: 'p1', courseId: 'other-course', waypoints: [] });
      const response = await request(app()).get('/api/v2/charts/course-1/proposals/p1');
      expect(response.status).toBe(404);
    });
  });

  describe('Chart creation is Pro; viewing and working a Chart is not', () => {
    const route = [{ title: 'First waypoint' }];

    it('refuses plan, draft revision and save for a free account, before any write', async () => {
      mockAccess.hasProAccess = false;
      const plan = await request(app()).post('/api/v2/anchors/a1/chart/plan').send({ idempotencyKey: key });
      const adjust = await request(app())
        .post('/api/v2/anchors/a1/chart/plan/adjust')
        .send({ idempotencyKey: key, reason: 'TOO_MANY_STEPS', draft: { destination: 'Somewhere', waypoints: route } });
      const create = await request(app())
        .post('/api/v2/anchors/a1/chart')
        .send({ idempotencyKey: key, destinationText: 'Somewhere', waypoints: route });
      for (const response of [plan, adjust, create]) {
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('CHART_PREMIUM_REQUIRED');
      }
      expect(mockPlanner.generate).not.toHaveBeenCalled();
      expect(mockPlanner.adjust).not.toHaveBeenCalled();
      expect(mockChartService.createChart).not.toHaveBeenCalled();
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('still lets a free account open a Chart, adjust a saved one and complete a Move', async () => {
      mockAccess.hasProAccess = false;
      mockChartService.getChartForAnchor.mockResolvedValue({ chart: null });
      mockPlanner.adjust.mockResolvedValue({ status: 'proposal' });
      mockChartService.completeMove.mockResolvedValue({ id: 'c1' });
      expect((await request(app()).get('/api/v2/anchors/a1/chart')).status).toBe(200);
      expect(
        (await request(app()).post('/api/v2/anchors/a1/chart/plan/adjust').send({ idempotencyKey: key, reason: 'TOO_MANY_STEPS', courseId: 'c1' })).status
      ).toBe(200);
      expect((await request(app()).post('/api/v2/charts/c1/moves/m1/complete')).status).toBe(200);
    });
  });
});
