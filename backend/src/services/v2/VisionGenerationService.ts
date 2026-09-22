import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';
import { GeminiError, GeminiErrorType, GeminiImageService } from '../GeminiImageService';
import { resolveStorageKeyUrl, uploadImageAssetFromBuffer } from '../StorageService';
import { getMonetizationAccess } from '../MonetizationAccessService';
import { visionService } from './VisionService';
import { logger } from '../../utils/logger';
import {
  buildVisionImagePrompt, isStoredVisionScenePlan, VISION_IMAGE_ASPECT_RATIO, VISION_IMAGE_HEIGHT, VISION_IMAGE_WIDTH,
  type VisionScenePlanItem,
} from './visionScenePlanning';

const MAX_SETS = 3;
const STALE_AFTER_MS = 20 * 60 * 1000;
const SCENE_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 2000;

export class VisionGenerationService {
  async latest(userId: string, anchorId: string, jobId?: string) {
    const anchor = await prisma.anchor.findFirst({ where: { id: anchorId, userId, isArchived: false }, select: { id: true } });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const job = await prisma.visionGeneration.findFirst({
      where: { userId, anchorId, ...(jobId ? { id: jobId } : {}), vision: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'desc' },
      include: { candidates: { orderBy: { sortOrder: 'asc' }, include: { asset: true } } },
    });
    if (!job) return null;
    if ((job.status === 'QUEUED' || job.status === 'RUNNING' || job.status === 'PARTIAL') &&
      Date.now() - job.updatedAt.getTime() > STALE_AFTER_MS) {
      await prisma.visionGeneration.update({
        where: { id: job.id },
        data: { status: 'FAILED', stage: 'interrupted', error: 'Generation was interrupted. You can retry.' },
      });
      job.status = 'FAILED';
      job.stage = 'interrupted';
      job.error = 'Generation was interrupted. You can retry.';
    }
    return {
      id: job.id,
      visionId: job.visionId,
      anchorId: job.anchorId,
      setNumber: job.setNumber,
      retryCount: job.retryCount,
      status: job.status,
      stage: job.stage,
      error: job.error,
      candidates: await Promise.all(job.candidates.map(async candidate => ({
        id: candidate.id,
        assetId: candidate.assetId,
        role: candidate.role,
        prompt: candidate.prompt,
        sortOrder: candidate.sortOrder,
        imageUrl: await resolveStorageKeyUrl(candidate.asset.storageKey),
      }))),
    };
  }

  async start(userId: string, anchorId: string, description: string, idempotencyKey: string) {
    const access = await getMonetizationAccess(userId);
    if (!access.hasProAccess) throw new AppError('Vision generation requires access', 403, 'VISION_PREMIUM_REQUIRED');
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true, intentionText: true, category: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const trimmed = description.trim();
    if (trimmed.length < 12 || trimmed.length > 2000) throw new AppError('Describe your Vision in 12 to 2000 characters', 400, 'VALIDATION_ERROR');

    const existingJob = await prisma.visionGeneration.findFirst({
      where: { userId, anchorId, id: idempotencyKey, vision: { status: 'ACTIVE' } },
    });
    if (existingJob) return this.latest(userId, anchorId, existingJob.id);

    const activeVision = await prisma.vision.findFirst({
      where: { userId, anchorId, status: 'ACTIVE' }, select: { id: true },
    });
    const latest = activeVision ? await prisma.visionGeneration.findFirst({
      where: { userId, visionId: activeVision.id },
      orderBy: { setNumber: 'desc' },
    }) : null;
    if (latest && ['QUEUED', 'RUNNING', 'PARTIAL'].includes(latest.status) &&
        Date.now() - latest.updatedAt.getTime() <= STALE_AFTER_MS) return this.latest(userId, anchorId);
    if ((latest?.setNumber ?? 0) >= MAX_SETS) throw new AppError('Three generated sets are available per Vision', 409, 'VISION_GENERATION_LIMIT');

    const vision = await visionService.createAnchorVision(userId, anchorId, { description: trimmed });

    const setNumber = (latest?.setNumber ?? 0) + 1;
    try {
      await prisma.visionGeneration.create({
        data: {
          id: idempotencyKey,
          userId,
          anchorId,
          visionId: vision.id,
          description: trimmed,
          setNumber,
          status: 'QUEUED',
          stage: 'planning',
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.latest(userId, anchorId, idempotencyKey);
        if (replay) return replay;
        // The unique conflict came from another set or account, not this request.
        throw new AppError('Generation request conflicted. Try again.', 409, 'VISION_GENERATION_CONFLICT');
      }
      throw error;
    }
    // The persisted job is visible immediately. A stale job can be retried after process restart.
    void this.run(idempotencyKey, anchor.intentionText, anchor.category).catch(error =>
      logger.error('[VisionGeneration] Background job failed', error));
    return this.latest(userId, anchorId);
  }

  async retry(userId: string, anchorId: string, jobId: string) {
    const job = await prisma.visionGeneration.findFirst({
      where: { id: jobId, userId, anchorId, vision: { status: 'ACTIVE' } },
    });
    if (!job) throw new AppError('Generation not found', 404, 'VISION_GENERATION_NOT_FOUND');
    if (job.status !== 'FAILED') throw new AppError('Generation is not ready to retry', 409, 'VISION_GENERATION_IN_PROGRESS');
    if (job.retryCount >= 2) throw new AppError('This set cannot be retried again', 409, 'VISION_RETRY_LIMIT');
    const access = await getMonetizationAccess(userId);
    if (!access.hasProAccess) throw new AppError('Vision generation requires access', 403, 'VISION_PREMIUM_REQUIRED');
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { intentionText: true, category: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const claimed = await prisma.visionGeneration.updateMany({
      where: { id: job.id, status: 'FAILED', retryCount: job.retryCount },
      data: { status: 'QUEUED', stage: 'planning', error: null, retryCount: { increment: 1 } },
    });
    if (claimed.count === 1) void this.run(job.id, anchor.intentionText, anchor.category).catch(error =>
      logger.error('[VisionGeneration] Retry failed', error));
    return this.latest(userId, anchorId);
  }

  /**
   * Scenes this Vision has already shown in earlier sets. Another set is a
   * request for different moments, so the planner is told what to avoid
   * rather than rerolling the same shot list.
   */
  private async previousScenes(job: { visionId: string; setNumber: number }): Promise<string[]> {
    const earlier = await prisma.visionGeneration.findMany({
      where: { visionId: job.visionId, setNumber: { lt: job.setNumber } },
      orderBy: { setNumber: 'asc' },
      select: { plan: true },
    });
    return earlier.flatMap(item => isStoredVisionScenePlan(item.plan) ? item.plan.map(scene => scene.scene) : []);
  }

  /**
   * One image, with one quiet second attempt. A single transient provider
   * error should not stop the set; if it fails twice the job pauses as
   * FAILED with every finished image kept, and a retry resumes from there.
   */
  private async renderScene(provider: GeminiImageService, prompt: string): Promise<Buffer> {
    try {
      return await provider.generateVisionScene(prompt);
    } catch (error) {
      if (error instanceof GeminiError && error.type === GeminiErrorType.INVALID_API_KEY) throw error;
      logger.warn('[VisionGeneration] Image attempt failed; retrying once', error);
      await new Promise(resolve => setTimeout(resolve, SCENE_RETRY_DELAY_MS));
      return provider.generateVisionScene(prompt);
    }
  }

  private async run(jobId: string, intention: string, category: string) {
    const job = await prisma.visionGeneration.findUnique({ where: { id: jobId } });
    if (!job) return;
    const claimed = await prisma.visionGeneration.updateMany({
      where: { id: jobId, status: 'QUEUED' },
      data: { status: 'RUNNING', stage: 'planning' },
    });
    if (claimed.count !== 1) return;
    try {
      const provider = new GeminiImageService();
      const attempt = job.retryCount;
      const savedPlan = job.plan;
      const plan: VisionScenePlanItem[] = isStoredVisionScenePlan(savedPlan)
        ? savedPlan
        : await provider.planVisionScenes(intention, category, job.description, await this.previousScenes(job));
      const afterPlanning = await prisma.visionGeneration.findUnique({
        where: { id: jobId }, select: { status: true, retryCount: true },
      });
      if (!afterPlanning || afterPlanning.retryCount !== attempt || !['RUNNING', 'PARTIAL'].includes(afterPlanning.status)) return;
      if (!job.plan) await prisma.visionGeneration.update({
        where: { id: jobId }, data: { plan: plan as unknown as Prisma.InputJsonValue },
      });
      await prisma.visionGeneration.update({ where: { id: jobId }, data: { stage: 'creating_images' } });
      for (let i = 0; i < plan.length; i++) {
        const current = await prisma.visionGeneration.findUnique({
          where: { id: jobId }, select: { status: true, retryCount: true },
        });
        if (!current || current.retryCount !== attempt || !['RUNNING', 'PARTIAL'].includes(current.status)) return;
        const prior = await prisma.visionGenerationCandidate.findUnique({
          where: { generationId_sortOrder: { generationId: jobId, sortOrder: i } },
        });
        if (prior) continue;
        const scene = plan[i];
        const prompt = buildVisionImagePrompt({ intention, category, description: job.description, scene });
        const raw = await this.renderScene(provider, prompt);
        const afterProvider = await prisma.visionGeneration.findUnique({
          where: { id: jobId }, select: { status: true, retryCount: true },
        });
        if (!afterProvider || afterProvider.retryCount !== attempt || !['RUNNING', 'PARTIAL'].includes(afterProvider.status)) return;
        // Keep the provider's portrait composition: bound it to the canonical
        // size without cropping or upscaling. Surfaces crop at display time.
        const { data: image, info } = await sharp(raw).rotate()
          .resize({ width: VISION_IMAGE_WIDTH, height: VISION_IMAGE_HEIGHT, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 86 }).toBuffer({ resolveWithObject: true });
        const uploaded = await uploadImageAssetFromBuffer(image, job.userId, job.anchorId, i, {
          visibility: 'private', contentType: 'image/jpeg',
        });
        const asset = await visionService.createAsset(job.userId, {
          storageKey: uploaded.objectKey,
          mimeType: 'image/jpeg',
          fileSizeBytes: image.length,
          metadata: {
            visionGenerationId: jobId, role: scene.role,
            width: info.width, height: info.height, aspectRatio: VISION_IMAGE_ASPECT_RATIO,
          },
        });
        await prisma.visionGenerationCandidate.create({
          data: { id: randomUUID(), generationId: jobId, assetId: asset.id, role: scene.role, prompt: scene.scene, sortOrder: i },
        });
        await prisma.visionGeneration.update({
          where: { id: jobId },
          data: { status: 'PARTIAL', stage: 'creating_images' },
        });
      }
      await prisma.visionGeneration.updateMany({
        where: { id: jobId, retryCount: attempt, status: { in: ['RUNNING', 'PARTIAL'] } },
        data: { status: 'COMPLETE', stage: 'complete', error: null },
      });
    } catch (error) {
      logger.error('[VisionGeneration] Provider or storage error', error);
      await prisma.visionGeneration.updateMany({
        where: { id: jobId, retryCount: job.retryCount, status: { in: ['RUNNING', 'PARTIAL'] } },
        data: { status: 'FAILED', stage: 'failed', error: 'Some images could not be created. Retry this set.' },
      });
    }
  }
}

export const visionGenerationService = new VisionGenerationService();
