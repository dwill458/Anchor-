/**
 * Route tests for /api/orders
 *
 * Covers:
 *   POST /api/orders   — create order
 *   GET  /api/orders   — list user orders
 */

import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../middleware/auth');

// orders.ts instantiates its own PrismaClient — mock the module
const mockPrismaInstance = {
  user: {
    findUnique: jest.fn(),
  },
  anchor: {
    findFirst: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance),
}));

import { authMiddleware } from '../../middleware/auth';
import ordersRouter from '../orders';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

// ── App setup ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', ordersRouter);
  app.use(errorHandler);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AUTH_USER = { uid: 'firebase-uid-1', email: 'user@example.com' };
const MOCK_DB_USER = { id: 'db-user-1', authUid: 'firebase-uid-1', email: 'user@example.com' };
const MOCK_ANCHOR = {
  id: 'anchor-1',
  userId: 'db-user-1',
  baseSigilSvg: '<svg/>',
  enhancedImageUrl: null,
};
const MOCK_ORDER = {
  id: 'order-1',
  userId: 'db-user-1',
  productType: 'print',
  productVariant: 'M - black',
  quantity: 1,
  subtotalCents: 3500,
  shippingCents: 800,
  taxCents: 250,
  totalCents: 4550,
  currency: 'USD',
  status: 'pending',
  createdAt: new Date().toISOString(),
};

const VALID_CREATE_BODY = {
  anchorId: 'anchor-1',
  productType: 'print',
  size: 'M',
  color: 'black',
  shippingInfo: { name: 'Jane Doe', address: '123 Main St', city: 'NYC', zip: '10001' },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/orders', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = MOCK_AUTH_USER;
      next();
    });

    mockPrismaInstance.user.findUnique.mockResolvedValue(MOCK_DB_USER);
    mockPrismaInstance.anchor.findFirst.mockResolvedValue(MOCK_ANCHOR);
    mockPrismaInstance.order.create.mockResolvedValue(MOCK_ORDER);
  });

  it('creates an order and returns 201', async () => {
    const res = await request(app).post('/api/orders').send(VALID_CREATE_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', 'order-1');
  });

  it('calls prisma.order.create with correct fields', async () => {
    await request(app).post('/api/orders').send(VALID_CREATE_BODY);

    expect(mockPrismaInstance.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'db-user-1',
          productType: 'print',
          quantity: 1,
          currency: 'USD',
          status: 'pending',
        }),
      })
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockedAuthMiddleware.mockImplementation((_req: any, _res: any, next: any) => {
      next();
    });

    const res = await request(app).post('/api/orders').send(VALID_CREATE_BODY);
    expect(res.status).toBe(401);
  });

  it('returns 400 when anchorId is missing', async () => {
    const { anchorId: _omit, ...body } = VALID_CREATE_BODY;
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when productType is missing', async () => {
    const { productType: _omit, ...body } = VALID_CREATE_BODY;
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(400);
  });

  it('returns 400 when shippingInfo is missing', async () => {
    const { shippingInfo: _omit, ...body } = VALID_CREATE_BODY;
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockPrismaInstance.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/orders').send(VALID_CREATE_BODY);
    expect(res.status).toBe(404);
  });

  it('returns 404 when anchor not found or not owned by user', async () => {
    mockPrismaInstance.anchor.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/orders').send(VALID_CREATE_BODY);
    expect(res.status).toBe(404);
  });

  describe('product pricing', () => {
    const products: Array<[string, number]> = [
      ['print', 3500 + 800 + 250],
      ['keychain', 1800 + 500 + 150],
      ['hoodie', 6500 + 1200 + 500],
      ['t-shirt', 3200 + 800 + 250],
      ['phone-case', 2800 + 600 + 200],
      ['unknown-type', 3500 + 800 + 250], // falls back to print pricing
    ];

    test.each(products)('calculates total for %s correctly', async (productType, expectedTotal) => {
      await request(app)
        .post('/api/orders')
        .send({ ...VALID_CREATE_BODY, productType });

      expect(mockPrismaInstance.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalCents: expectedTotal }),
        })
      );
    });
  });
});

describe('GET /api/orders', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      req.user = MOCK_AUTH_USER;
      next();
    });

    mockPrismaInstance.user.findUnique.mockResolvedValue(MOCK_DB_USER);
    mockPrismaInstance.order.findMany.mockResolvedValue([MOCK_ORDER]);
  });

  it('returns 200 and list of orders', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns empty array when user has no orders', async () => {
    mockPrismaInstance.order.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockedAuthMiddleware.mockImplementation((_req: any, _res: any, next: any) => {
      next();
    });

    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found', async () => {
    mockPrismaInstance.user.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(404);
  });

  it('queries orders ordered by createdAt desc', async () => {
    await request(app).get('/api/orders');

    expect(mockPrismaInstance.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});
