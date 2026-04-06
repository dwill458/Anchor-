/**
 * Route tests for /api/anchors
 *
 * Covers all 7 handlers:
 *   POST   /                create anchor
 *   GET    /                list anchors (with filter/sort/limit)
 *   GET    /:id             get single anchor
 *   PUT    /:id             update anchor
 *   DELETE /:id             archive anchor
 *   POST   /:id/charge      charge anchor
 *   POST   /:id/activate    activate anchor
 *   POST   /:id/burn        burn anchor
 */

import express, { Application } from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../middleware/auth');

// Prisma mock — provide jest.fn() for every method used in anchors routes
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  anchor: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  charge: { create: jest.fn() },
  activation: { create: jest.fn() },
  burnedAnchor: { create: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { authMiddleware } from '../../middleware/auth';
import anchorsRouter from '../anchors';

const mockedAuthMiddleware = authMiddleware as jest.Mock;

// ── Test App ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  // Use a large limit so Zod schema validation (not body-parser) enforces the
  // 5 MB cap — this mirrors production where the real limit is 1 MB and the
  // Zod limit acts as a secondary defence for SVG fields.
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/anchors', anchorsRouter);
  app.use(errorHandler);
  return app;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USER_AUTH = { uid: 'firebase-uid-1', email: 'test@example.com' };
const MOCK_DB_USER = { id: 'db-user-1', authUid: 'firebase-uid-1', email: 'test@example.com' };

const MOCK_ANCHOR = {
  id: 'anchor-1',
  userId: 'db-user-1',
  intentionText: 'Test intention',
  category: 'healing',
  distilledLetters: ['T', 'I'],
  baseSigilSvg: '<svg/>',
  reinforcedSigilSvg: null,
  enhancedImageUrl: null,
  structureVariant: 'balanced',
  reinforcementMetadata: null,
  enhancementMetadata: null,
  mantraText: null,
  mantraPronunciation: null,
  mantraAudioUrl: null,
  generationMethod: 'automated',
  isCharged: false,
  chargedAt: null,
  chargeMethod: null,
  isArchived: false,
  archivedAt: null,
  isShared: false,
  sharedAt: null,
  activationCount: 0,
  lastActivatedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const VALID_CREATE_BODY = {
  intentionText: 'Test intention',
  category: 'healing',
  distilledLetters: ['T', 'I'],
  baseSigilSvg: '<svg><rect/></svg>',
  structureVariant: 'balanced',
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: auth passes and attaches mock user
  mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
    req.user = MOCK_USER_AUTH;
    next();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/anchors
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/anchors', () => {
  it('creates an anchor and returns 201 with anchor data', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.create as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('anchor-1');
    expect(mockPrisma.anchor.create).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when intentionText is missing', async () => {
    const res = await request(buildApp())
      .post('/api/anchors')
      .send({ ...VALID_CREATE_BODY, intentionText: undefined });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when baseSigilSvg is missing', async () => {
    const res = await request(buildApp())
      .post('/api/anchors')
      .send({ ...VALID_CREATE_BODY, baseSigilSvg: undefined });

    expect(res.status).toBe(400);
  });

  it('returns 400 when distilledLetters is empty', async () => {
    const res = await request(buildApp())
      .post('/api/anchors')
      .send({ ...VALID_CREATE_BODY, distilledLetters: [] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when baseSigilSvg exceeds 5 MB', async () => {
    const res = await request(buildApp())
      .post('/api/anchors')
      .send({ ...VALID_CREATE_BODY, baseSigilSvg: 'x'.repeat(5_000_001) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found in database', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 500 on unexpected database error', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.create as jest.Mock).mockRejectedValue(new Error('DB crash'));

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('CREATE_ERROR');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/anchors
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/anchors', () => {
  it('returns 200 with anchors array', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([MOCK_ANCHOR]);

    const res = await request(buildApp()).get('/api/anchors');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('applies category filter when provided', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?category=healing');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ category: 'healing' }) })
    );
  });

  it('applies isCharged filter when provided', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?isCharged=true');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isCharged: true }) })
    );
  });

  it('caps limit at 100', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?limit=9999');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('ignores negative limit values', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?limit=-5');

    const call = (mockPrisma.anchor.findMany as jest.Mock).mock.calls[0][0];
    expect(call.take).toBeUndefined();
  });

  it('ignores NaN limit values', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?limit=abc');

    const call = (mockPrisma.anchor.findMany as jest.Mock).mock.calls[0][0];
    expect(call.take).toBeUndefined();
  });

  it('defaults orderBy to updatedAt for unknown column', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?orderBy=DROP+TABLE');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { updatedAt: 'desc' } })
    );
  });

  it('accepts whitelisted orderBy values', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?orderBy=createdAt&order=asc');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } })
    );
  });

  it('returns 404 when user not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).get('/api/anchors');

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/anchors/:id
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/anchors/:id', () => {
  it('returns 200 with anchor + activations + charges', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      activations: [],
      charges: [],
    });

    const res = await request(buildApp()).get('/api/anchors/anchor-1');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('anchor-1');
  });

  it('returns 404 when anchor not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).get('/api/anchors/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ANCHOR_NOT_FOUND');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/anchors/:id
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/anchors/:id', () => {
  it('updates allowed fields and returns 200', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      intentionText: 'Updated intention',
    });

    const res = await request(buildApp())
      .put('/api/anchors/anchor-1')
      .send({ intentionText: 'Updated intention' });

    expect(res.status).toBe(200);
    expect(res.body.data.intentionText).toBe('Updated intention');
  });

  it('returns 400 when intentionText exceeds max length', async () => {
    const res = await request(buildApp())
      .put('/api/anchors/anchor-1')
      .send({ intentionText: 'x'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when reinforcedSigilSvg exceeds 5 MB', async () => {
    const res = await request(buildApp())
      .put('/api/anchors/anchor-1')
      .send({ reinforcedSigilSvg: 'x'.repeat(5_000_001) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when anchor not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .put('/api/anchors/nonexistent')
      .send({ intentionText: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ANCHOR_NOT_FOUND');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/anchors/:id
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/anchors/:id', () => {
  it('archives the anchor and returns 200', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      isArchived: true,
    });

    const res = await request(buildApp()).delete('/api/anchors/anchor-1');

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Anchor archived successfully');
    expect(mockPrisma.anchor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isArchived: true }) })
    );
  });

  it('returns 404 when anchor not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).delete('/api/anchors/nonexistent');

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/anchors/:id/charge
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/anchors/:id/charge', () => {
  const VALID_CHARGE_BODY = { chargeType: 'initial_deep', durationSeconds: 120 };

  it('creates charge record and returns updated anchor', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.charge.create as jest.Mock).mockResolvedValue({});
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      isCharged: true,
    });

    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/charge')
      .send(VALID_CHARGE_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.isCharged).toBe(true);
    expect(mockPrisma.charge.create).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when chargeType is invalid', async () => {
    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/charge')
      .send({ chargeType: 'invalid', durationSeconds: 60 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when durationSeconds is missing', async () => {
    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/charge')
      .send({ chargeType: 'initial_quick' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when anchor not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/anchors/nonexistent/charge')
      .send(VALID_CHARGE_BODY);

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/anchors/:id/activate
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/anchors/:id/activate', () => {
  const VALID_ACTIVATE_BODY = { activationType: 'visual', durationSeconds: 30 };

  it('records activation and increments activationCount', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.activation.create as jest.Mock).mockResolvedValue({});
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      activationCount: 1,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);

    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/activate')
      .send(VALID_ACTIVATE_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.activationCount).toBe(1);
    expect(mockPrisma.activation.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalActivations: { increment: 1 } }),
      })
    );
  });

  it('returns 400 when activationType is invalid', async () => {
    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/activate')
      .send({ activationType: 'unknown', durationSeconds: 30 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when durationSeconds is zero', async () => {
    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/activate')
      .send({ activationType: 'mantra', durationSeconds: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 404 when anchor not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/anchors/nonexistent/activate')
      .send(VALID_ACTIVATE_BODY);

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/anchors/:id/burn
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/anchors/:id/burn', () => {
  it('burns anchor atomically and returns { burned: true }', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const res = await request(buildApp()).post('/api/anchors/anchor-1/burn');

    expect(res.status).toBe(200);
    expect(res.body.data.burned).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when anchor is already archived', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      isArchived: true,
    });

    const res = await request(buildApp()).post('/api/anchors/anchor-1/burn');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ALREADY_ARCHIVED');
  });

  it('returns 404 when anchor not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).post('/api/anchors/nonexistent/burn');

    expect(res.status).toBe(404);
  });

  it('returns 500 when transaction fails', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.$transaction as jest.Mock).mockRejectedValue(new Error('TX failed'));

    const res = await request(buildApp()).post('/api/anchors/anchor-1/burn');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('BURN_ERROR');
  });
});
