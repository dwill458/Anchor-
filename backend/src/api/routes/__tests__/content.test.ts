import express, { Application } from 'express';
import request from 'supertest';

jest.mock('../../middleware/auth');

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  flaggedContent: {
    create: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { authMiddleware } from '../../middleware/auth';
import contentRouter from '../content';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/content', contentRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();

  mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
    req.user = { uid: 'firebase-uid-1', email: 'test@example.com' };
    next();
  });
});

describe('POST /api/content/flag', () => {
  it('stores reports against the authenticated database user id', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'db-user-1' });
    mockPrisma.flaggedContent.create.mockResolvedValue({ id: 'flag-1' });

    const res = await request(buildApp()).post('/api/content/flag').send({
      anchorId: 'anchor-1',
      imageUrl: 'https://example.com/anchor.png',
      reason: 'other',
    });

    expect(res.status).toBe(201);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { authUid: 'firebase-uid-1' },
      select: { id: true },
    });
    expect(mockPrisma.flaggedContent.create).toHaveBeenCalledWith({
      data: {
        anchorId: 'anchor-1',
        imageUrl: 'https://example.com/anchor.png',
        reason: 'other',
        userId: 'db-user-1',
      },
    });
  });

  it('returns 404 when the authenticated user has no database row', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).post('/api/content/flag').send({
      anchorId: 'anchor-1',
      imageUrl: 'https://example.com/anchor.png',
      reason: 'other',
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
