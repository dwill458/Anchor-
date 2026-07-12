import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

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

const mockGetRevenueCatAccess = jest.fn();
jest.mock('../../../services/RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: (...args: unknown[]) => mockGetRevenueCatAccess(...args),
}));

import { authMiddleware } from '../../middleware/auth';
import billingRouter from '../billing';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRouter);
  app.use(errorHandler);
  return app;
}

const FIREBASE_USER = { uid: 'firebase-uid-1', email: 'test@example.com' };

const buildUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'db-user-1',
  isComped: false,
  subscriptionStatus: 'free',
  subscriptionId: null,
  ...overrides,
});

describe('POST /api/billing/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = FIREBASE_USER;
      next();
    });
    mockPrisma.user.findUnique.mockResolvedValue(buildUser());
    mockPrisma.user.update.mockResolvedValue({});
  });

  it('uses the authenticated Firebase user and persists a freshly confirmed entitlement', async () => {
    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: true,
      productIdentifier: 'anchor_pro_annual',
    });

    const response = await request(buildApp())
      .post('/api/billing/refresh')
      .send({ appUserId: 'victim-id', productIdentifier: 'forged-product', price: 0.01 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        hasActiveEntitlement: true,
        subscriptionStatus: 'pro',
        productIdentifier: 'anchor_pro_annual',
        source: 'revenuecat',
      },
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { authUid: 'firebase-uid-1' },
    }));
    expect(mockGetRevenueCatAccess).toHaveBeenCalledWith(
      'db-user-1',
      expect.any(Date),
      { forceRefresh: true }
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'db-user-1' },
      data: {
        subscriptionStatus: 'pro',
        subscriptionId: 'anchor_pro_annual',
      },
    });
  });

  it('persists an inactive fresh lookup as free access', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      buildUser({ subscriptionStatus: 'pro', subscriptionId: 'anchor_pro_monthly' })
    );
    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: false,
      productIdentifier: 'anchor_pro_monthly',
    });

    const response = await request(buildApp()).post('/api/billing/refresh');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      hasActiveEntitlement: false,
      subscriptionStatus: 'free',
      productIdentifier: null,
      source: 'revenuecat',
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'db-user-1' },
      data: { subscriptionStatus: 'free', subscriptionId: null },
    });
  });

  it('does not mutate access when RevenueCat cannot be reached', async () => {
    mockGetRevenueCatAccess.mockResolvedValue(null);

    const response = await request(buildApp()).post('/api/billing/refresh');

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: 'BILLING_UNAVAILABLE' });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns comped access without asking RevenueCat to verify a store entitlement', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      buildUser({ isComped: true, subscriptionId: 'internal-comp' })
    );

    const response = await request(buildApp()).post('/api/billing/refresh');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      hasActiveEntitlement: true,
      subscriptionStatus: 'pro',
      productIdentifier: 'internal-comp',
      source: 'comped',
    });
    expect(mockGetRevenueCatAccess).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
