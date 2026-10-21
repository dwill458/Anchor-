import sharp from 'sharp';

const mockUpload = jest.fn(async () => ({ objectKey: 'u1/ask-chart-photos/abc.jpg', url: 'x' }));
const mockDeleteObject = jest.fn(async () => undefined);
jest.mock('../../../StorageService', () => ({
  uploadImageAssetFromBuffer: (...args: unknown[]) => (mockUpload as (...a: unknown[]) => unknown)(...args),
  deletePrivateImageAsset: (...args: unknown[]) => (mockDeleteObject as (...a: unknown[]) => unknown)(...args),
}));
const mockPrisma = {
  asset: {
    create: jest.fn(async (_args: any) => ({ id: 'asset-1' })),
    findMany: jest.fn(),
    deleteMany: jest.fn(async (_args: any) => ({ count: 1 })),
  },
};
jest.mock('../../../../lib/prisma', () => ({ prisma: mockPrisma }));

import { decodeAskPhoto, deleteAskPhotos, normalizeAskPhoto, PHOTO_TTL_MS, purgeExpiredAskPhotos, storeAskPhoto } from '../askChartPhotos';

const image = (width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'png', metadata = false) => {
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 80, b: 40 } } });
  if (metadata) pipeline = pipeline.withExif({ IFD0: { Copyright: 'Someone Private', Software: 'PhoneCam 9' } });
  return pipeline[format]().toBuffer();
};

beforeEach(() => jest.clearAllMocks());

describe('decodeAskPhoto', () => {
  it('accepts raw base64 and data URLs and returns the bytes', () => {
    const bytes = Buffer.from('hello world!');
    expect(decodeAskPhoto(bytes.toString('base64'), 'image/png').equals(bytes)).toBe(true);
    expect(decodeAskPhoto(`data:image/jpeg;base64,${bytes.toString('base64')}`, 'image/jpeg').equals(bytes)).toBe(true);
  });

  it('rejects mismatched, malformed and oversize input', () => {
    const b64 = Buffer.from('hello world!').toString('base64');
    expect(() => decodeAskPhoto(`data:image/png;base64,${b64}`, 'image/jpeg')).toThrow('does not match');
    expect(() => decodeAskPhoto('***', 'image/png')).toThrow('malformed');
    expect(() => decodeAskPhoto(Buffer.alloc(6 * 1024 * 1024 + 1).toString('base64'), 'image/png')).toThrow('larger than 6 MB');
  });
});

describe('normalizeAskPhoto', () => {
  it('re-encodes to JPEG, caps the long edge and never enlarges a small photo', async () => {
    const big = await normalizeAskPhoto(await image(3200, 2000), 'image/png');
    expect(Math.max(big.width, big.height)).toBe(1600);
    expect(big.height).toBe(1000);
    expect((await sharp(big.data).metadata()).format).toBe('jpeg');
    const small = await normalizeAskPhoto(await image(400, 300, 'webp'), 'image/webp');
    expect([small.width, small.height]).toEqual([400, 300]);
  });

  it('drops camera and location metadata', async () => {
    const withExif = await image(800, 600, 'jpeg', true);
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const cleaned = await normalizeAskPhoto(withExif, 'image/jpeg');
    expect((await sharp(cleaned.data).metadata()).exif).toBeUndefined();
  });

  it('rejects a file that is not the format it claims, or not an image at all', async () => {
    await expect(normalizeAskPhoto(await image(100, 100, 'png'), 'image/jpeg')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(normalizeAskPhoto(Buffer.from('not an image'), 'image/png')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('storeAskPhoto', () => {
  it('stores a private JPEG tagged as an Ask Chart photo and returns only its id', async () => {
    const png = await image(2000, 1000);
    const result = await storeAskPhoto('user-1', 'anchor-1', png.toString('base64'), 'image/png');
    expect(result).toMatchObject({ assetId: 'asset-1', width: 1600, height: 800 });
    expect(mockUpload).toHaveBeenCalledWith(expect.any(Buffer), 'user-1', 'ask-chart-photos', 0, { visibility: 'private', contentType: 'image/jpeg' });
    expect(mockPrisma.asset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', mimeType: 'image/jpeg', metadata: expect.objectContaining({ purpose: 'ask-chart', anchorId: 'anchor-1' }) }),
    }));
  });

  it('stores nothing for an invalid photo', async () => {
    await expect(storeAskPhoto('user-1', 'anchor-1', Buffer.from('nope!').toString('base64'), 'image/png')).rejects.toBeDefined();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });
});

describe('retention', () => {
  it('deletes only Ask Chart photos older than the lifetime, object first, then the row', async () => {
    mockPrisma.asset.findMany.mockResolvedValue([{ id: 'a1', storageKey: 'k1' }, { id: 'a2', storageKey: 'k2' }]);
    const now = new Date('2026-10-22T12:00:00Z');
    expect(await purgeExpiredAskPhotos({ now, userId: 'user-1' })).toBe(2);
    const where = mockPrisma.asset.findMany.mock.calls[0][0].where;
    expect(where.createdAt.lt.getTime()).toBe(now.getTime() - PHOTO_TTL_MS);
    expect(where.metadata).toEqual({ path: ['purpose'], equals: 'ask-chart' });
    expect(where.userId).toBe('user-1');
    expect(mockDeleteObject.mock.calls.map(call => (call as unknown[])[0])).toEqual(['k1', 'k2']);
    // Assets that Vision (or anything else) still references are never deleted.
    expect(mockPrisma.asset.deleteMany.mock.calls[0][0].where).toMatchObject({ visionScenes: { none: {} }, visionCandidates: { none: {} } });
  });

  it('deleteAskPhotos only touches the caller’s own Ask Chart photos', async () => {
    mockPrisma.asset.findMany.mockResolvedValue([{ id: 'a1', storageKey: 'k1' }]);
    await deleteAskPhotos('user-1', ['a1', 'a2']);
    expect(mockPrisma.asset.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['a1', 'a2'] }, userId: 'user-1', metadata: { path: ['purpose'], equals: 'ask-chart' } });
    mockPrisma.asset.findMany.mockClear();
    expect(await deleteAskPhotos('user-1', [])).toBe(0);
    expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
  });
});
