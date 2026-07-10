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
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  charge: { create: jest.fn() },
  activation: { create: jest.fn() },
  burnedAnchor: { create: jest.fn() },
  anchorVariationPool: {
    updateMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

jest.mock('../../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

const mockResolveStoredAssetUrl = jest.fn();
jest.mock('../../../services/StorageService', () => ({
  resolveStoredAssetUrl: (...args: unknown[]) => mockResolveStoredAssetUrl(...args),
}));

const mockGetRevenueCatAccess = jest.fn();
jest.mock('../../../services/RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: (...args: unknown[]) => mockGetRevenueCatAccess(...args),
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
const MOCK_DB_USER = {
  id: 'db-user-1',
  authUid: 'firebase-uid-1',
  email: 'test@example.com',
  subscriptionStatus: 'free',
  isComped: false,
  trialStartedAt: new Date(),
};

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
  chargeCount: 0,
  chargedAt: null,
  firstChargedAt: null,
  ignitedAt: null,
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
  mockResolveStoredAssetUrl.mockImplementation(async (url: string | null | undefined) => url);

  // Default: auth passes and attaches mock user
  mockedAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
    req.user = MOCK_USER_AUTH;
    next();
  });

  (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
    if (typeof callback === 'function') {
      return callback(mockPrisma);
    }
    return callback;
  });
  (mockPrisma.anchor.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  (mockPrisma.anchor.count as jest.Mock).mockResolvedValue(0);
  (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
  (mockPrisma.anchorVariationPool.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  mockGetRevenueCatAccess.mockResolvedValue(null);
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

  it('returns 403 when an expired Free user creates an anchor', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      trialStartedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CREATE_ANCHOR_FREE_LOCKED');
    expect(mockPrisma.anchor.create).not.toHaveBeenCalled();
  });

  it('returns 403 when a trial user has created 7 trial anchors', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.count as jest.Mock).mockResolvedValue(7);

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TRIAL_ANCHOR_CAP_REACHED');
    expect(mockPrisma.anchor.create).not.toHaveBeenCalled();
  });

  it('returns 429 when a paid Pro user has created 10 anchors today', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_DB_USER,
      subscriptionStatus: 'pro',
    });
    (mockPrisma.anchor.count as jest.Mock).mockResolvedValue(10);

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('PRO_DAILY_ANCHOR_CAP_REACHED');
    expect(mockPrisma.anchor.create).not.toHaveBeenCalled();
  });

  it('syncs active RevenueCat access before applying paid Pro limits', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.create as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: true,
      productIdentifier: 'anchor_pro_annual',
    });

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(201);
    expect(mockPrisma.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: MOCK_DB_USER.id },
      data: {
        subscriptionStatus: 'pro',
        subscriptionId: 'anchor_pro_annual',
      },
    });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on unexpected database error', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.create as jest.Mock).mockRejectedValue(new Error('DB crash'));

    const res = await request(buildApp()).post('/api/anchors').send(VALID_CREATE_BODY);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('CREATE_ERROR');
  });

  it('consumes the selected pooled variation and releases the rest of the reservation set', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.create as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchorVariationPool.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });

    const res = await request(buildApp())
      .post('/api/anchors')
      .send({
        ...VALID_CREATE_BODY,
        enhancedImageUrl: 'http://localhost:8000/variation.png',
        enhancementMetadata: {
          styleApplied: 'watercolor',
          modelUsed: 'gemini-3.1-flash-image-preview',
          controlMethod: 'lineart',
          generationTimeMs: 1200,
          promptUsed: 'prompt',
          negativePrompt: 'negative',
          appliedAt: new Date().toISOString(),
          variationId: 'pool-variation-1',
          reuseRequestId: 'reuse-request-1',
        },
      });

    expect(res.status).toBe(201);
    expect(mockPrisma.anchorVariationPool.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'pool-variation-1',
          reservedByRequestId: 'reuse-request-1',
          status: 'reserved',
        }),
        data: expect.objectContaining({
          status: 'consumed',
          selectedByAnchorId: 'anchor-1',
        }),
      })
    );
    expect(mockPrisma.anchorVariationPool.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          reservedByRequestId: 'reuse-request-1',
          status: 'reserved',
        }),
        data: expect.objectContaining({
          status: 'available',
        }),
      })
    );
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

  it('re-signs stored enhanced artwork URLs before returning them to the client', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([
      {
        ...MOCK_ANCHOR,
        enhancedImageUrl: 'https://cdn.example.com/anchors/db-user-1/anchor-1/mock.png',
      },
    ]);
    mockResolveStoredAssetUrl.mockResolvedValueOnce(
      'https://signed.example.com/anchors/db-user-1/anchor-1/mock.png'
    );

    const res = await request(buildApp()).get('/api/anchors');

    expect(res.status).toBe(200);
    expect(res.body.data[0].enhancedImageUrl).toBe(
      'https://signed.example.com/anchors/db-user-1/anchor-1/mock.png'
    );
    expect(mockResolveStoredAssetUrl).toHaveBeenCalledWith(
      'https://cdn.example.com/anchors/db-user-1/anchor-1/mock.png',
      7 * 24 * 60 * 60
    );
  });

  it('selects only the supported anchor fields for list hydration', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([MOCK_ANCHOR]);

    await request(buildApp()).get('/api/anchors');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          userId: true,
          intentionText: true,
          category: true,
          baseSigilSvg: true,
          reinforcedSigilSvg: true,
          enhancedImageUrl: true,
          structureVariant: true,
          enhancementMetadata: true,
          lastActivatedAt: true,
        }),
      })
    );
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

  it('ignores negative limit values and falls back to default 20', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?limit=-5');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
  });

  it('ignores NaN limit values and falls back to default 20', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findMany as jest.Mock).mockResolvedValue([]);

    await request(buildApp()).get('/api/anchors?limit=abc');

    expect(mockPrisma.anchor.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
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
    (mockPrisma.anchor.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.anchor.findUnique as jest.Mock).mockResolvedValue({
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
    (mockPrisma.anchor.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

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
    (mockPrisma.anchor.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await request(buildApp()).delete('/api/anchors/anchor-1');

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Anchor archived successfully');
    expect(mockPrisma.anchor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isArchived: true }) })
    );
  });

  it('returns 404 when anchor not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

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
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      isCharged: true,
      chargeCount: 1,
    });

    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/charge')
      .send(VALID_CHARGE_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.isCharged).toBe(true);
    expect(mockPrisma.charge.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.anchor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chargeCount: { increment: 1 },
          firstChargedAt: expect.any(Date),
        }),
      })
    );
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

  it('records activation and increments activationCount (subsequent activation)', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    // Mock anchor that is already charged
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      isCharged: true,
      chargeCount: 1,
    });
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      isCharged: true,
      chargeCount: 1,
      activationCount: 1,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);

    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/activate')
      .send(VALID_ACTIVATE_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.activationCount).toBe(1);
    expect(mockPrisma.activation.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.charge.create).not.toHaveBeenCalled();
    expect(mockPrisma.anchor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'anchor-1',
          userId: MOCK_DB_USER.id,
          isCharged: false,
          firstChargedAt: null,
          chargeCount: 0,
          activationCount: 0,
        }),
      })
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalActivations: { increment: 1 } }),
      })
    );
    expect(mockPrisma.anchor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          activationCount: { increment: 1 },
          lastActivatedAt: expect.any(Date),
        },
      })
    );
  });

  it('charges the anchor on the first activation', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    // Mock anchor that is not yet charged (dormant)
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.anchor.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      isCharged: true,
      chargeCount: 1,
      activationCount: 1,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);

    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/activate')
      .send(VALID_ACTIVATE_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.isCharged).toBe(true);
    expect(res.body.data.chargeCount).toBe(1);
    expect(mockPrisma.activation.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.charge.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.anchor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'anchor-1',
          userId: MOCK_DB_USER.id,
          isCharged: false,
          firstChargedAt: null,
          chargeCount: 0,
          activationCount: 0,
        },
        data: expect.objectContaining({
          isCharged: true,
          chargeCount: { increment: 1 },
          chargedAt: expect.any(Date),
          firstChargedAt: expect.any(Date),
          chargeMethod: 'quick',
        }),
      })
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.anchor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          activationCount: { increment: 1 },
          lastActivatedAt: expect.any(Date),
        },
      })
    );
  });

  it('does not create a duplicate first-prime charge when the conditional transition loses', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(MOCK_ANCHOR);
    (mockPrisma.anchor.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.anchor.update as jest.Mock).mockResolvedValue({
      ...MOCK_ANCHOR,
      activationCount: 1,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue(MOCK_DB_USER);

    const res = await request(buildApp())
      .post('/api/anchors/anchor-1/activate')
      .send(VALID_ACTIVATE_BODY);

    expect(res.status).toBe(200);
    expect(mockPrisma.activation.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.charge.create).not.toHaveBeenCalled();
    expect(mockPrisma.anchor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          activationCount: { increment: 1 },
          lastActivatedAt: expect.any(Date),
        },
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
  it('returns 401 when auth middleware does not attach a user', async () => {
    mockedAuthMiddleware.mockImplementation((_req: any, res: any) => {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided',
        },
      });
    });

    const res = await request(buildApp()).post('/api/anchors/anchor-1/burn');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockPrisma.anchor.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

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

  it("returns 404 when attempting to burn another user's anchor", async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_DB_USER);
    (mockPrisma.anchor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).post('/api/anchors/foreign-anchor/burn');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ANCHOR_NOT_FOUND');
    expect(mockPrisma.anchor.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-anchor', userId: 'db-user-1' },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
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
