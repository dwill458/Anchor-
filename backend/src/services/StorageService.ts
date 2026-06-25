/**
 * Anchor App - Storage Service (Cloudflare R2)
 *
 * Handles file uploads and retrieval from Cloudflare R2 (S3-compatible object storage).
 * Stores AI-generated anchor images and mantra audio files.
 */

import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presignS3Request } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

interface UploadUrlOptions {
  baseUrl?: string;
  signedUrlExpiresIn?: number;
}

interface UploadedImageAsset {
  objectKey: string;
  url: string;
  externalUrl: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const startsWithQuote = trimmed.startsWith('"') || trimmed.startsWith("'");
  const endsWithQuote = trimmed.endsWith('"') || trimmed.endsWith("'");

  if (startsWithQuote && endsWithQuote && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function requireStorageConfig(key: string, value: string | undefined): string {
  const normalized = normalizeEnvValue(value);
  if (normalized) {
    return normalized;
  }

  if (isProduction()) {
    throw new Error(`Cloudflare R2 configuration missing: ${key}`);
  }

  return '';
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

function parseConfiguredUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
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

function getPublicAssetBaseUrl(bucket: string): string {
  const publicDomain = normalizeEnvValue(process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN);
  if (publicDomain) {
    return publicDomain.replace(/\/+$/, '');
  }

  if (isProduction()) {
    throw new Error('Cloudflare R2 configuration missing: CLOUDFLARE_R2_PUBLIC_DOMAIN');
  }

  return `https://${bucket}.r2.cloudflarestorage.com`;
}

async function buildSignedObjectUrl(
  client: S3Client,
  bucket: string,
  objectKey: string,
  expiresIn: number = 3600
): Promise<string> {
  return presignS3Request(
    client as any,
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }) as any,
    { expiresIn }
  );
}

function extractObjectKeyFromPublicDomainUrl(assetUrl: URL, bucket: string): string | null {
  const publicDomain = normalizeEnvValue(process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN);
  if (!publicDomain) {
    return null;
  }

  const configuredUrl = parseConfiguredUrl(publicDomain);
  if (configuredUrl) {
    if (assetUrl.hostname !== configuredUrl.hostname) {
      return null;
    }

    const configuredPath = configuredUrl.pathname.replace(/\/+$/, '');
    const assetPath = assetUrl.pathname;

    if (configuredPath && configuredPath !== '/' && !assetPath.startsWith(configuredPath)) {
      return null;
    }

    return assetPath.slice(configuredPath.length).replace(/^\/+/, '') || null;
  }

  const normalizedHost = publicDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (assetUrl.hostname !== normalizedHost) {
    return null;
  }

  return assetUrl.pathname.replace(/^\/+/, '') || null;
}

export function extractStorageObjectKey(assetUrl: string): string | null {
  if (!assetUrl || assetUrl.startsWith('data:')) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(assetUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return null;
  }

  const bucket = getBucketName();
  const fromPublicDomain = extractObjectKeyFromPublicDomainUrl(parsedUrl, bucket);
  if (fromPublicDomain) {
    return fromPublicDomain;
  }

  if (parsedUrl.hostname.endsWith('.r2.cloudflarestorage.com')) {
    const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '');
    if (!normalizedPath) {
      return null;
    }

    const pathSegments = normalizedPath.split('/');
    if (pathSegments[0] === bucket) {
      return pathSegments.slice(1).join('/') || null;
    }

    return normalizedPath;
  }

  return null;
}

export async function resolveStoredAssetUrl(
  assetUrl: string | null | undefined,
  expiresIn: number = 3600
): Promise<string | null | undefined> {
  if (!assetUrl) {
    return assetUrl;
  }

  const objectKey = extractStorageObjectKey(assetUrl);
  if (!objectKey) {
    return assetUrl;
  }

  const client = getR2Client();
  if (!client) {
    return assetUrl;
  }

  try {
    return await buildSignedObjectUrl(client, getBucketName(), objectKey, expiresIn);
  } catch (error) {
    logger.warn('[Storage] Failed to resolve signed asset URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      objectKey,
    });
    return assetUrl;
  }
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

function buildAudioStorageKey(userId: string, anchorId: string, mantraStyle: string): string {
  const sanitizedUserId = sanitizePathSegment(userId);
  const sanitizedAnchorId = sanitizePathSegment(anchorId);
  const sanitizedStyle = sanitizePathSegment(mantraStyle);
  return `mantras/${sanitizedUserId}/${sanitizedAnchorId}/${sanitizedStyle}.mp3`;
}

function buildProfilePictureStorageKey(userId: string, mimeType: string): string {
  const sanitizedUserId = sanitizePathSegment(userId);
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return `profiles/${sanitizedUserId}/picture.${extension}`;
}

/**
 * Initialize R2 client (S3-compatible)
 */
function getR2Client(): S3Client | null {
  const accountId = requireStorageConfig(
    'CLOUDFLARE_ACCOUNT_ID',
    process.env.CLOUDFLARE_ACCOUNT_ID
  );
  const accessKeyId = requireStorageConfig(
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  );
  const secretAccessKey = requireStorageConfig(
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );

  if (!accountId || !accessKeyId || !secretAccessKey) {
    logger.warn('[Storage] R2 credentials missing. Running in mock mode.');
    return null;
  }

  // R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  logger.info('[Storage] R2 config', {
    endpoint,
    bucket: normalizeEnvValue(process.env.CLOUDFLARE_R2_BUCKET_NAME),
    accessKeyIdLength: accessKeyId.length,
    accessKeyIdPrefix: accessKeyId.slice(0, 4),
    secretKeyLength: secretAccessKey.length,
  });

  return new S3Client({
    region: 'auto', // R2 uses 'auto' region
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED', // R2 doesn't support AWS SDK v3 auto-checksums
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
  const bucket = normalizeEnvValue(process.env.CLOUDFLARE_R2_BUCKET_NAME);
  if (bucket) {
    return bucket;
  }

  if (isProduction()) {
    throw new Error('Cloudflare R2 configuration missing: CLOUDFLARE_R2_BUCKET_NAME');
  }

  return 'anchor-assets';
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
  const asset = await uploadImageAssetFromBuffer(
    imageBuffer,
    userId,
    anchorId,
    variationIndex,
    options
  );
  return asset.url;
}

export async function uploadImageAssetFromBuffer(
  imageBuffer: Buffer,
  userId: string,
  anchorId: string,
  variationIndex: number,
  options?: UploadUrlOptions
): Promise<UploadedImageAsset> {
  try {
    const objectKey = buildImageStorageKey(userId, anchorId, variationIndex);
    const client = getR2Client();
    const bucket = getBucketName();

    if (client) {
      logger.info('[Storage] Uploading image buffer to R2', { key: objectKey });
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: imageBuffer,
            ContentType: 'image/png',
            CacheControl: 'public, max-age=31536000',
          })
        );

        const url = `${getPublicAssetBaseUrl(bucket)}/${objectKey}`;
        const externalUrl = await buildSignedObjectUrl(
          client,
          bucket,
          objectKey,
          options?.signedUrlExpiresIn ?? 3600
        );

        return {
          objectKey,
          url,
          externalUrl,
        };
      } catch (r2Error) {
        if (isProduction()) {
          throw r2Error;
        }

        logger.warn('[Storage] R2 upload failed, falling back to local storage', {
          error: r2Error instanceof Error ? r2Error.message : 'Unknown',
        });
        // Fall through to local/data-URI fallback below
      }
    }

    logger.info('[Storage] Uploading image from buffer (LOCAL STORAGE fallback)', {
      key: objectKey,
    });

    try {
      // Ensure absolute path to uploads directory in backend root
      const uploadsDir = getLocalUploadsDir();
      const localFilePath = path.join(uploadsDir, objectKey);
      const localDir = path.dirname(localFilePath);

      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      fs.writeFileSync(localFilePath, imageBuffer);

      logger.info(`[Storage] Saved buffer to local disk: ${localFilePath}`);
      const localUrl = buildLocalUploadUrl(objectKey, options);
      return {
        objectKey,
        url: localUrl,
        externalUrl: localUrl,
      };
    } catch (localError) {
      // Local filesystem unavailable (e.g. ephemeral container) — return inline data URI
      // so dev/preview builds can still display the generated image.
      logger.warn('[Storage] Local filesystem unavailable, returning data URI', {
        error: localError instanceof Error ? localError.message : 'Unknown',
      });
      if (isProduction()) {
        throw localError;
      }

      const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      return {
        objectKey,
        url: dataUrl,
        externalUrl: dataUrl,
      };
    }
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
      return `local://${buildAudioStorageKey(userId, anchorId, mantraStyle)}`;
    }

    const fileName = buildAudioStorageKey(userId, anchorId, mantraStyle);

    logger.info('[Storage] Uploading audio to R2', { fileName });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileName,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000',
      })
    );

    // Return public URL
    return `${getPublicAssetBaseUrl(bucket)}/${fileName}`;
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

    if (!client) {
      logger.warn('[Storage] R2 client not available, skipping remote file deletion', { anchorId });
      return;
    }

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
      const key = buildAudioStorageKey(userId, anchorId, style);
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
 * Upload profile picture from base64 data URI
 */
export async function uploadProfilePicture(
  userId: string,
  base64Data: string,
  mimeType: string = 'image/jpeg',
  options?: UploadUrlOptions
): Promise<string> {
  try {
    if (!base64Data || !base64Data.includes('base64,')) {
      throw new Error('Invalid base64 data URI format');
    }

    const [, encodedData] = base64Data.split('base64,');
    const buffer = Buffer.from(encodedData, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Profile picture exceeds 5MB limit');
    }

    const objectKey = buildProfilePictureStorageKey(userId, mimeType);
    const client = getR2Client();
    const bucket = getBucketName();

    if (client) {
      logger.info('[Storage] Uploading profile picture to R2', { userId, key: objectKey });
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: buffer,
            ContentType: mimeType,
            CacheControl: 'public, max-age=31536000',
          })
        );

        return `${getPublicAssetBaseUrl(bucket)}/${objectKey}`;
      } catch (r2Error) {
        if (process.env.NODE_ENV === 'production') {
          throw r2Error;
        }

        logger.warn('[Storage] R2 upload failed, falling back to local storage', {
          error: r2Error instanceof Error ? r2Error.message : 'Unknown',
        });
      }
    }

    logger.info('[Storage] Uploading profile picture to local storage', { userId, key: objectKey });
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const localFilePath = path.join(uploadsDir, objectKey);
    const localDir = path.dirname(localFilePath);

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    fs.writeFileSync(localFilePath, buffer);
    logger.info(`[Storage] Saved profile picture to local disk: ${localFilePath}`);
    return buildLocalUploadUrl(objectKey, options);
  } catch (error) {
    logger.error('[Storage] Profile picture upload error', error);
    throw new Error(
      `Failed to upload profile picture: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate signed URL for private files (if needed)
 */
export async function getSignedUrl(filePath: string, _expiresIn: number = 3600): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();
  if (!client) {
    return `${getPublicAssetBaseUrl(bucket)}/${filePath}`;
  }

  return buildSignedObjectUrl(client, bucket, filePath, _expiresIn);
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
