/**
 * Anchor App - Storage Service (Cloudflare R2)
 *
 * Handles file uploads and retrieval from Cloudflare R2 (S3-compatible object storage).
 * Stores AI-generated anchor images and mantra audio files.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

/**
 * Initialize R2 client (S3-compatible)
 */
function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured');
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
 * Upload image from URL to R2
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  userId: string,
  anchorId: string,
  variationIndex: number
): Promise<string> {
  try {
    const client = getR2Client();
    const bucket = getBucketName();

    // Download image from Replicate URL
    console.log('[Storage] Downloading image from:', imageUrl);
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/png';

    // Generate unique filename
    const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `anchors/${userId}/${anchorId}/variation-${variationIndex}.${fileExtension}`;

    console.log('[Storage] Uploading to R2:', fileName);

    // Upload to R2
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: fileName,
        Body: imageBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });

    await upload.done();

    // Return public URL (if R2 bucket has public access configured)
    // Format: https://pub-<bucket-id>.r2.dev/<file-path>
    const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;
    if (publicDomain) {
      return `${publicDomain}/${fileName}`;
    }

    // Fallback: return R2 URL (requires authentication)
    return `https://${bucket}.r2.cloudflarestorage.com/${fileName}`;
  } catch (error) {
    console.error('[Storage] Upload failed:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Generate unique filename
    const fileName = `mantras/${userId}/${anchorId}/${mantraStyle}.mp3`;

    console.log('[Storage] Uploading audio to R2:', fileName);

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
    console.error('[Storage] Audio upload failed:', error);
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

    console.log('[Storage] Deleted files for anchor:', anchorId);
  } catch (error) {
    console.error('[Storage] Delete failed:', error);
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
