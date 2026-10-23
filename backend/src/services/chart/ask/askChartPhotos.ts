import sharp from 'sharp';
import { AppError } from '../../../api/middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { deletePrivateImageAsset, uploadImageAssetFromBuffer } from '../../StorageService';

/**
 * Photos attached to an Ask Chart message. They exist for the answer they were sent with, not as a record of the
 * person's life: each one is re-encoded (location and camera metadata dropped, long edge capped), stored privately,
 * tagged `purpose: ask-chart`, and deleted after PHOTO_TTL_MS, or sooner if the conversation is cleared.
 */
export const ASK_PHOTO_PURPOSE = 'ask-chart';
export const PHOTO_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ASK_PHOTO_INPUT_BYTES = 6 * 1024 * 1024;
export const MAX_ASK_PHOTO_BASE64_LENGTH = Math.ceil((MAX_ASK_PHOTO_INPUT_BYTES * 4) / 3) + 128;
export const ASK_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_EDGE = 1600;
const FORMAT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Accepts a data URL or raw base64; rejects anything that is not exactly what it says it is. */
export function decodeAskPhoto(value: string, declaredMimeType: string): Buffer {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/]*={0,2})$/);
  const payload = match ? match[2] : value;
  const embedded = match?.[1] === 'image/jpg' ? 'image/jpeg' : match?.[1];
  const declared = declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType;
  if (embedded && embedded !== declared)
    throw new AppError('Embedded image type does not match mimeType', 400, 'VALIDATION_ERROR');
  if (!payload || payload.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new AppError('The photo is malformed', 400, 'VALIDATION_ERROR');
  }
  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length || buffer.length > MAX_ASK_PHOTO_INPUT_BYTES) {
    throw new AppError('The photo is malformed or larger than 6 MB', 400, 'VALIDATION_ERROR');
  }
  return buffer;
}

/** Validates the real format, applies EXIF orientation, drops all metadata, caps the long edge. Output is always JPEG. */
export async function normalizeAskPhoto(
  buffer: Buffer,
  declaredMimeType: string
): Promise<{ data: Buffer; width: number; height: number }> {
  const input = sharp(buffer, { limitInputPixels: 60_000_000, failOn: 'error' });
  const metadata = await input.metadata().catch(() => null);
  if (
    !metadata?.format ||
    metadata.format !==
      FORMAT_FOR_MIME[declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType]
  ) {
    throw new AppError(
      'The photo is not a valid image of the declared type',
      400,
      'VALIDATION_ERROR'
    );
  }
  try {
    const { data, info } = await input
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new AppError('The photo could not be processed', 422, 'ASK_PHOTO_UNPROCESSABLE');
  }
}

export async function storeAskPhoto(
  userId: string,
  anchorId: string,
  base64Image: string,
  mimeType: string
) {
  const { data, width, height } = await normalizeAskPhoto(
    decodeAskPhoto(base64Image, mimeType),
    mimeType
  );
  const uploaded = await uploadImageAssetFromBuffer(data, userId, 'ask-chart-photos', 0, {
    visibility: 'private',
    contentType: 'image/jpeg',
  });
  const asset = await prisma.asset.create({
    data: {
      userId,
      storageKey: uploaded.objectKey,
      mimeType: 'image/jpeg',
      fileSizeBytes: data.length,
      metadata: { purpose: ASK_PHOTO_PURPOSE, anchorId, width, height },
    },
    select: { id: true },
  });
  return { assetId: asset.id, width, height, bytes: data.length, expiresInMs: PHOTO_TTL_MS };
}

const isAskPhoto = { path: ['purpose'], equals: ASK_PHOTO_PURPOSE } as const;

async function removeAssets(rows: Array<{ id: string; storageKey: string }>): Promise<number> {
  let removed = 0;
  for (const row of rows) {
    await deletePrivateImageAsset(row.storageKey);
    const result = await prisma.asset.deleteMany({
      where: {
        id: row.id,
        visionScenes: { none: {} },
        visionCandidates: { none: {} },
        visionAppearanceReferences: { none: {} },
        visionGenerationReferences: { none: {} },
      },
    });
    removed += result.count;
  }
  return removed;
}

/** Deletes Ask Chart photos past their lifetime (one person's, or everyone's for the scheduled job). */
export async function purgeExpiredAskPhotos(
  options: { now?: Date; userId?: string } = {}
): Promise<number> {
  const cutoff = new Date((options.now ?? new Date()).getTime() - PHOTO_TTL_MS);
  const rows = await prisma.asset.findMany({
    where: {
      createdAt: { lt: cutoff },
      metadata: isAskPhoto,
      ...(options.userId ? { userId: options.userId } : {}),
    },
    select: { id: true, storageKey: true },
    take: 200,
  });
  const removed = await removeAssets(rows);
  if (removed) logger.info('ask_chart_photos_purged', { removed });
  return removed;
}

/** Deletes specific Ask Chart photos belonging to the person (conversation cleared). Other assets are never touched. */
export async function deleteAskPhotos(userId: string, assetIds: string[]): Promise<number> {
  if (assetIds.length === 0) return 0;
  const rows = await prisma.asset.findMany({
    where: { id: { in: assetIds }, userId, metadata: isAskPhoto },
    select: { id: true, storageKey: true },
  });
  return removeAssets(rows);
}
