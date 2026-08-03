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

const mockPlanner = { generate: jest.fn(), get: jest.fn(), accept: jest.fn() };
jest.mock('../../../services/CoursePlannerService', () => ({ coursePlannerService: mockPlanner }));

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
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', chartSchemaVersion: 1 });
    mockedPlannerEnabled.mockImplementation(() => undefined);
    mockedWriteEnabled.mockImplementation(() => undefined);
    mockedInitialized.mockImplementation(() => undefined);
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
    expect(mockPlanner.generate).toHaveBeenCalledWith('user-1', {
      destinationText: 'Complete a portfolio',
      idempotencyKey: 'plan-1',
    });
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
});
