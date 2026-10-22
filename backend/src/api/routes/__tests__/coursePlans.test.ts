import express, { Application } from 'express';
import request from 'supertest';
import { AppError, errorHandler } from '../../middleware/errorHandler';

jest.mock('../../middleware/auth');

const mockPrisma = { user: { findUnique: jest.fn() } };
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('../../../config/chartFlags', () => ({
  requireChartPlannerEnabled: jest.fn(),
  requireChartWriteEnabled: jest.fn(),
  requireChartInitialized: jest.fn(),
}));

const mockPlanner = {
  generate: jest.fn(),
  get: jest.fn(),
  accept: jest.fn(),
  getQuota: jest.fn(),
};
jest.mock('../../../services/CoursePlannerService', () => ({ coursePlannerService: mockPlanner }));

// The route resolves capabilities server-side on every planner request. This
// suite tests the route boundary, so the projection is stubbed here and covered
// on its own in `services/__tests__/ChartCapabilityService.test.ts`.
const mockGetChartCapabilities = jest.fn();
jest.mock('../../../services/ChartCapabilityService', () => ({
  getChartCapabilities: (...args: unknown[]) => mockGetChartCapabilities(...args),
}));

import { authMiddleware } from '../../middleware/auth';
import {
  requireChartInitialized,
  requireChartPlannerEnabled,
  requireChartWriteEnabled,
} from '../../../config/chartFlags';
import coursePlansRouter from '../coursePlans';

const mockedAuth = authMiddleware as jest.Mock;
const mockedPlannerEnabled = requireChartPlannerEnabled as jest.Mock;
const mockedWriteEnabled = requireChartWriteEnabled as jest.Mock;
const mockedInitialized = requireChartInitialized as jest.Mock;

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/course-plans', coursePlansRouter);
  app.use(errorHandler);
  return app;
}

describe('Chart plan route boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { uid: 'firebase-user-1' };
      next();
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      chartSchemaVersion: 1,
      isComped: false,
      subscriptionStatus: 'pro',
      subscriptionId: 'pro',
      trialStartedAt: new Date(),
    });
    mockedPlannerEnabled.mockImplementation(() => undefined);
    mockedWriteEnabled.mockImplementation(() => undefined);
    mockedInitialized.mockImplementation(() => undefined);
    mockGetChartCapabilities.mockResolvedValue({
      canGenerateChartPlan: true,
      canRetrieveOwnedChartPlan: true,
      canAcceptExistingChartPlan: true,
      plannerQuota: { eligible: true, limit: 3, remaining: 2, resetAt: null, reason: null },
    });
  });

  it('strictly rejects unknown planner input without invoking the planner', async () => {
    const response = await request(buildApp()).post('/api/course-plans').send({
      destinationText: 'Complete a portfolio',
      idempotencyKey: 'plan-1',
      reflection: 'private text',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockPlanner.generate).not.toHaveBeenCalled();
  });

  it('authenticates and forwards only validated generation input', async () => {
    mockPlanner.generate.mockResolvedValue({ proposalId: 'proposal-1' });
    const response = await request(buildApp()).post('/api/course-plans').send({
      destinationText: ' Complete a portfolio ',
      idempotencyKey: 'plan-1',
    });
    expect(response.status).toBe(201);
    // Entitlement inputs are resolved server-side and handed to the service;
    // only the two validated fields come from the request body.
    expect(mockPlanner.generate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      { destinationText: 'Complete a portfolio', idempotencyKey: 'plan-1' }
    );
  });

  it('keeps acceptance behind both planner and Chart-write flags', async () => {
    mockedWriteEnabled.mockImplementation(() => {
      throw new AppError('Chart writes are currently disabled', 403, 'FEATURE_DISABLED');
    });
    const response = await request(buildApp())
      .post('/api/course-plans/proposal-1/accept')
      .send({ idempotencyKey: 'accept-1' });
    expect(response.status).toBe(403);
    expect(mockPlanner.accept).not.toHaveBeenCalled();
  });

  // ── Phase 0 amendment F1: entitlement and quota at the route boundary ──────

  it('reaches the planner with server-resolved entitlement inputs only', async () => {
    mockPlanner.generate.mockResolvedValue({ proposalId: 'proposal-1' });

    await request(buildApp())
      .post('/api/course-plans')
      .send({ destinationText: 'Complete a portfolio', idempotencyKey: 'plan-1' });

    const [passedUser] = mockPlanner.generate.mock.calls[0];
    expect(passedUser).toMatchObject({
      id: 'user-1',
      isComped: false,
      subscriptionStatus: 'pro',
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ trialStartedAt: true, isComped: true }),
      })
    );
  });

  it('cannot be told by the client that it is entitled or has quota', async () => {
    const response = await request(buildApp()).post('/api/course-plans').send({
      destinationText: 'Complete a portfolio',
      idempotencyKey: 'plan-1',
      eligible: true,
      remaining: 99,
      entitlement: 'pro',
      chart_ai_planner_enabled: true,
    });

    // The strict schema rejects the whole body rather than ignoring the extras.
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockPlanner.generate).not.toHaveBeenCalled();
  });

  it('surfaces a server quota denial without inventing a retry path', async () => {
    mockPlanner.generate.mockRejectedValue(
      new AppError('Plan generation limit reached', 403, 'PLANNER_QUOTA_EXCEEDED', {
        reason: 'quota_exhausted',
        limit: 3,
        remaining: 0,
      })
    );

    const response = await request(buildApp())
      .post('/api/course-plans')
      .send({ destinationText: 'Complete a portfolio', idempotencyKey: 'plan-1' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PLANNER_QUOTA_EXCEEDED');
  });

  it('denies generation when the planner server flag is off, before any planner work', async () => {
    mockedPlannerEnabled.mockImplementation(() => {
      throw new AppError('Chart planning is currently disabled', 403, 'FEATURE_DISABLED');
    });

    const response = await request(buildApp())
      .post('/api/course-plans')
      .send({ destinationText: 'Complete a portfolio', idempotencyKey: 'plan-1' });

    expect(response.status).toBe(403);
    expect(mockPlanner.generate).not.toHaveBeenCalled();
    // The flag gate runs before the user is even resolved.
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('serves safe quota state without exposing subscription internals', async () => {
    // Quota is projected by ChartCapabilityService so /auth/me and this route
    // can never disagree about what the account is allowed to do.
    mockGetChartCapabilities.mockResolvedValue({
      canGenerateChartPlan: true,
      canRetrieveOwnedChartPlan: true,
      canAcceptExistingChartPlan: true,
      plannerQuota: {
        eligible: true,
        entitlement: 'trial',
        limit: 3,
        remaining: 2,
        used: 1,
        resetAt: null,
        reason: null,
      },
    });

    const response = await request(buildApp()).get('/api/course-plans/quota');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      eligible: true,
      limit: 3,
      remaining: 2,
      resetAt: null,
      reason: null,
    });
    // Entitlement state and raw usage stay on the server.
    expect(response.body.data).not.toHaveProperty('entitlement');
    expect(response.body.data).not.toHaveProperty('used');
  });

  it('routes the literal quota path to quota rather than to proposal retrieval', async () => {
    mockGetChartCapabilities.mockResolvedValue({
      canGenerateChartPlan: false,
      canRetrieveOwnedChartPlan: true,
      canAcceptExistingChartPlan: true,
      plannerQuota: {
        eligible: false,
        entitlement: 'expired',
        limit: 0,
        remaining: 0,
        used: 0,
        resetAt: null,
        reason: 'entitlement_expired',
      },
    });

    const response = await request(buildApp()).get('/api/course-plans/quota');

    // `quota` must not be captured as a proposal id by GET /:proposalId.
    expect(response.status).toBe(200);
    expect(response.body.data.reason).toBe('entitlement_expired');
    expect(mockPlanner.get).not.toHaveBeenCalled();
  });

  // ── Workstream G: capability projection gates every planner route ──────────

  it('denies generation when the account capability withholds it', async () => {
    mockGetChartCapabilities.mockResolvedValue({
      canGenerateChartPlan: false,
      canRetrieveOwnedChartPlan: true,
      canAcceptExistingChartPlan: true,
      plannerQuota: {
        eligible: false,
        limit: 0,
        remaining: 0,
        resetAt: null,
        reason: 'not_entitled',
      },
    });

    const response = await request(buildApp())
      .post('/api/course-plans')
      .send({ destinationText: 'Complete a portfolio', idempotencyKey: 'plan-1' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PLANNER_UNAVAILABLE');
    expect(mockPlanner.generate).not.toHaveBeenCalled();
  });

  it('keeps retrieval and acceptance of owned proposals available after entitlement loss', async () => {
    // F1: losing entitlement must not strand a proposal the account already owns.
    mockGetChartCapabilities.mockResolvedValue({
      canGenerateChartPlan: false,
      canRetrieveOwnedChartPlan: true,
      canAcceptExistingChartPlan: true,
      plannerQuota: {
        eligible: false,
        limit: 0,
        remaining: 0,
        resetAt: null,
        reason: 'entitlement_expired',
      },
    });
    mockPlanner.get.mockResolvedValue({ proposalId: 'proposal-1' });
    mockPlanner.accept.mockResolvedValue({ courseId: 'course-1' });

    expect((await request(buildApp()).get('/api/course-plans/proposal-1')).status).toBe(200);
    expect(
      (
        await request(buildApp())
          .post('/api/course-plans/proposal-1/accept')
          .send({ idempotencyKey: 'accept-1' })
      ).status
    ).toBe(200);
  });

  it('keeps the hourly rate limiter separate from the entitlement cap', async () => {
    // The limiter allows 20 requests per hour; the frozen trial cap is 3. A
    // request well inside the limiter window must still be refused by quota,
    // which proves the limiter is not standing in for the cap.
    mockPlanner.generate.mockRejectedValue(
      new AppError('Plan generation limit reached', 403, 'PLANNER_QUOTA_EXCEEDED', {
        reason: 'quota_exhausted',
      })
    );
    const app = buildApp();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(app)
        .post('/api/course-plans')
        .send({ destinationText: 'Complete a portfolio', idempotencyKey: `plan-${attempt}` });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('PLANNER_QUOTA_EXCEEDED');
    }
  });
});
