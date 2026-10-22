import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';
import { deletePrivateImageAsset, readPrivateImageAsset, resolveStorageKeyUrl, uploadImageAssetFromBuffer } from '../StorageService';
import { visionService } from './VisionService';
import type { VisionAppearanceReferenceSource, VisionAppearanceReferenceReadModel } from '../../domain/v2/vision';

const MAX_BYTES = 5 * 1024 * 1024;
const CUSTOM_REFERENCE_TTL_MS = 2 * 60 * 60 * 1000;

function decode(dataUri: string, mimeType: string): Buffer {
  const match = dataUri.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!match || match[1] !== mimeType) throw new AppError('Reference image is invalid', 400, 'INVALID_VISION_REFERENCE');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES || buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) {
    throw new AppError('Reference image is invalid', 400, 'INVALID_VISION_REFERENCE');
  }
  return buffer;
}

export class VisionAppearanceReferenceService {
  async create(userId: string, input: {
    base64Image: string; mimeType?: string; source: VisionAppearanceReferenceSource; profileFingerprint?: string | null;
  }): Promise<VisionAppearanceReferenceReadModel> {
    const mimeType = input.mimeType ?? 'image/jpeg';
    const raw = decode(input.base64Image, mimeType);
    const meta = await sharp(raw).metadata().catch(() => null);
    if (!meta?.width || !meta?.height || meta.width < 480 || meta.height < 480) {
      throw new AppError('Choose a clear, close photo of one person.', 400, 'UNSUITABLE_VISION_REFERENCE');
    }
    const normalized = await sharp(raw).rotate().jpeg({ quality: 88 }).toBuffer();
    const old = await prisma.visionAppearanceReference.findFirst({
      where: { userId, source: input.source }, include: { asset: true }, orderBy: { updatedAt: 'desc' },
    });
    const uploaded = await uploadImageAssetFromBuffer(normalized, userId, `vision-reference-${randomUUID()}`, 0, {
      visibility: 'private', contentType: 'image/jpeg',
    });
    const asset = await visionService.createAsset(userId, {
      storageKey: uploaded.objectKey, mimeType: 'image/jpeg', fileSizeBytes: normalized.length,
      metadata: { purpose: 'vision_appearance_reference', source: input.source },
    });
    const reference = await prisma.visionAppearanceReference.create({
      data: {
        id: randomUUID(), userId, assetId: asset.id, source: input.source,
        profileFingerprint: input.profileFingerprint ?? null,
        expiresAt: input.source === 'CUSTOM' ? new Date(Date.now() + CUSTOM_REFERENCE_TTL_MS) : null,
      }, include: { asset: true },
    });
    if (old) await this.destroy(old.id, userId);
    return this.toReadModel(reference);
  }

  async latest(userId: string): Promise<VisionAppearanceReferenceReadModel | null> {
    const reference = await prisma.visionAppearanceReference.findFirst({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { asset: true }, orderBy: { updatedAt: 'desc' },
    });
    return reference ? this.toReadModel(reference) : null;
  }

  async resolveForGeneration(userId: string, referenceId: string | null | undefined): Promise<{ id: string; buffer: Buffer; mimeType: string } | null> {
    if (!referenceId) return null;
    const reference = await prisma.visionAppearanceReference.findFirst({
      where: { id: referenceId, userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { asset: true },
    });
    if (!reference) throw new AppError('Appearance reference is no longer available', 400, 'INVALID_VISION_REFERENCE');
    if (reference.source === 'PROFILE') {
      const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { useProfilePhotoForVision: true } });
      if (!settings?.useProfilePhotoForVision) throw new AppError('Profile photo use is not enabled for Vision', 403, 'VISION_REFERENCE_NOT_CONSENTED');
    }
    return { id: reference.id, buffer: await readPrivateImageAsset(reference.asset.storageKey), mimeType: reference.asset.mimeType };
  }

  async cleanupGenerationScoped(referenceId: string | null | undefined): Promise<void> {
    if (!referenceId) return;
    const reference = await prisma.visionAppearanceReference.findFirst({ where: { id: referenceId, source: 'CUSTOM' } });
    if (reference) await this.destroy(reference.id, reference.userId);
  }

  async destroy(referenceId: string, userId: string): Promise<void> {
    const reference = await prisma.visionAppearanceReference.findFirst({ where: { id: referenceId, userId }, include: { asset: true } });
    if (!reference) return;
    await prisma.visionAppearanceReference.delete({ where: { id: reference.id } });
    await deletePrivateImageAsset(reference.asset.storageKey);
    await prisma.asset.delete({ where: { id: reference.assetId } }).catch(() => undefined);
  }

  private async toReadModel(reference: { id: string; source: string; expiresAt: Date | null; asset: { storageKey: string } }): Promise<VisionAppearanceReferenceReadModel> {
    return { id: reference.id, source: reference.source as VisionAppearanceReferenceSource, previewUrl: await resolveStorageKeyUrl(reference.asset.storageKey), expiresAt: reference.expiresAt?.toISOString() ?? null };
  }
}

export const visionAppearanceReferenceService = new VisionAppearanceReferenceService();
