import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { ApiClientError, apiClient } from '@/services/ApiClient';
import { cropPhoto, discardTemporaryPhoto, isFitTemporaryFile, requestPhotoExpansion } from '../visionPhotoFitProcessing';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(),
}));
jest.mock('@/services/ApiClient', () => {
  class ApiClientError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, status?: number, code?: string) { super(message); this.status = status; this.code = code; }
  }
  return { apiClient: { post: jest.fn() }, ApiClientError };
});

const manipulate = ImageManipulator.manipulateAsync as jest.Mock;
const post = apiClient.post as jest.Mock;
const photo = { uri: 'file:///picker/original.jpg', mimeType: 'image/jpeg' };

describe('cropPhoto', () => {
  it('crops to the chosen rectangle into a new file and leaves the original untouched', async () => {
    manipulate.mockResolvedValue({ uri: 'file:///cache/ImageManipulator/crop.jpg' });
    const result = await cropPhoto(photo.uri, { originX: 10, originY: 0, width: 900, height: 1600 });
    expect(manipulate).toHaveBeenCalledWith(photo.uri, [{ crop: { originX: 10, originY: 0, width: 900, height: 1600 } }], expect.objectContaining({ format: 'jpeg' }));
    expect(result).toEqual({ uri: 'file:///cache/ImageManipulator/crop.jpg', mimeType: 'image/jpeg' });
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});

describe('requestPhotoExpansion', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('sends a downscaled copy, stores only a cache preview, and cleans the scratch copy', async () => {
    manipulate.mockResolvedValue({ uri: 'file:///cache/ImageManipulator/small.jpg', base64: 'AAAA' });
    post.mockResolvedValue({ data: { success: true, data: { imageBase64: 'data:image/jpeg;base64,QkJCQg==' } } });
    const result = await requestPhotoExpansion(photo, { width: 4000, height: 3000 });
    expect(manipulate).toHaveBeenCalledWith(photo.uri, [{ resize: { width: 1600 } }], expect.objectContaining({ base64: true }));
    expect(post).toHaveBeenCalledWith('/api/v2/vision/photo-expand', { base64Image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' }, { signal: undefined, timeout: 180_000 });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/vision-expanded-\d+\.jpg$/), 'QkJCQg==', { encoding: 'base64' });
    expect(result.ok && result.photo.uri).toMatch(/vision-expanded-/);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/ImageManipulator/small.jpg', { idempotent: true });
    expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(photo.uri, expect.anything());
  });

  it('does not resize a photo that is already small, and resizes portrait photos by height', async () => {
    manipulate.mockResolvedValue({ uri: 'file:///cache/ImageManipulator/a.jpg', base64: 'AAAA' });
    post.mockResolvedValue({ data: { data: { imageBase64: 'QQ==' } } });
    await requestPhotoExpansion(photo, { width: 800, height: 800 });
    expect(manipulate.mock.calls[0][1]).toEqual([]);
    await requestPhotoExpansion(photo, { width: 3000, height: 4000 });
    expect(manipulate.mock.calls[1][1]).toEqual([{ resize: { height: 1600 } }]);
  });

  it('reports failures plainly and keeps the original available', async () => {
    manipulate.mockResolvedValue({ uri: 'file:///cache/ImageManipulator/a.jpg', base64: 'AAAA' });
    post.mockRejectedValue(new Error('network'));
    const failed = await requestPhotoExpansion(photo, { width: 2000, height: 2000 });
    expect(failed).toEqual({ ok: false, message: expect.stringMatching(/keep or crop your original/) });
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    post.mockRejectedValue(new (ApiClientError as any)('too wide', 422, 'VISION_PHOTO_EXPAND_TOO_WIDE'));
    expect(await requestPhotoExpansion(photo, { width: 2000, height: 2000 })).toEqual({ ok: false, message: expect.stringMatching(/Try cropping/) });
  });

  it('surfaces the Pro requirement so the paywall can open', async () => {
    manipulate.mockResolvedValue({ uri: 'file:///cache/ImageManipulator/a.jpg', base64: 'AAAA' });
    post.mockRejectedValue(new (ApiClientError as any)('pro', 403, 'VISION_PREMIUM_REQUIRED'));
    expect(await requestPhotoExpansion(photo, { width: 2000, height: 2000 })).toMatchObject({ ok: false, premiumRequired: true });
  });

  it('treats an empty server result as a failure and writes nothing', async () => {
    manipulate.mockResolvedValue({ uri: 'file:///cache/ImageManipulator/a.jpg', base64: 'AAAA' });
    post.mockResolvedValue({ data: { data: {} } });
    expect((await requestPhotoExpansion(photo, { width: 2000, height: 2000 })).ok).toBe(false);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });
});

describe('discardTemporaryPhoto', () => {
  beforeEach(() => jest.clearAllMocks());
  it('deletes only files this flow created', async () => {
    expect(isFitTemporaryFile('file:///cache/ImageManipulator/x.jpg')).toBe(true);
    expect(isFitTemporaryFile('file:///cache/vision-expanded-123.jpg')).toBe(true);
    expect(isFitTemporaryFile('file:///cache/ImagePicker/original.jpg')).toBe(false);
    await discardTemporaryPhoto('file:///cache/ImagePicker/original.jpg');
    await discardTemporaryPhoto(null);
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    await discardTemporaryPhoto('file:///cache/vision-expanded-123.jpg');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/vision-expanded-123.jpg', { idempotent: true });
  });
});
