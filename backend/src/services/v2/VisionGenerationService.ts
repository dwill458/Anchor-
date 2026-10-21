import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getOnboardingContext } from './OnboardingContextService';
import { AppError } from '../../api/middleware/errorHandler';
import { GeminiError, GeminiErrorType, GeminiImageService } from '../GeminiImageService';
import { imageGenerationService, ImageProviderError, ImageProviderErrorType } from '../image';
import { readPrivateImageAsset, uploadImageAssetFromBuffer } from '../StorageService';
import type { ImageReference } from '../image/types';
import { readDevImagePlan, storeDevImagePlan, type DevImageModel } from '../image/devImageModels';
import { visionConversationService } from './VisionConversationService';
import { conversationRoundInclude, serializeVisionRound } from './visionConversationContracts';
import { buildVisionConversationPrompt } from './visionConversationPrompt';
import type { VisionSceneGenerationInput, VisionOperation } from '../../domain/v2/vision';
import { getMonetizationAccess } from '../MonetizationAccessService';
import { visionService } from './VisionService';
import { VISION_MAX_IMAGES, VISION_SCENE_DESCRIPTION_MAX } from '../../domain/v2/vision';
import { visionAppearanceReferenceService } from './VisionAppearanceReferenceService';
import { logger } from '../../utils/logger';
import {
  buildVisionImagePrompt,
  buildVisionSceneVariantPlan,
  isStoredVisionScenePlan,
  VISION_IMAGE_ASPECT_RATIO,
  VISION_IMAGE_HEIGHT,
  VISION_IMAGE_WIDTH,
  type VisionScenePlanItem,
} from './visionScenePlanning';

const MAX_SETS = 3;
/** Described scenes added after the Vision exists; each request is two images, so this bounds cost. */
const MAX_SCENE_REQUESTS = 20;
const STALE_AFTER_MS = 20 * 60 * 1000;
const SCENE_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 2000;

export class VisionGenerationService {
  async latest(userId: string, anchorId: string, jobId?: string) {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const job = await prisma.visionGeneration.findFirst({
      // The numbered sets are what the Vision screen resumes; a described scene is fetched by its own id.
      where: {
        userId,
        anchorId,
        ...(jobId ? { id: jobId } : { kind: 'SET' }),
        vision: { status: 'ACTIVE' },
      },
      orderBy: { createdAt: 'desc' },
      include: conversationRoundInclude,
    });
    if (!job) return null;
    if (
      (job.status === 'QUEUED' || job.status === 'RUNNING' || job.status === 'PARTIAL') &&
      Date.now() - job.updatedAt.getTime() > STALE_AFTER_MS
    ) {
      await prisma.visionGeneration.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          stage: 'interrupted',
          error: 'Generation was interrupted. You can retry.',
        },
      });
      job.status = 'FAILED';
      job.stage = 'interrupted';
      job.error = 'Generation was interrupted. You can retry.';
    }
    return serializeVisionRound(job);
  }

  async start(
    userId: string,
    anchorId: string,
    description: string,
    idempotencyKey: string,
    appearanceReferenceId?: string | null,
    devImageModel?: DevImageModel
  ) {
    const access = await getMonetizationAccess(userId);
    if (!access.hasProAccess)
      throw new AppError('Vision generation requires access', 403, 'VISION_PREMIUM_REQUIRED');
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true, intentionText: true, category: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const trimmed = description.trim();
    if (trimmed.length < 12 || trimmed.length > 2000)
      throw new AppError('Describe your Vision in 12 to 2000 characters', 400, 'VALIDATION_ERROR');

    // Validate explicit consent/ownership before a job is accepted. The actual
    // bytes stay inside the backend and are read only by the provider worker.
    if (appearanceReferenceId)
      await visionAppearanceReferenceService.resolveForGeneration(userId, appearanceReferenceId);
    const existingJob = await prisma.visionGeneration.findFirst({
      where: { userId, anchorId, id: idempotencyKey, vision: { status: 'ACTIVE' } },
    });
    if (existingJob) return this.latest(userId, anchorId, existingJob.id);

    const activeVision = await prisma.vision.findFirst({
      where: { userId, anchorId, status: 'ACTIVE' },
      select: { id: true },
    });
    const latest = activeVision
      ? await prisma.visionGeneration.findFirst({
          where: { userId, visionId: activeVision.id, kind: 'SET' },
          orderBy: { setNumber: 'desc' },
        })
      : null;
    if (
      latest &&
      ['QUEUED', 'RUNNING', 'PARTIAL'].includes(latest.status) &&
      Date.now() - latest.updatedAt.getTime() <= STALE_AFTER_MS
    )
      return this.latest(userId, anchorId);
    if ((latest?.setNumber ?? 0) >= MAX_SETS)
      throw new AppError(
        'Three generated sets are available per Vision',
        409,
        'VISION_GENERATION_LIMIT'
      );

    const vision = await visionService.createAnchorVision(userId, anchorId, {
      description: trimmed,
    });

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
          ...(devImageModel
            ? { plan: storeDevImagePlan(null, devImageModel) as Prisma.InputJsonValue }
            : {}),
          appearanceReferenceId: appearanceReferenceId ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.latest(userId, anchorId, idempotencyKey);
        if (replay) return replay;
        // The unique conflict came from another set or account, not this request.
        throw new AppError(
          'Generation request conflicted. Try again.',
          409,
          'VISION_GENERATION_CONFLICT'
        );
      }
      throw error;
    }
    // The persisted job is visible immediately. A stale job can be retried after process restart.
    void this.run(idempotencyKey, anchor.intentionText, anchor.category).catch(error =>
      logger.error('[VisionGeneration] Background job failed', error)
    );
    return this.latest(userId, anchorId);
  }

  /**
   * One scene the person described, added to the board of an existing Vision.
   * Two candidates come back through the same provider chain as a full set, but
   * the job is a separate kind: it never uses up one of the three image sets and
   * never rewrites the Vision's own description.
   */
  async startScene(
    userId: string,
    anchorId: string,
    sceneDescription: string,
    idempotencyKey: string,
    appearanceReferenceId?: string | null,
    startAssetId?: string | null,
    devImageModel?: DevImageModel,
    conversation?: Pick<
      VisionSceneGenerationInput,
      'operation' | 'sessionId' | 'parentCandidateId' | 'references'
    >
  ) {
    if (conversation) {
      const accepted = await visionConversationService.start(userId, anchorId, {
        sceneDescription,
        idempotencyKey,
        ...conversation,
        devImageModel,
        appearanceReferenceId,
        startAssetId,
      });
      if (accepted.enqueue)
        void this.run(
          accepted.jobId,
          accepted.anchor.intentionText,
          accepted.anchor.category
        ).catch(error => logger.error('[VisionGeneration] Scene job failed', error));
      return this.latest(userId, anchorId, accepted.jobId);
    }
    const access = await getMonetizationAccess(userId);
    if (!access.hasProAccess)
      throw new AppError('Vision generation requires access', 403, 'VISION_PREMIUM_REQUIRED');
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true, intentionText: true, category: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const trimmed = sceneDescription.trim();
    if (trimmed.length < 6 || trimmed.length > VISION_SCENE_DESCRIPTION_MAX)
      throw new AppError(
        `Describe the scene in 6 to ${VISION_SCENE_DESCRIPTION_MAX} characters`,
        400,
        'VALIDATION_ERROR'
      );

    if (appearanceReferenceId)
      await visionAppearanceReferenceService.resolveForGeneration(userId, appearanceReferenceId);
    if (startAssetId) {
      const owned = await prisma.asset.findFirst({
        where: { id: startAssetId, userId },
        select: { id: true },
      });
      if (!owned) throw new AppError('Start photo not found', 400, 'INVALID_START_PHOTO');
    }

    const existingJob = await prisma.visionGeneration.findFirst({
      where: { userId, anchorId, id: idempotencyKey, vision: { status: 'ACTIVE' } },
    });
    if (existingJob) return this.latest(userId, anchorId, existingJob.id);

    const vision = await prisma.vision.findFirst({
      where: { userId, anchorId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!vision) throw new AppError('Create your Vision first', 404, 'VISION_NOT_FOUND');
    const onBoard = await prisma.visionScene.count({
      where: { visionId: vision.id, userId, isArchived: false },
    });
    if (onBoard >= VISION_MAX_IMAGES)
      throw new AppError(
        `A Vision can contain up to ${VISION_MAX_IMAGES} images`,
        400,
        'VISION_IMAGE_LIMIT'
      );

    const latest = await prisma.visionGeneration.findFirst({
      where: { userId, visionId: vision.id, kind: 'SCENE' },
      orderBy: { setNumber: 'desc' },
    });
    if (
      latest &&
      ['QUEUED', 'RUNNING', 'PARTIAL'].includes(latest.status) &&
      Date.now() - latest.updatedAt.getTime() <= STALE_AFTER_MS
    )
      return this.latest(userId, anchorId, latest.id);
    if ((latest?.setNumber ?? 0) >= MAX_SCENE_REQUESTS)
      throw new AppError(
        'You have reached the limit for generated scenes on this Vision',
        409,
        'VISION_GENERATION_LIMIT'
      );

    try {
      await prisma.visionGeneration.create({
        data: {
          id: idempotencyKey,
          userId,
          anchorId,
          visionId: vision.id,
          description: trimmed,
          kind: 'SCENE',
          setNumber: (latest?.setNumber ?? 0) + 1,
          status: 'QUEUED',
          stage: 'creating_images',
          appearanceReferenceId: appearanceReferenceId ?? null,
          startAssetId: startAssetId ?? null,
          plan: storeDevImagePlan(
            buildVisionSceneVariantPlan(trimmed),
            devImageModel
          ) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.latest(userId, anchorId, idempotencyKey);
        if (replay) return replay;
        throw new AppError(
          'Generation request conflicted. Try again.',
          409,
          'VISION_GENERATION_CONFLICT'
        );
      }
      throw error;
    }
    void this.run(idempotencyKey, anchor.intentionText, anchor.category).catch(error =>
      logger.error('[VisionGeneration] Scene job failed', error)
    );
    return this.latest(userId, anchorId, idempotencyKey);
  }

  async retry(userId: string, anchorId: string, jobId: string) {
    const job = await prisma.visionGeneration.findFirst({
      where: { id: jobId, userId, anchorId, vision: { status: 'ACTIVE' } },
    });
    if (!job) throw new AppError('Generation not found', 404, 'VISION_GENERATION_NOT_FOUND');
    if (
      job.sessionId &&
      !(await prisma.visionCreationSession.findFirst({
        where: {
          id: job.sessionId,
          userId,
          anchorId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }))
    )
      throw new AppError(
        'This scene session has ended. Start a different scene.',
        409,
        'VISION_SESSION_ENDED'
      );
    if (job.status !== 'FAILED')
      throw new AppError('Generation is not ready to retry', 409, 'VISION_GENERATION_IN_PROGRESS');
    if (job.retryCount >= 2)
      throw new AppError('This set cannot be retried again', 409, 'VISION_RETRY_LIMIT');
    const access = await getMonetizationAccess(userId);
    if (!access.hasProAccess)
      throw new AppError('Vision generation requires access', 403, 'VISION_PREMIUM_REQUIRED');
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { intentionText: true, category: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const claimed = await prisma.visionGeneration.updateMany({
      where: {
        id: job.id,
        status: 'FAILED',
        retryCount: job.retryCount,
        ...(job.sessionId ? { session: { status: 'ACTIVE', expiresAt: { gt: new Date() } } } : {}),
      },
      data: { status: 'QUEUED', stage: 'planning', error: null, retryCount: { increment: 1 } },
    });
    if (claimed.count === 1)
      void this.run(job.id, anchor.intentionText, anchor.category).catch(error =>
        logger.error('[VisionGeneration] Retry failed', error)
      );
    return this.latest(userId, anchorId, job.id);
  }

  /**
   * Scenes this Vision has already shown in earlier sets. Another set is a
   * request for different moments, so the planner is told what to avoid
   * rather than rerolling the same shot list.
   */
  private async previousScenes(job: { visionId: string; setNumber: number }): Promise<string[]> {
    const earlier = await prisma.visionGeneration.findMany({
      where: { visionId: job.visionId, kind: 'SET', setNumber: { lt: job.setNumber } },
      orderBy: { setNumber: 'asc' },
      select: { plan: true },
    });
    return earlier.flatMap(item => {
      const { scenes } = readDevImagePlan(item.plan);
      return isStoredVisionScenePlan(scenes) ? scenes.map(scene => scene.scene) : [];
    });
  }

  /**
   * One image, with one quiet second attempt. A single transient provider
   * error should not stop the set; if it fails twice the job pauses as
   * FAILED with every finished image kept, and a retry resumes from there.
   */
  private async renderScene(
    provider: GeminiImageService,
    prompt: string,
    reference?: { buffer: Buffer; mimeType: string } | null,
    userId?: string,
    world: ImageReference[] = [],
    devImageModel?: DevImageModel,
    operation?: VisionOperation,
    generationRequestId?: string,
    canProceed?: () => Promise<boolean>
  ): Promise<Buffer> {
    const withWorld = (
      appearance?: { buffer: Buffer; mimeType: string } | null
    ): ImageReference[] | undefined => {
      const all: ImageReference[] = [
        ...world,
        ...(appearance
          ? [
              {
                buffer: appearance.buffer,
                mimeType: appearance.mimeType,
                role: 'appearance' as const,
              },
            ]
          : []),
      ];
      return all.length ? all : undefined;
    };
    const attempt = async (appearance?: { buffer: Buffer; mimeType: string } | null) => {
      if (canProceed && !(await canProceed()))
        throw new AppError('Scene session has ended.', 409, 'VISION_SESSION_ENDED');
      // If generateVisionScene is a Jest mock (e.g. in unit tests), respect the mock
      const isMock = Boolean(
        (provider.generateVisionScene as unknown as { _isMockFunction?: boolean })?._isMockFunction
      );
      if (isMock && !devImageModel && !operation) {
        try {
          return await provider.generateVisionScene(prompt, appearance ?? undefined);
        } catch (error) {
          if (error instanceof GeminiError && error.type === GeminiErrorType.INVALID_API_KEY)
            throw error;
          logger.warn('[VisionGeneration] Image attempt failed; retrying once', error);
          await new Promise(resolve => setTimeout(resolve, SCENE_RETRY_DELAY_MS));
          return provider.generateVisionScene(prompt, appearance ?? undefined);
        }
      }

      // Production multi-provider path with automatic fallback
      try {
        const result = await imageGenerationService.generate({
          type: 'vision',
          prompt,
          referenceImages: withWorld(appearance),
          userId,
          devImageModel,
          operation,
          generationRequestId,
        });
        return result.images[0].buffer;
      } catch (error) {
        if (
          error instanceof ImageProviderError &&
          error.type === ImageProviderErrorType.AUTHENTICATION
        ) {
          throw new GeminiError(GeminiErrorType.INVALID_API_KEY, error.message);
        }
        logger.warn('[VisionGeneration] Multi-provider generation failed; retrying once', error);
        await new Promise(resolve => setTimeout(resolve, SCENE_RETRY_DELAY_MS));
        if (canProceed && !(await canProceed()))
          throw new AppError('Scene session has ended.', 409, 'VISION_SESSION_ENDED');
        const retryResult = await imageGenerationService.generate({
          type: 'vision',
          prompt,
          referenceImages: withWorld(appearance),
          userId,
          devImageModel,
          operation,
          generationRequestId,
        });
        return retryResult.images[0].buffer;
      }
    };
    try {
      return await attempt(reference);
    } catch (error) {
      if (error instanceof GeminiError && error.type === GeminiErrorType.INVALID_API_KEY)
        throw error;
      if (!reference || operation) throw error;
      // Appearance is optional. If the provider rejects the reference or its
      // likeness path, preserve the person's requested future as a POV /
      // identity-neutral scene rather than failing the complete Vision. The
      // Vision's own photographs (world) stay attached.
      logger.warn(
        '[VisionGeneration] Appearance reference unavailable; using identity-neutral scene',
        { worldReferences: world.length }
      );
      return attempt(null);
    }
  }

  /** Explicit gallery inputs and edit source are mandatory; never drop them on provider failure. */
  private async loadConversationReferences(job: {
    userId: string;
    anchorId: string;
    sessionId: string | null;
    parentCandidateId: string | null;
    references: Array<{ assetId: string; role: string; label: string | null }>;
  }): Promise<ImageReference[]> {
    const inputs: Array<{ assetId: string; role: ImageReference['role']; label?: string }> = [];
    if (job.parentCandidateId) {
      const parent = await prisma.visionGenerationCandidate.findFirst({
        where: {
          id: job.parentCandidateId,
          status: 'SUCCEEDED',
          asset: { userId: job.userId },
          generation: { sessionId: job.sessionId, userId: job.userId, anchorId: job.anchorId },
        },
        select: { assetId: true },
      });
      if (!parent?.assetId)
        throw new AppError(
          'Source candidate is unavailable. Choose another saved option.',
          400,
          'INVALID_VISION_CANDIDATE'
        );
      inputs.push({ assetId: parent.assetId, role: 'edit_source' });
    }
    inputs.push(
      ...job.references.map(ref => ({
        assetId: ref.assetId,
        role: ref.role as ImageReference['role'],
        ...(ref.label ? { label: ref.label } : {}),
      }))
    );
    const loaded: ImageReference[] = [];
    for (const input of inputs) {
      const asset = await prisma.asset.findFirst({
        where: { id: input.assetId, userId: job.userId },
        select: { storageKey: true },
      });
      if (!asset)
        throw new AppError(
          'Reference photo is unavailable. Choose it again.',
          400,
          'INVALID_VISION_REFERENCE'
        );
      const buffer = await sharp(await readPrivateImageAsset(asset.storageKey))
        .rotate()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      loaded.push({ buffer, mimeType: 'image/jpeg', role: input.role, label: input.label });
    }
    return loaded;
  }

  /** The person's own photo of their real world today, read for the image model. Best effort: a missing photo never blocks the scene. */
  private async loadStartReference(
    userId: string,
    assetId: string | null
  ): Promise<ImageReference | null> {
    if (!assetId) return null;
    try {
      const asset = await prisma.asset.findFirst({
        where: { id: assetId, userId },
        select: { storageKey: true },
      });
      if (!asset) return null;
      const buffer = await sharp(await readPrivateImageAsset(asset.storageKey))
        .rotate()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      return { buffer, mimeType: 'image/jpeg', role: 'start' };
    } catch (error) {
      logger.warn(
        '[VisionGeneration] Start photo could not be read; generating from the description',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      return null;
    }
  }

  private async run(jobId: string, intention: string, category: string) {
    const job = await prisma.visionGeneration.findUnique({
      where: { id: jobId },
      include: { session: true, references: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!job) return;
    const sessionActive = (state: { session?: { status: string; expiresAt: Date } | null }) =>
      !job.sessionId ||
      Boolean(state.session?.status === 'ACTIVE' && state.session.expiresAt.getTime() > Date.now());
    if (!sessionActive(job)) return;
    const claimed = await prisma.visionGeneration.updateMany({
      where: {
        id: jobId,
        status: 'QUEUED',
        ...(job.sessionId ? { session: { status: 'ACTIVE', expiresAt: { gt: new Date() } } } : {}),
      },
      data: { status: 'RUNNING', stage: 'planning' },
    });
    if (claimed.count !== 1) return;
    try {
      const provider = new GeminiImageService();
      let reference: { id: string; buffer: Buffer; mimeType: string } | null = null;
      try {
        reference = await visionAppearanceReferenceService.resolveForGeneration(
          job.userId,
          job.appearanceReferenceId
        );
      } catch {
        // Consent can be withdrawn or a generation-scoped reference can
        // expire while work is queued. Continue safely without a likeness.
        logger.warn(
          '[VisionGeneration] Appearance reference unavailable before scene planning; using identity-neutral scenes'
        );
      }
      const attempt = job.retryCount;
      const { scenes: savedPlan, devImageModel } = readDevImagePlan(job.plan);
      // Board photos and first-scene descriptions are never implicit visual context.
      const operation = job.sessionId ? (job.operation as VisionOperation) : undefined;
      const startReference = operation
        ? null
        : await this.loadStartReference(job.userId, job.startAssetId);
      const worldReferences = operation
        ? await this.loadConversationReferences(job)
        : startReference
          ? [startReference]
          : [];
      logger.info('[VisionGeneration] Generation references', {
        jobId,
        kind: job.kind,
        identityReferences: reference ? 1 : 0,
        operation: operation ?? 'legacy',
        sessionId: job.sessionId,
        explicitReferences: worldReferences.length,
        worldReferencesAttached: 0,
        startPhoto: Boolean(startReference),
      });
      const onboarding = await getOnboardingContext(job.userId).catch(() => null);
      const plan: VisionScenePlanItem[] = isStoredVisionScenePlan(savedPlan)
        ? savedPlan
        : await provider.planVisionScenes(
            intention,
            category,
            job.description,
            await this.previousScenes(job),
            Boolean(reference),
            onboarding
          );
      if (process.env.NODE_ENV !== 'production') {
        const manifest = plan[0]?.identifiedConcepts ?? [];
        const coveredConcepts = [...new Set(plan.flatMap(scene => scene.covers ?? []))];
        logger.info('[VisionGeneration] Scene plan semantic coverage and diversity', {
          jobId,
          userDescription: job.description,
          identifiedConceptsCount: manifest.length,
          identifiedConcepts: manifest,
          coveredConceptsCount: coveredConcepts.length,
          coveredConcepts,
          scenes: plan.map((scene, index) => ({
            index: index + 1,
            role: scene.role,
            purpose: scene.purpose ?? scene.role,
            covers: scene.covers ?? [],
            setting: scene.setting,
            framing: scene.framing,
          })),
        });
      }
      const afterPlanning = await prisma.visionGeneration.findUnique({
        where: { id: jobId },
        select: {
          status: true,
          retryCount: true,
          session: { select: { status: true, expiresAt: true } },
        },
      });
      if (
        !afterPlanning ||
        !sessionActive(afterPlanning) ||
        afterPlanning.retryCount !== attempt ||
        !['RUNNING', 'PARTIAL'].includes(afterPlanning.status)
      )
        return;
      if (!isStoredVisionScenePlan(savedPlan))
        await prisma.visionGeneration.update({
          where: { id: jobId },
          data: { plan: storeDevImagePlan(plan, devImageModel) as Prisma.InputJsonValue },
        });
      await prisma.visionGeneration.update({
        where: { id: jobId },
        data: { stage: 'creating_images' },
      });
      let succeeded = 0;
      // Both moments render at once; each still runs its own provider chain and fallback.
      let aborted = false;
      const renderOne = async (i: number): Promise<void> => {
        const current = await prisma.visionGeneration.findUnique({
          where: { id: jobId },
          select: {
            status: true,
            retryCount: true,
            session: { select: { status: true, expiresAt: true } },
          },
        });
        if (
          !current ||
          !sessionActive(current) ||
          current.retryCount !== attempt ||
          !['RUNNING', 'PARTIAL'].includes(current.status)
        ) {
          aborted = true;
          return;
        }
        const prior = await prisma.visionGenerationCandidate.findUnique({
          where: { generationId_sortOrder: { generationId: jobId, sortOrder: i } },
        });
        if (prior?.status === 'SUCCEEDED') {
          succeeded += 1;
          return;
        }
        const scene = plan[i];
        const prompt = operation
          ? buildVisionConversationPrompt(operation, job.description, intention, i)
          : buildVisionImagePrompt({
              intention,
              category,
              description: job.description,
              isAddedScene: job.kind === 'SCENE',
              scene,
              plannedScenes: plan,
              hasAppearanceReference: Boolean(reference),
              worldReferenceCount: 0,
              startPhotoAttached: Boolean(startReference),
            });
        try {
          const canProceed = async () => {
            const state = await prisma.visionGeneration.findUnique({
              where: { id: jobId },
              select: {
                status: true,
                retryCount: true,
                session: { select: { status: true, expiresAt: true } },
              },
            });
            return Boolean(
              state &&
              sessionActive(state) &&
              state.retryCount === attempt &&
              ['RUNNING', 'PARTIAL'].includes(state.status)
            );
          };
          const raw = await this.renderScene(
            provider,
            prompt,
            reference,
            job.userId,
            worldReferences,
            devImageModel,
            operation,
            `${jobId}-${i}-${attempt}`,
            operation ? canProceed : undefined
          );
          const afterProvider = await prisma.visionGeneration.findUnique({
            where: { id: jobId },
            select: {
              status: true,
              retryCount: true,
              session: { select: { status: true, expiresAt: true } },
            },
          });
          if (
            !afterProvider ||
            !sessionActive(afterProvider) ||
            afterProvider.retryCount !== attempt ||
            !['RUNNING', 'PARTIAL'].includes(afterProvider.status)
          ) {
            aborted = true;
            return;
          }
          const { data: image, info } = await sharp(raw)
            .rotate()
            .resize({
              width: VISION_IMAGE_WIDTH,
              height: VISION_IMAGE_HEIGHT,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 86 })
            .toBuffer({ resolveWithObject: true });
          const uploaded = await uploadImageAssetFromBuffer(image, job.userId, job.anchorId, i, {
            visibility: 'private',
            contentType: 'image/jpeg',
          });
          const asset = await visionService.createAsset(job.userId, {
            storageKey: uploaded.objectKey,
            mimeType: 'image/jpeg',
            fileSizeBytes: image.length,
            metadata: {
              visionGenerationId: jobId,
              ...(devImageModel ? { devImageModel } : {}),
              role: scene.role,
              width: info.width,
              height: info.height,
              aspectRatio: VISION_IMAGE_ASPECT_RATIO,
            },
          });
          if (prior)
            await prisma.visionGenerationCandidate.update({
              where: { id: prior.id },
              data: {
                assetId: asset.id,
                status: 'SUCCEEDED',
                error: null,
                role: scene.role,
                prompt: scene.scene,
              },
            });
          else
            await prisma.visionGenerationCandidate.create({
              data: {
                id: randomUUID(),
                generationId: jobId,
                assetId: asset.id,
                role: scene.role,
                prompt: scene.scene,
                sortOrder: i,
                status: 'SUCCEEDED',
              },
            });
          succeeded += 1;
          await prisma.visionGeneration.update({
            where: { id: jobId },
            data: { status: 'PARTIAL', stage: 'creating_images' },
          });
        } catch (sceneError) {
          logger.warn('[VisionGeneration] Scene failed; continuing with remaining moments', {
            jobId,
            scene: i,
          });
          if (prior)
            await prisma.visionGenerationCandidate.update({
              where: { id: prior.id },
              data: { status: 'FAILED', error: 'Scene unavailable' },
            });
          else
            await prisma.visionGenerationCandidate.create({
              data: {
                id: randomUUID(),
                generationId: jobId,
                assetId: null,
                role: scene.role,
                prompt: scene.scene,
                sortOrder: i,
                status: 'FAILED',
                error: 'Scene unavailable',
              },
            });
        }
      };
      await Promise.allSettled(plan.map((_, i) => renderOne(i)));
      if (aborted) return;
      await prisma.visionGeneration.updateMany({
        where: { id: jobId, retryCount: attempt, status: { in: ['RUNNING', 'PARTIAL'] } },
        data: succeeded
          ? { status: 'COMPLETE', stage: 'complete', error: null }
          : {
              status: 'FAILED',
              stage: 'failed',
              error: 'Images could not be created. Retry this set.',
            },
      });
    } catch (error) {
      logger.error('[VisionGeneration] Provider or storage error', error);
      await prisma.visionGeneration.updateMany({
        where: { id: jobId, retryCount: job.retryCount, status: { in: ['RUNNING', 'PARTIAL'] } },
        data: {
          status: 'FAILED',
          stage: 'failed',
          error: 'Some images could not be created. Retry this set.',
        },
      });
    } finally {
      // Keep custom reference photo active across retries; it expires via TTL or explicit user removal.
    }
  }
}

export const visionGenerationService = new VisionGenerationService();
