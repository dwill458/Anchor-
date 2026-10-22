import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { errorHandler } from '../../../middleware/errorHandler';

jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'auth-user-1', emailVerified: true };
    req.dbUser = { id: 'db-user-1' };
    next();
  },
}));

const mockVisionService = { createAsset: jest.fn() };
const mockUploadImageAssetFromBuffer = jest.fn();
const mockExtend = jest.fn();
const mockGetAccess = jest.fn();

jest.mock('../../../../services/v2/VisionService', () => ({ visionService: mockVisionService }));
jest.mock('../../../../services/StorageService', () => ({ uploadImageAssetFromBuffer: mockUploadImageAssetFromBuffer }));
jest.mock('../../../../services/MonetizationAccessService', () => ({
  ...jest.requireActual('../../../../services/MonetizationAccessService'),
  getMonetizationAccess: (...args: unknown[]) => mockGetAccess(...args),
}));
jest.mock('../../../../services/GeminiImageService', () => ({
  ...jest.requireActual('../../../../services/GeminiImageService'),
  GeminiImageService: jest.fn(() => ({ extendVisionPhoto: mockExtend })),
}));

import v2Router from '../index';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/v2', v2Router);
app.use(errorHandler);

const photo = async (width: number, height: number) =>
  (await sharp({ create: { width, height, channels: 3, background: '#cc3333' } }).jpeg().toBuffer()).toString('base64');
const generated = () => sharp({ create: { width: 450, height: 800, channels: 3, background: '#3333cc' } }).png().toBuffer();

describe('POST /api/v2/vision/photo-expand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccess.mockResolvedValue({ hasProAccess: true });
    mockExtend.mockImplementation(generated);
  });

  it('returns a 9:16 preview of the expanded photo and stores nothing', async () => {
    const res = await request(app)
      .post('/api/v2/vision/photo-expand')
      .send({ base64Image: await photo(400, 400), mimeType: 'image/jpeg' })
      .expect(200);

    expect(res.body.data.aiExpanded).toBe(true);
    expect(res.body.data.imageBase64).toMatch(/^data:image\/jpeg;base64,/);
    const meta = await sharp(Buffer.from(res.body.data.imageBase64.split(',')[1], 'base64')).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(9 / 16, 2);
    expect(mockExtend).toHaveBeenCalledTimes(1);
    expect(mockUploadImageAssetFromBuffer).not.toHaveBeenCalled();
    expect(mockVisionService.createAsset).not.toHaveBeenCalled();
  });

  it('requires the same access as image generation and never calls the model without it', async () => {
    mockGetAccess.mockResolvedValue({ hasProAccess: false });
    const res = await request(app)
      .post('/api/v2/vision/photo-expand')
      .send({ base64Image: await photo(400, 400), mimeType: 'image/jpeg' })
      .expect(403);
    expect(res.body.error?.code ?? res.body.code).toBe('VISION_PREMIUM_REQUIRED');
    expect(mockExtend).not.toHaveBeenCalled();
  });

  it('declines a photo that already fits, and one too far from the frame, without calling the model', async () => {
    const fits = await request(app).post('/api/v2/vision/photo-expand').send({ base64Image: await photo(540, 960), mimeType: 'image/jpeg' }).expect(422);
    expect(JSON.stringify(fits.body)).toContain('VISION_PHOTO_EXPAND_NOT_NEEDED');
    const wide = await request(app).post('/api/v2/vision/photo-expand').send({ base64Image: await photo(2000, 400), mimeType: 'image/jpeg' }).expect(422);
    expect(JSON.stringify(wide.body)).toContain('VISION_PHOTO_EXPAND_TOO_WIDE');
    expect(mockExtend).not.toHaveBeenCalled();
  });

  it('rejects malformed or mislabeled images and unknown fields', async () => {
    await request(app).post('/api/v2/vision/photo-expand').send({ base64Image: 'not base64', mimeType: 'image/jpeg' }).expect(400);
    await request(app).post('/api/v2/vision/photo-expand').send({ base64Image: await photo(400, 400), mimeType: 'image/jpeg', storageKey: 'x' }).expect(400);
    expect(mockExtend).not.toHaveBeenCalled();
  });

  it('reports a provider failure without storing anything', async () => {
    mockExtend.mockRejectedValue(new Error('provider down'));
    const res = await request(app).post('/api/v2/vision/photo-expand').send({ base64Image: await photo(400, 400), mimeType: 'image/jpeg' });
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(mockUploadImageAssetFromBuffer).not.toHaveBeenCalled();
    expect(mockVisionService.createAsset).not.toHaveBeenCalled();
  });
});
