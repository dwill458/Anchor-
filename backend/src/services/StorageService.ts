/**
 * Anchor App - Storage Service (Cloudflare R2)
 *
 * Handles file uploads and retrieval from Cloudflare R2 (S3-compatible object storage).
 * Stores AI-generated anchor images and mantra audio files.
 */

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

interface UploadUrlOptions {
  baseUrl?: string;
}

function getLocalUploadsDir(): string {
  return path.join(process.cwd(), 'uploads');
}

function normalizeBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return baseUrl.replace(/\/+$/, '');
}

function buildLocalUploadUrl(storageKey: string, options?: UploadUrlOptions): string {
  const configuredBaseUrl = normalizeBaseUrl(options?.baseUrl);
  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/uploads/${storageKey}`;
  }

  const localIp = process.env.LOCAL_IP || '127.0.0.1';
  const port = process.env.PORT || '8000';
  return `http://${localIp}:${port}/uploads/${storageKey}`;
}

function sanitizePathSegment(value: string): string {
  const trimmed = (value || '').trim();
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  return sanitized || 'unknown';
}

function buildImageStorageKey(userId: string, anchorId: string, variationIndex: number): string {
  const sanitizedUserId = sanitizePathSegment(userId);
  const sanitizedAnchorId = sanitizePathSegment(anchorId);
  const uniquePrefix = `${Date.now()}-${randomUUID()}`;
  return `anchors/${sanitizedUserId}/${sanitizedAnchorId}/${uniquePrefix}-variation-${variationIndex}.png`;
}

/**
 * Initialize R2 client (S3-compatible)
 */
function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    // Allow mock mode if credentials missing
    // throw new Error('Cloudflare R2 credentials not configured');
    logger.warn('[Storage] R2 credentials missing. Running in mock mode.');
    return null as unknown as S3Client;
  }

  // R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: 'auto', // R2 uses 'auto' region
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Get bucket name from environment
 */
function getBucketName(): string {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'anchor-assets';
  return bucket;
}

/**
 * Upload image from Buffer to local storage
 * Used for Google Vertex AI images that come as base64
 */
export async function uploadImageFromBuffer(
  imageBuffer: Buffer,
  userId: string,
  anchorId: string,
  variationIndex: number,
  options?: UploadUrlOptions
): Promise<string> {
  try {
    const objectKey = buildImageStorageKey(userId, anchorId, variationIndex);
    const client = getR2Client();
    const bucket = getBucketName();

    if (client) {
      logger.info('[Storage] Uploading image buffer to R2', { key: objectKey });
      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: objectKey,
          Body: imageBuffer,
          ContentType: 'image/png',
          CacheControl: 'public, max-age=31536000',
        },
      });

      await upload.done();

      const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;
      if (publicDomain) {
        return `${publicDomain}/${objectKey}`;
      }

      return `https://${bucket}.r2.cloudflarestorage.com/${objectKey}`;
    }

    logger.info('[Storage] Uploading image from buffer (LOCAL STORAGE fallback)', { key: objectKey });

    // Ensure absolute path to uploads directory in backend root
    const uploadsDir = getLocalUploadsDir();
    const localFilePath = path.join(uploadsDir, objectKey);
    const localDir = path.dirname(localFilePath);

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    fs.writeFileSync(localFilePath, imageBuffer);

    logger.info(`[Storage] Saved buffer to local disk: ${localFilePath}`);
    return buildLocalUploadUrl(objectKey, options);
  } catch (error) {
    logger.error('[Storage] Upload from buffer error', error);
    throw new Error(
      `Failed to upload image from buffer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Maximum image size accepted from upstream AI providers (25 MB)
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

// Allowed image MIME types — reject anything that isn't a recognised image format
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

/**
 * Upload image from URL to R2
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  userId: string,
  anchorId: string,
  variationIndex: number,
  options?: UploadUrlOptions
): Promise<string> {
  try {
    logger.info('[Storage] Using LOCAL STORAGE for development');

    // Download image from upstream URL with size and type guards
    let buffer: Buffer;
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        // Abort if the server reports a Content-Length beyond our limit
        maxContentLength: MAX_IMAGE_BYTES,
        maxBodyLength: MAX_IMAGE_BYTES,
        timeout: 30_000,
      });

      // Validate Content-Type — only accept recognised image MIME types
      const contentType = (response.headers['content-type'] as string | undefined)
        ?.split(';')[0]
        .trim()
        .toLowerCase();
      if (contentType && !ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
        throw new Error(`Rejected upstream image with unsupported MIME type: ${contentType}`);
      }

      buffer = Buffer.from(response.data);

      // Double-check actual byte length in case Content-Length header was absent
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(`Upstream image exceeds maximum allowed size (${MAX_IMAGE_BYTES} bytes)`);
      }
    } catch (downloadError) {
      logger.error(`[Storage] Failed to download image from upstream`, downloadError);
      throw new Error('Failed to download generated image');
    }

    // Delegate to uploadImageFromBuffer
    return uploadImageFromBuffer(buffer, userId, anchorId, variationIndex, options);
  } catch (error) {
    // Re-throw so callers (e.g. enhance-controlnet) can skip failed variations
    // or surface a 502 to the client. Silently returning the source URL would
    // mask storage failures and return transient upstream URLs that can expire.
    logger.error(
      '[Storage] Upload error',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Upload audio buffer to R2
 */
export async function uploadAudio(
  audioBuffer: Buffer,
  userId: string,
  anchorId: string,
  mantraStyle: string
): Promise<string> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();

    // Handle mock mode (no R2 credentials)
    if (!client) {
      logger.warn('[Storage] R2 client not available, using local fallback for audio');
      // Return a deterministic local URI for development/CI environments
      // In production, R2 credentials will always be available
      return `local://mantras/${userId}/${anchorId}/${mantraStyle}.mp3`;
    }

    // Generate unique filename
    const fileName = `mantras/${userId}/${anchorId}/${mantraStyle}.mp3`;

    logger.info('[Storage] Uploading audio to R2', { fileName });

    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: fileName,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000',
      },
    });

    await upload.done();

    // Return public URL
    const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;
    if (publicDomain) {
      return `${publicDomain}/${fileName}`;
    }

    return `https://${bucket}.r2.cloudflarestorage.com/${fileName}`;
  } catch (error) {
    logger.error('[Storage] Audio upload failed', error);
    throw new Error(
      `Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete anchor files (when burning an anchor)
 */
export async function deleteAnchorFiles(userId: string, anchorId: string): Promise<void> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();

    // Delete all variations
    for (let i = 0; i < 4; i++) {
      const pngKey = `anchors/${userId}/${anchorId}/variation-${i}.png`;
      const jpgKey = `anchors/${userId}/${anchorId}/variation-${i}.jpg`;

      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: pngKey }));
      } catch (e) {
        // Ignore if doesn't exist
      }

      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: jpgKey }));
      } catch (e) {
        // Ignore if doesn't exist
      }
    }

    // Delete mantra audio files
    const mantraStyles = ['syllabic', 'rhythmic', 'letterByLetter', 'phonetic'];
    for (const style of mantraStyles) {
      const key = `mantras/${userId}/${anchorId}/${style}.mp3`;
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (e) {
        // Ignore if doesn't exist
      }
    }

    logger.info('[Storage] Deleted files for anchor', { anchorId });
  } catch (error) {
    logger.error('[Storage] Delete failed', error);
    // Don't throw - deletion is best-effort
  }
}

/**
 * Generate signed URL for private files (if needed)
 */
export async function getSignedUrl(filePath: string, _expiresIn: number = 3600): Promise<string> {
  // For now, return public URL
  // In production, implement signed URLs for private content
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    return `${publicDomain}/${filePath}`;
  }

  const bucket = getBucketName();
  return `https://${bucket}.r2.cloudflarestorage.com/${filePath}`;
}

/**
 * Storage Service Class
 * Class-based wrapper for the storage functions to support the new API style.
 */
export class StorageService {
  /**
   * Upload image buffer to storage
   */
  async uploadImage(buffer: Buffer, fileName: string): Promise<string> {
    const anchorId = fileName.split('-')[1] || `temp-${Date.now()}`;
    const index = parseInt(fileName.split('-').pop() || '0');

    return uploadImageFromBuffer(buffer, 'default-user', anchorId, index);
  }

  /**
   * Delete files
   */
  async deleteFiles(userId: string, anchorId: string): Promise<void> {
    return deleteAnchorFiles(userId, anchorId);
  }
}
