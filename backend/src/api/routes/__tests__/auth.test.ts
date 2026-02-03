import express from 'express';
import request from 'supertest';
import { AppError } from '../../middleware/errorHandler';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('@prisma/client', () => require('../../../../__mocks__/@prisma/client'));
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-uid', email: 'user@example.com' };
    next();
  },
}));

const { __prismaMock } = jest.requireMock('@prisma/client') as { __prismaMock: any };
const authRoutes = require('../auth').default;

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a new user', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
    (__prismaMock.user.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User',
      authUid: 'user@example.com',
      subscriptionStatus: 'free',
      totalAnchorsCreated: 0,
      totalActivations: 0,
      currentStreak: 0,
      longestStreak: 0,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
    (__prismaMock.userSettings.create as jest.Mock).mockResolvedValue({});
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (jwt.sign as jest.Mock).mockReturnValue('token');

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'User@Example.com', password: 'password123', displayName: 'User' });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toBe('token');
    expect(response.body.data.user.email).toBe('user@example.com');
  });

  it('logs in with valid credentials', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User',
      authUid: 'user@example.com',
      passwordHash: 'hashed',
      subscriptionStatus: 'free',
      totalAnchorsCreated: 0,
      totalActivations: 0,
      currentStreak: 0,
      longestStreak: 0,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('token');

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBe('token');
  });

  it('syncs an existing user', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      authUid: 'auth-uid',
      email: 'user@example.com',
      displayName: 'User',
    });
    (__prismaMock.user.update as jest.Mock).mockResolvedValue({
      id: 'user-1',
      authUid: 'auth-uid',
      email: 'user@example.com',
      displayName: 'User',
    });

    const response = await request(app)
      .post('/api/auth/sync')
      .send({
        authUid: 'auth-uid',
        email: 'user@example.com',
        displayName: 'User',
        authProvider: 'email',
      });

    expect(response.status).toBe(200);
    expect(__prismaMock.userSettings.create).not.toHaveBeenCalled();
  });

  it('syncs a new user and creates settings', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
    (__prismaMock.user.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      authUid: 'auth-uid',
      email: 'user@example.com',
      displayName: 'User',
    });
    (__prismaMock.userSettings.create as jest.Mock).mockResolvedValue({});

    const response = await request(app)
      .post('/api/auth/sync')
      .send({
        authUid: 'auth-uid',
        email: 'user@example.com',
        displayName: 'User',
        authProvider: 'google',
      });

    expect(response.status).toBe(200);
    expect(__prismaMock.userSettings.create).toHaveBeenCalled();
  });

  it('returns current user profile', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      authUid: 'auth-uid',
      email: 'user@example.com',
      displayName: 'User',
      subscriptionStatus: 'free',
      totalAnchorsCreated: 1,
      totalActivations: 2,
      currentStreak: 1,
      longestStreak: 3,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      settings: { notificationsEnabled: true },
    });

    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.settings.notificationsEnabled).toBe(true);
  });

  it('updates user profile', async () => {
    (__prismaMock.user.update as jest.Mock).mockResolvedValue({
      id: 'user-1',
      authUid: 'auth-uid',
      email: 'user@example.com',
      displayName: 'Updated',
      subscriptionStatus: 'free',
      totalAnchorsCreated: 1,
      totalActivations: 2,
      currentStreak: 1,
      longestStreak: 3,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });

    const response = await request(app)
      .put('/api/auth/profile')
      .send({ displayName: 'Updated' });

    expect(response.status).toBe(200);
    expect(response.body.data.displayName).toBe('Updated');
  });

  it('updates user settings', async () => {
    (__prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      authUid: 'auth-uid',
    });
    (__prismaMock.userSettings.upsert as jest.Mock).mockResolvedValue({
      notificationsEnabled: true,
      vaultViewType: 'grid',
    });

    const response = await request(app)
      .put('/api/auth/settings')
      .send({
        notificationsEnabled: true,
        dailyReminderTime: '08:30',
        hapticIntensity: 3,
        vaultViewType: 'grid',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.vaultViewType).toBe('grid');
  });

  it('throws on invalid dailyReminderTime', async () => {
    const handler = (authRoutes as any).stack.find(
      (layer: any) => layer.route?.path === '/settings'
    ).route.stack[1].handle;

    const req = {
      body: { dailyReminderTime: '99:99' },
      user: { uid: 'auth-uid' },
    } as any;
    const res = {} as any;

    await expect(handler(req, res)).rejects.toThrow(AppError);
  });
});
