/**
 * Anchor App - Storage Service (Cloudflare R2)
 *
 * Handles file uploads and retrieval from Cloudflare R2 (S3-compatible object storage).
 * Stores AI-generated anchor images and mantra audio files.
 */

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

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
    return null as any;
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
  variationIndex: number
): Promise<string> {
  try {
    logger.info('[Storage] Uploading image from buffer (LOCAL STORAGE for development)');

    // Ensure absolute path to uploads directory in backend root
    const uploadsDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${anchorId}-${variationIndex}.png`;
    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, imageBuffer);

    logger.info(`[Storage] Saved buffer to local disk: ${localFilePath}`);

    // Use environment variable for local IP
    const localIp = process.env.LOCAL_IP || '127.0.0.1';
    const port = process.env.PORT || '8000';

    // In production, you would use a proper public URL or cloud storage URL
    return `http://${localIp}:${port}/uploads/${fileName}`;

  } catch (error) {
    logger.error('[Storage] Upload from buffer error', error);
    throw new Error(`Failed to upload image from buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload image from URL to R2
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  userId: string,
  anchorId: string,
  variationIndex: number
): Promise<string> {
  try {
    logger.info('[Storage] Using LOCAL STORAGE for development');

    // Download image from Replicate URL
    let buffer: Buffer;
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data);
    } catch (downloadError) {
      logger.error(`[Storage] Failed to download image from ${imageUrl}`, downloadError);
      throw new Error('Failed to download generated image');
    }

    // Delegate to uploadImageFromBuffer
    return uploadImageFromBuffer(buffer, userId, anchorId, variationIndex);

  } catch (error) {
    logger.error('[Storage] Upload error', error);
    // Ultimate fallback: return original Replicate URL
    return imageUrl;
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
    throw new Error(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
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
