/**
 * Unit tests for StorageService
 *
 * Tests cover:
 * - uploadImageFromBuffer (local storage mode)
 * - uploadImageFromUrl (download + delegate)
 * - uploadAudio (R2 mock mode and configured mode)
 * - deleteAnchorFiles
 * - getSignedUrl
 */

import path from 'path';

jest.mock('../../utils/logger');
jest.mock('fs');
jest.mock('axios');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');

import fs from 'fs';
import axios from 'axios';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import {
  uploadImageFromBuffer,
  uploadImageFromUrl,
  uploadAudio,
  deleteAnchorFiles,
  getSignedUrl,
  StorageService,
} from '../StorageService';

describe('StorageService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Remove R2 credentials to ensure mock/local mode by default
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    delete process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // uploadImageFromBuffer
  // ============================================================================

  describe('uploadImageFromBuffer', () => {
    it('should write file to local uploads directory and return URL', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const buffer = Buffer.from('fake-image-data');
      const url = await uploadImageFromBuffer(buffer, 'user-1', 'anchor-1', 0);

      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), buffer);
      const writtenPath = (fs.writeFileSync as jest.Mock).mock.calls[0][0] as string;
      expect(writtenPath).toContain(path.join('anchors', 'user-1', 'anchor-1'));
      expect(writtenPath).toMatch(/-variation-0\.png$/);
      expect(url).toContain('/uploads/anchors/user-1/anchor-1/');
      expect(url).toMatch(/-variation-0\.png$/);
      expect(url).toMatch(/^http:\/\//);
    });

    it('should create uploads directory if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      await uploadImageFromBuffer(Buffer.from('data'), 'user-1', 'anchor-2', 1);

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should use LOCAL_IP and PORT env vars in the returned URL', async () => {
      process.env.LOCAL_IP = '192.168.1.100';
      process.env.PORT = '3000';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const url = await uploadImageFromBuffer(Buffer.from('data'), 'user', 'anchor', 0);

      expect(url).toContain('192.168.1.100:3000');
    });

    it('uses isolated keys for same anchor id across different users', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const urlA = await uploadImageFromBuffer(Buffer.from('data-a'), 'user-a', 'anchor-1', 0);
      const urlB = await uploadImageFromBuffer(Buffer.from('data-b'), 'user-b', 'anchor-1', 0);

      expect(urlA).toContain('/uploads/anchors/user-a/anchor-1/');
      expect(urlB).toContain('/uploads/anchors/user-b/anchor-1/');
      expect(urlA).not.toBe(urlB);
    });

    it('uses unique keys for repeated generation attempts for the same user and anchor', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const url1 = await uploadImageFromBuffer(Buffer.from('attempt-1'), 'user-1', 'anchor-1', 0);
      const url2 = await uploadImageFromBuffer(Buffer.from('attempt-2'), 'user-1', 'anchor-1', 0);

      expect(url1).toContain('/uploads/anchors/user-1/anchor-1/');
      expect(url2).toContain('/uploads/anchors/user-1/anchor-1/');
      expect(url1).not.toBe(url2);
    });

    it('does not overwrite local files when generating the same variation repeatedly', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      await uploadImageFromBuffer(Buffer.from('attempt-1'), 'user-1', 'anchor-1', 1);
      await uploadImageFromBuffer(Buffer.from('attempt-2'), 'user-1', 'anchor-1', 1);

      const firstPath = (fs.writeFileSync as jest.Mock).mock.calls[0][0] as string;
      const secondPath = (fs.writeFileSync as jest.Mock).mock.calls[1][0] as string;
      expect(firstPath).not.toBe(secondPath);
    });

    it('falls back to data URI when fs write fails', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const result = await uploadImageFromBuffer(Buffer.from('data'), 'user', 'anchor', 0);
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('throws in production when R2 is not configured instead of falling back to local storage', async () => {
      process.env.NODE_ENV = 'production';

      await expect(uploadImageFromBuffer(Buffer.from('data'), 'user', 'anchor', 0)).rejects.toThrow(
        'CLOUDFLARE_ACCOUNT_ID'
      );
    });

    it('throws in production when an R2 upload fails instead of returning a fallback URL', async () => {
      process.env.NODE_ENV = 'production';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'access-key';
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret-key';
      process.env.CLOUDFLARE_R2_BUCKET_NAME = 'anchor-assets';
      process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://cdn.example.com';

      (Upload as unknown as jest.Mock).mockImplementation(() => ({
        done: jest.fn().mockRejectedValue(new Error('R2 error')),
      }));

      await expect(uploadImageFromBuffer(Buffer.from('data'), 'user', 'anchor', 0)).rejects.toThrow(
        'R2 error'
      );
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // uploadImageFromUrl
  // ============================================================================

  describe('uploadImageFromUrl', () => {
    it('should download image from URL and upload it', async () => {
      const fakeData = Buffer.from('downloaded-image');
      (axios.get as jest.Mock).mockResolvedValue({ data: fakeData, headers: {} });
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const url = await uploadImageFromUrl(
        'https://example.com/image.png',
        'user-1',
        'anchor-1',
        0
      );

      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com/image.png',
        expect.objectContaining({ responseType: 'arraybuffer' })
      );
      expect(url).toContain('/uploads/anchors/user-1/anchor-1/');
      expect(url).toMatch(/-variation-0\.png$/);
    });

    it('should throw when download fails', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      const originalUrl = 'https://replicate.delivery/image.png';
      await expect(uploadImageFromUrl(originalUrl, 'user-1', 'anchor-1', 0)).rejects.toThrow(
        'Failed to download generated image'
      );
    });
  });

  // ============================================================================
  // uploadAudio
  // ============================================================================

  describe('uploadAudio', () => {
    it('should return local URI when R2 credentials are not set', async () => {
      const buffer = Buffer.from('audio-data');
      const url = await uploadAudio(buffer, 'user-1', 'anchor-1', 'syllabic');

      expect(url).toMatch(/^local:\/\/mantras\//);
      expect(url).toContain('user-1');
      expect(url).toContain('anchor-1');
      expect(url).toContain('syllabic.mp3');
    });

    it('sanitizes audio storage path segments before building the object key', async () => {
      const buffer = Buffer.from('audio-data');
      const url = await uploadAudio(
        buffer,
        '../other-user',
        'anchor/../../victim',
        'phonetic?.mp3'
      );

      expect(url).toBe('local://mantras/-other-user/anchor-victim/phonetic-mp3.mp3');
    });

    it('should upload to R2 and return public domain URL when configured', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'access-key';
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret-key';
      process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://cdn.example.com';

      const mockDone = jest.fn().mockResolvedValue({});
      (Upload as unknown as jest.Mock).mockImplementation(() => ({ done: mockDone }));

      const buffer = Buffer.from('audio-data');
      const url = await uploadAudio(buffer, 'user-1', 'anchor-1', 'syllabic');

      expect(mockDone).toHaveBeenCalled();
      expect(url).toContain('https://cdn.example.com');
      expect(url).toContain('syllabic.mp3');
    });

    it('should throw on R2 upload failure', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'access-key';
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret-key';

      (Upload as unknown as jest.Mock).mockImplementation(() => ({
        done: jest.fn().mockRejectedValue(new Error('R2 error')),
      }));

      await expect(uploadAudio(Buffer.from('audio'), 'user', 'anchor', 'rhythmic')).rejects.toThrow(
        'Failed to upload audio'
      );
    });
  });

  // ============================================================================
  // deleteAnchorFiles
  // ============================================================================

  describe('deleteAnchorFiles', () => {
    it('should not throw when R2 credentials are missing', async () => {
      // With no credentials, R2 client is null - should handle gracefully
      await expect(deleteAnchorFiles('user-1', 'anchor-1')).resolves.not.toThrow();
    });

    it('should call DeleteObjectCommand for each variation and audio style', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'access-key';
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'secret-key';

      const mockSend = jest.fn().mockResolvedValue({});
      (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));

      await deleteAnchorFiles('user-1', 'anchor-1');

      // 4 variations × 2 formats (png + jpg) = 8 calls
      // + 4 audio styles = 12 total
      expect(mockSend).toHaveBeenCalledTimes(12);
    });
  });

  // ============================================================================
  // getSignedUrl
  // ============================================================================

  describe('getSignedUrl', () => {
    it('should return public domain URL when configured', async () => {
      process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://cdn.example.com';
      const url = await getSignedUrl('anchors/user/anchor/image.png');
      expect(url).toBe('https://cdn.example.com/anchors/user/anchor/image.png');
    });

    it('should fall back to default R2 URL when no public domain set', async () => {
      const url = await getSignedUrl('anchors/user/anchor/image.png');
      expect(url).toContain('r2.cloudflarestorage.com');
      expect(url).toContain('anchors/user/anchor/image.png');
    });

    it('throws in production when the public domain is missing', async () => {
      process.env.NODE_ENV = 'production';
      process.env.CLOUDFLARE_R2_BUCKET_NAME = 'anchor-assets';

      await expect(getSignedUrl('anchors/user/anchor/image.png')).rejects.toThrow(
        'CLOUDFLARE_R2_PUBLIC_DOMAIN'
      );
    });
  });

  // ============================================================================
  // StorageService class
  // ============================================================================

  describe('StorageService class', () => {
    it('should call uploadImageFromBuffer via uploadImage method', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const service = new StorageService();
      const url = await service.uploadImage(Buffer.from('data'), 'test-anchor-0');

      expect(url).toContain('.png');
    });
  });
});
