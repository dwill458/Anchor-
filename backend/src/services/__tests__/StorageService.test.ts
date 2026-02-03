import axios from 'axios';
import fs from 'fs';
import {
  uploadImageFromBuffer,
  uploadImageFromUrl,
  uploadAudio,
  deleteAnchorFiles,
  getSignedUrl,
  StorageService,
} from '../StorageService';

// Use var to avoid TDZ issues with jest.mock hoisting.
var sendMock: jest.Mock;
var uploadDoneMock: jest.Mock;

jest.mock('axios');
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('@aws-sdk/client-s3', () => {
  sendMock = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ params })),
  };
});
jest.mock('@aws-sdk/lib-storage', () => {
  uploadDoneMock = jest.fn();
  return {
    Upload: jest.fn().mockImplementation(() => ({ done: uploadDoneMock })),
  };
});
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('StorageService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    sendMock.mockReset();
    uploadDoneMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uploads image buffer to local storage and returns local URL', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockImplementation(() => undefined as any);
    mockedFs.writeFileSync.mockImplementation(() => undefined as any);
    process.env.LOCAL_IP = '127.0.0.1';
    process.env.PORT = '9000';

    const result = await uploadImageFromBuffer(
      Buffer.from('image'),
      'user-1',
      'anchor-1',
      0
    );

    expect(mockedFs.mkdirSync).toHaveBeenCalled();
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    expect(result).toBe('http://127.0.0.1:9000/uploads/anchor-1-0.png');
  });

  it('throws when uploadImageFromBuffer fails to write', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.writeFileSync.mockImplementation(() => {
      throw new Error('disk full');
    });

    await expect(
      uploadImageFromBuffer(Buffer.from('image'), 'user-1', 'anchor-1', 1)
    ).rejects.toThrow('Failed to upload image from buffer');
  });

  it('downloads from URL and stores locally', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.writeFileSync.mockImplementation(() => undefined as any);
    mockedAxios.get.mockResolvedValue({ data: Buffer.from('remote') });
    process.env.LOCAL_IP = '10.0.0.1';
    process.env.PORT = '8000';

    const result = await uploadImageFromUrl(
      'https://example.com/image.png',
      'user-1',
      'anchor-2',
      2
    );

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com/image.png',
      { responseType: 'arraybuffer' }
    );
    expect(result).toBe('http://10.0.0.1:8000/uploads/anchor-2-2.png');
  });

  it('falls back to original URL when download fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network'));

    const result = await uploadImageFromUrl(
      'https://example.com/bad.png',
      'user-1',
      'anchor-3',
      0
    );

    expect(result).toBe('https://example.com/bad.png');
  });

  it('uploads audio to R2 and returns public URL when configured', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'key';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret';
    process.env.CLOUDFLARE_R2_BUCKET_NAME = 'bucket';
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://cdn.example.com';
    uploadDoneMock.mockResolvedValue(undefined);

    const result = await uploadAudio(
      Buffer.from('audio'),
      'user-1',
      'anchor-1',
      'syllabic'
    );

    expect(uploadDoneMock).toHaveBeenCalled();
    expect(result).toBe('https://cdn.example.com/mantras/user-1/anchor-1/syllabic.mp3');
  });

  it('throws when audio upload fails', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'key';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret';
    process.env.CLOUDFLARE_R2_BUCKET_NAME = 'bucket';
    uploadDoneMock.mockRejectedValue(new Error('upload error'));

    await expect(
      uploadAudio(Buffer.from('audio'), 'user-1', 'anchor-1', 'phonetic')
    ).rejects.toThrow('Failed to upload audio');
  });

  it('deletes anchor files when R2 is configured', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'key';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret';
    process.env.CLOUDFLARE_R2_BUCKET_NAME = 'bucket';
    sendMock.mockResolvedValue(undefined);

    await deleteAnchorFiles('user-1', 'anchor-1');

    expect(sendMock).toHaveBeenCalledTimes(12);
  });

  it('handles deleteAnchorFiles failures gracefully', async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

    await expect(deleteAnchorFiles('user-1', 'anchor-1')).resolves.toBeUndefined();
  });

  it('returns signed URL using public domain when configured', async () => {
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://cdn.example.com';

    const url = await getSignedUrl('anchors/user-1/anchor-1/variation-0.png');

    expect(url).toBe('https://cdn.example.com/anchors/user-1/anchor-1/variation-0.png');
  });

  it('returns signed URL using bucket domain when public domain missing', async () => {
    process.env.CLOUDFLARE_R2_BUCKET_NAME = 'bucket';
    delete process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;

    const url = await getSignedUrl('anchors/user-1/anchor-1/variation-0.png');

    expect(url).toBe('https://bucket.r2.cloudflarestorage.com/anchors/user-1/anchor-1/variation-0.png');
  });

  it('StorageService.uploadImage derives anchorId and index from filename', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.writeFileSync.mockImplementation(() => undefined as any);
    process.env.LOCAL_IP = '127.0.0.1';
    process.env.PORT = '8000';

    const storage = new StorageService();
    const url = await storage.uploadImage(Buffer.from('image'), 'anchor-42-3.png');

    expect(url).toBe('http://127.0.0.1:8000/uploads/42-3.png');
  });
});
