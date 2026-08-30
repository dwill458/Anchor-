import express, { Application } from 'express';
import request from 'supertest';

jest.mock('../../middleware/auth');
jest.mock('../../../config/env', () => ({
  env: {
    ENABLE_MERCH: true,
  },
}));
jest.mock('../../../utils/svgRasterizer', () => ({
  rasterizeSVG: jest.fn().mockResolvedValue({
    buffer: Buffer.from('mock-png'),
    width: 2048,
    height: 2048,
    size: 8,
    processingTimeMs: 1,
  }),
}));
jest.mock('../../../services/StorageService', () => ({
  uploadImageAssetFromBuffer: jest.fn().mockResolvedValue({
    url: 'https://cdn.example.com/mock.png',
    externalUrl: 'https://signed.example.com/mock.png',
    objectKey: 'anchors/db-user-1/anchor-1/mock.png',
  }),
}));
jest.mock('../../../services/PrintfulService', () => ({
  createPrintfulMockupPreview: jest.fn().mockResolvedValue({
    previewUrl: 'https://printful.example.com/mockup.jpg',
  }),
}));

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    anchor: {
      findFirst: jest.fn(),
    },
  },
}));

import merchRouter from '../merch';
import { errorHandler } from '../../middleware/errorHandler';
import { env } from '../../../config/env';
import { authMiddleware } from '../../middleware/auth';
import { prisma } from '../../../lib/prisma';
import { rasterizeSVG } from '../../../utils/svgRasterizer';
import { uploadImageAssetFromBuffer } from '../../../services/StorageService';
import { createPrintfulMockupPreview } from '../../../services/PrintfulService';

const mockedAuthMiddleware = authMiddleware as jest.Mock;
const mockPrismaInstance = prisma as unknown as {
  user: { findUnique: jest.Mock };
  anchor: { findFirst: jest.Mock };
};
const mockedRasterizeSVG = rasterizeSVG as jest.Mock;
const mockedUploadImageAssetFromBuffer = uploadImageAssetFromBuffer as jest.Mock;
const mockedCreatePrintfulMockupPreview = createPrintfulMockupPreview as jest.Mock;

const MOCK_AUTH_USER = { uid: 'firebase-uid-1', email: 'user@example.com' };
const MOCK_DB_USER = { id: 'db-user-1', authUid: 'firebase-uid-1', email: 'user@example.com' };
const MOCK_ANCHOR = {
  id: 'anchor-1',
  userId: 'db-user-1',
  baseSigilSvg: '<svg/>',
  reinforcedSigilSvg: null,
};

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/merch', merchRouter);
  app.use(errorHandler);
  return app;
}

describe('GET /api/merch/products', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
  });

  it('returns the merch catalog', async () => {
    const res = await request(app).get('/api/merch/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.printfulMappingActive).toBe(env.ENABLE_MERCH);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products).toHaveLength(3);
    expect(res.body.data.products.map((product: { type: string }) => product.type)).toEqual([
      'print',
      'phone-case',
      'desk-mat',
    ]);
  });
});

describe('POST /api/merch/preview', () => {
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
  });

  it('returns a printful preview URL for the requested product', async () => {
    const res = await request(app).post('/api/merch/preview').send({
      anchorId: 'anchor-1',
      sigilSvg: '<svg viewBox="0 0 100 100"></svg>',
      productType: 'desk-mat',
      size: '12x18',
      color: 'Black',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.previewUrl).toBe('https://printful.example.com/mockup.jpg');
    expect(mockedRasterizeSVG).toHaveBeenCalledWith(
      '<svg viewBox="0 0 100 100"></svg>',
      expect.objectContaining({
        width: 2048,
        height: 2048,
        backgroundColor: 'transparent',
      })
    );
    expect(mockedUploadImageAssetFromBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      'db-user-1',
      'anchor-1',
      0,
      expect.objectContaining({
        signedUrlExpiresIn: 3600,
      })
    );
    expect(mockedCreatePrintfulMockupPreview).toHaveBeenCalledWith({
      productType: 'desk-mat',
      size: '12x18',
      color: 'Black',
      artworkUrl: 'https://signed.example.com/mock.png',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockedAuthMiddleware.mockImplementation((_req: any, _res: any, next: any) => {
      next();
    });

    const res = await request(app).post('/api/merch/preview').send({
      anchorId: 'anchor-1',
      productType: 'print',
    });

    expect(res.status).toBe(401);
  });

  it('returns 404 when the anchor is not found', async () => {
    mockPrismaInstance.anchor.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/merch/preview').send({
      anchorId: 'anchor-1',
      productType: 'print',
    });

    expect(res.status).toBe(404);
  });
});
