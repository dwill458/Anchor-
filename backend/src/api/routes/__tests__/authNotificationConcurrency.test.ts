import request from 'supertest';
import express, { Application } from 'express';
import { errorHandler } from '../../middleware/errorHandler';

const mockPrisma = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn().mockResolvedValue(0),
  $transaction: jest.fn(),
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../middleware/auth');
jest.mock('../../../config/firebase');
jest.mock('express-rate-limit', () => jest.fn(() => (_req: any, _res: any, next: any) => next()));

import { authMiddleware } from '../../middleware/auth';
import authRouter from '../auth';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

describe('PUT /api/auth/notification-state atomic token assignment & concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) =>
      typeof callback === 'function' ? callback(mockPrisma) : callback
    );
    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { uid: 'firebase-user-1', email: 'user1@example.com' };
      next();
    });
  });

  it('atomically executes token disassociation and assignment inside a database transaction', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        notification_state: {},
        notifications_enabled: true,
        expo_push_token: 'ExponentPushToken[shared-device-token]',
        fcm_token: 'fcm-shared-token',
        apns_token: 'apns-shared-token',
      },
    ]);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        pushTokens: {
          expoPushToken: 'ExponentPushToken[shared-device-token]',
          fcmToken: 'fcm-shared-token',
          apnsToken: 'apns-shared-token',
        },
      });

    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(3); // expo, fcm, and apns disassociation
    expect(res.body.data.expoPushToken).toBe('ExponentPushToken[shared-device-token]');
    expect(res.body.data.fcmToken).toBe('fcm-shared-token');
    expect(res.body.data.apnsToken).toBe('apns-shared-token');
  });

  it('safely handles token disassociation on logout (nulling push tokens)', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        notification_state: {},
        notifications_enabled: true,
        expo_push_token: null,
        fcm_token: null,
        apns_token: null,
      },
    ]);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        pushTokens: {
          expoPushToken: null,
          fcmToken: null,
          apnsToken: null,
        },
      });

    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(res.body.data.expoPushToken).toBeNull();
    expect(res.body.data.fcmToken).toBeNull();
    expect(res.body.data.apnsToken).toBeNull();
  });

  it('returns 409 when unique token conflict occurs during concurrent assignment', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    const conflictError: any = new Error('Unique constraint failed on the fields: (`expo_push_token`)');
    conflictError.code = 'P2002';
    (mockPrisma.$transaction as jest.Mock).mockRejectedValue(conflictError);

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        pushTokens: {
          expoPushToken: 'ExponentPushToken[concurrent-token]',
        },
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOKEN_CONFLICT');
  });

  it('rolls back and returns 500 when database update fails inside transaction', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'db-user-1' });
    (mockPrisma.$transaction as jest.Mock).mockRejectedValue(new Error('Connection aborted'));

    const res = await request(buildApp())
      .put('/api/auth/notification-state')
      .send({
        pushTokens: {
          expoPushToken: 'ExponentPushToken[failing-token]',
        },
      });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('UPDATE_ERROR');
  });
});
