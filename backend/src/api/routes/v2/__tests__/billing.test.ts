import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth');

const mockPrisma = {
  user: { findUnique: jest.fn(), updateMany: jest.fn() },
};
jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../../../services/RevenueCatEntitlementService', () => ({ getRevenueCatAccess: jest.fn().mockResolvedValue(null) }));

import { authMiddleware } from '../../../middleware/auth';
import billingRouter from '../billing';

const mockedAuthMiddleware = authMiddleware as jest.Mock;
function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v2/billing', billingRouter);
  app.use(errorHandler);
  return app;
}

describe('POST /api/v2/billing/trial/activate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => { req.user = { uid: 'firebase-uid-1' }; next(); });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it('starts an explicit trial exactly once and returns the server state', async () => {
    const startedAt = new Date('2026-09-07T12:00:00.000Z');
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', isComped: false, trialStartedAt: null })
      .mockResolvedValueOnce({ id: 'user-1', isComped: false, trialStartedAt: startedAt });
    const response = await request(buildApp()).post('/api/v2/billing/trial/activate').send({ trialStartedAt: 'forged' });
    expect(response.status).toBe(200);
    expect(response.body.data.trialState).toBe('ACTIVE');
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1', trialStartedAt: null },
      data: { trialStartedAt: expect.any(Date) },
    }));
  });

  it('does not restart an active trial', async () => {
    const startedAt = new Date();
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', isComped: false, trialStartedAt: startedAt })
      .mockResolvedValueOnce({ id: 'user-1', isComped: false, trialStartedAt: startedAt });
    const response = await request(buildApp()).post('/api/v2/billing/trial/activate');
    expect(response.status).toBe(200);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an expired existing trial without changing its timestamp', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1', isComped: false, trialStartedAt: new Date(Date.now() - 8 * 86_400_000),
    });
    const response = await request(buildApp()).post('/api/v2/billing/trial/activate');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TRIAL_ALREADY_USED');
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });
});
