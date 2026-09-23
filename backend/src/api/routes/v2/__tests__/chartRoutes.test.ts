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
};
const mockPlanner = { generate: jest.fn(), adjust: jest.fn(), suggestMoves: jest.fn() };
jest.mock('../../../../services/chart/ChartService', () => ({ chartService: mockChartService }));
jest.mock('../../../../services/chart/ChartPlannerService', () => ({ chartPlannerService: mockPlanner }));

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
});

describe('Chart v2 routes', () => {
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
      followUp: null,
    });
    expect(mockPrisma.user.updateMany).toHaveBeenCalled();
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

  it('blocks writes when Chart writes are disabled', async () => {
    mockFlags.write = false;
    const response = await request(app()).post('/api/v2/charts/c1/moves/m1/complete');
    expect(response.status).toBe(403);
  });
});
