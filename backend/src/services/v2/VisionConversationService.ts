import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';
import { getMonetizationAccess } from '../MonetizationAccessService';
import {
  StartVisionSceneGenerationSchema,
  VisionReferencesSchema,
  VISION_MAX_IMAGES,
  type VisionSceneGenerationInput,
  type VisionReferenceInput,
  type UpdateVisionSessionSchema,
} from '../../domain/v2/vision';
import { visionService } from './VisionService';
import { buildVisionSceneVariantPlan } from './visionScenePlanning';
import {
  conversationRoundInclude,
  privatePreview,
  serializeVisionRound,
} from './visionConversationContracts';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_JOB_MS = 20 * 60 * 1000;
const unfinished: Array<'QUEUED' | 'RUNNING' | 'PARTIAL'> = ['QUEUED', 'RUNNING', 'PARTIAL'];

async function cancelEndedRounds(
  db: Pick<Prisma.TransactionClient, 'visionGeneration'>,
  userId: string,
  anchorId: string
) {
  await db.visionGeneration.updateMany({
    where: {
      userId,
      anchorId,
      sessionId: { not: null },
      status: { in: unfinished },
      session: { OR: [{ status: { not: 'ACTIVE' } }, { expiresAt: { lte: new Date() } }] },
    },
    data: {
      status: 'FAILED',
      stage: 'cancelled',
      error: 'This scene session has ended. Start a different scene.',
    },
  });
}
const MAX_SCENE_REQUESTS = 20; // Existing paid-job budget; each round is two provider images.
const missing = () =>
  new AppError(
    'Scene session not found or expired. Start a different scene.',
    404,
    'VISION_SESSION_NOT_FOUND'
  );
const requestFingerprint = (input: VisionSceneGenerationInput) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        description: input.sceneDescription,
        operation: input.operation ?? 'CREATE',
        sessionId: input.sessionId ?? null,
        parentCandidateId: input.parentCandidateId ?? null,
        references: input.references ?? [],
        devImageModel: input.devImageModel ?? null,
      })
    )
    .digest('hex');

export class VisionConversationService {
  private async anchor(userId: string, anchorId: string) {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true, intentionText: true, category: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    return anchor;
  }

  async validateReferences(userId: string, refs: VisionReferenceInput[]) {
    const parsed = VisionReferencesSchema.safeParse(refs);
    if (!parsed.success)
      throw new AppError(
        'Choose up to five distinct reference photos with valid roles.',
        400,
        'INVALID_VISION_REFERENCES'
      );
    for (const ref of refs) {
      const asset = await prisma.asset.findFirst({
        where: { id: ref.assetId, userId },
        select: { id: true, mimeType: true, fileSizeBytes: true },
      });
      if (
        !asset ||
        !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(asset.mimeType) ||
        (asset.fileSizeBytes ?? 0) > 5 * 1024 * 1024
      )
        throw new AppError(
          'A reference photo is unavailable. Remove it or choose it again.',
          400,
          'INVALID_VISION_REFERENCE'
        );
    }
  }

  async create(userId: string, anchorId: string, id: string, description: string) {
    await this.anchor(userId, anchorId);
    const replay = await prisma.visionCreationSession.findFirst({
      where: {
        id,
        userId,
        anchorId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        vision: { status: 'ACTIVE' },
      },
    });
    if (replay) return this.read(userId, anchorId, id);
    let vision = await prisma.vision.findFirst({
      where: { userId, anchorId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!vision) vision = await visionService.createAnchorVision(userId, anchorId, {});
    try {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM visions WHERE id = ${vision.id} FOR UPDATE`;
        const existing = await tx.visionCreationSession.findUnique({ where: { id } });
        if (existing)
          throw new AppError('Scene session request conflicted.', 409, 'VISION_SESSION_CONFLICT');
        await tx.visionCreationSession.updateMany({
          where: { userId, anchorId, status: 'ACTIVE' },
          data: { status: 'ABANDONED' },
        });
        await cancelEndedRounds(tx, userId, anchorId);
        await tx.visionCreationSession.create({
          data: {
            id,
            userId,
            anchorId,
            visionId: vision.id,
            description,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          },
        });
      });
    } catch (error) {
      if (
        await prisma.visionCreationSession.findFirst({
          where: { id, userId, anchorId, status: 'ACTIVE' },
        })
      )
        return this.read(userId, anchorId, id);
      throw error;
    }
    return this.read(userId, anchorId, id);
  }

  async read(userId: string, anchorId: string, sessionId?: string) {
    await this.anchor(userId, anchorId);
    await prisma.visionCreationSession.updateMany({
      where: { userId, anchorId, status: 'ACTIVE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    await cancelEndedRounds(prisma, userId, anchorId);
    const session = await prisma.visionCreationSession.findFirst({
      where: {
        userId,
        anchorId,
        ...(sessionId ? { id: sessionId } : {}),
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        vision: { status: 'ACTIVE' },
      },
      orderBy: { updatedAt: 'desc' },
      include: { rounds: { orderBy: { roundNumber: 'asc' }, include: conversationRoundInclude } },
    });
    if (!session) {
      if (sessionId) throw missing();
      return null;
    }
    for (const round of session.rounds) {
      if (
        ['QUEUED', 'RUNNING', 'PARTIAL'].includes(round.status) &&
        round.updatedAt.getTime() < Date.now() - STALE_JOB_MS
      ) {
        const expired = await prisma.visionGeneration.updateMany({
          where: {
            id: round.id,
            userId,
            updatedAt: round.updatedAt,
            status: { in: ['QUEUED', 'RUNNING', 'PARTIAL'] },
          },
          data: {
            status: 'FAILED',
            stage: 'interrupted',
            error: 'Generation was interrupted. Retry to keep the completed options.',
          },
        });
        if (expired.count) {
          round.status = 'FAILED';
          round.stage = 'interrupted';
          round.error = 'Generation was interrupted. Retry to keep the completed options.';
        }
      }
    }
    const refs = VisionReferencesSchema.safeParse(session.draftReferences);
    const references = await Promise.all(
      (refs.success ? refs.data : []).map(async ref => {
        const asset = await prisma.asset.findFirst({
          where: { id: ref.assetId, userId },
          select: { storageKey: true },
        });
        return { ...ref, imageUrl: await privatePreview(asset?.storageKey) };
      })
    );
    return {
      id: session.id,
      anchorId,
      visionId: session.visionId,
      status: session.status,
      description: session.description,
      draftPrompt: session.draftPrompt,
      references,
      selectedCandidateId: session.selectedCandidateId,
      viewedRoundId: session.viewedRoundId,
      rounds: await Promise.all(session.rounds.map(serializeVisionRound)),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async update(
    userId: string,
    anchorId: string,
    sessionId: string,
    input: z.infer<typeof UpdateVisionSessionSchema>
  ) {
    await this.anchor(userId, anchorId);
    if (input.references) await this.validateReferences(userId, input.references);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM vision_creation_sessions WHERE id = ${sessionId} AND user_id = ${userId} FOR UPDATE`;
      const session = await tx.visionCreationSession.findFirst({
        where: {
          id: sessionId,
          userId,
          anchorId,
          ...(input.status === 'SEALED'
            ? { OR: [{ status: 'ACTIVE', expiresAt: { gt: new Date() } }, { status: 'SEALED' }] }
            : { status: 'ACTIVE', expiresAt: { gt: new Date() } }),
          vision: { status: 'ACTIVE' },
        },
      });
      if (!session) throw missing();
      if (session.status === 'SEALED' && input.selectedCandidateId !== session.selectedCandidateId)
        throw new AppError(
          'This scene already kept another candidate.',
          409,
          'VISION_SESSION_SEALED'
        );
      const selectedCandidateId =
        input.selectedCandidateId === undefined
          ? session.selectedCandidateId
          : input.selectedCandidateId;
      if (selectedCandidateId) {
        const candidate = await tx.visionGenerationCandidate.findFirst({
          where: {
            id: selectedCandidateId,
            status: 'SUCCEEDED',
            asset: { userId },
            generation: { sessionId, userId, anchorId },
          },
          select: { assetId: true },
        });
        if (!candidate?.assetId)
          throw new AppError(
            'Choose an available candidate from this scene.',
            400,
            'INVALID_VISION_CANDIDATE'
          );
        if (
          input.status === 'SEALED' &&
          !(await tx.visionScene.findFirst({
            where: {
              visionId: session.visionId,
              userId,
              assetId: candidate.assetId,
              isArchived: false,
            },
          }))
        )
          throw new AppError(
            'Keep the chosen image on your board before completing this session.',
            409,
            'VISION_CANDIDATE_NOT_SEALED'
          );
      } else if (input.status === 'SEALED')
        throw new AppError('Choose an image before sealing.', 400, 'INVALID_VISION_CANDIDATE');
      if (session.status === 'SEALED') return;
      if (
        input.viewedRoundId &&
        !(await tx.visionGeneration.findFirst({
          where: { id: input.viewedRoundId, sessionId, userId, anchorId },
          select: { id: true },
        }))
      )
        throw new AppError('Version not found', 400, 'INVALID_VISION_ROUND');
      const { references, ...state } = input;
      await tx.visionCreationSession.update({
        where: { id: sessionId },
        data: { ...state, ...(references ? { draftReferences: references } : {}) },
      });
      if (input.status) await cancelEndedRounds(tx, userId, anchorId);
    });
    return input.status
      ? { id: sessionId, status: input.status }
      : this.read(userId, anchorId, sessionId);
  }

  async start(userId: string, anchorId: string, raw: VisionSceneGenerationInput) {
    const input = StartVisionSceneGenerationSchema.parse(raw);
    if (input.startAssetId || input.appearanceReferenceId)
      throw new AppError(
        'Use explicitly selected reference photos for this scene.',
        400,
        'INVALID_VISION_REFERENCES'
      );
    const access = await getMonetizationAccess(userId);
    if (!access.hasProAccess)
      throw new AppError('Vision generation requires access', 403, 'VISION_PREMIUM_REQUIRED');
    const anchor = await this.anchor(userId, anchorId);
    const fingerprint = requestFingerprint(input);
    const replay = await prisma.visionGeneration.findFirst({
      where: { id: input.idempotencyKey, userId, anchorId, vision: { status: 'ACTIVE' } },
    });
    if (replay) {
      const metadata = replay.plan as Record<string, unknown> | null;
      if (metadata?.requestFingerprint !== fingerprint)
        throw new AppError(
          'This request key was already used for another scene.',
          409,
          'VISION_IDEMPOTENCY_CONFLICT'
        );
      return { jobId: replay.id, enqueue: false, anchor };
    }
    const refs = input.references ?? [];
    await this.validateReferences(userId, refs);
    const vision = await prisma.vision.findFirst({
      where: { userId, anchorId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!vision) throw new AppError('Create your Vision first', 404, 'VISION_NOT_FOUND');
    try {
      const jobId = await prisma.$transaction(async tx => {
        // Serialize count, round numbering, and idempotency across API replicas.
        await tx.$queryRaw`SELECT id FROM visions WHERE id = ${vision.id} FOR UPDATE`;
        const duplicate = await tx.visionGeneration.findUnique({
          where: { id: input.idempotencyKey },
        });
        if (duplicate) {
          if (
            duplicate.userId !== userId ||
            duplicate.anchorId !== anchorId ||
            (duplicate.plan as Record<string, unknown> | null)?.requestFingerprint !== fingerprint
          )
            throw new AppError(
              'This request key was already used for another scene.',
              409,
              'VISION_IDEMPOTENCY_CONFLICT'
            );
          return duplicate.id;
        }
        if (
          (await tx.visionScene.count({
            where: { visionId: vision.id, userId, isArchived: false },
          })) >= VISION_MAX_IMAGES
        )
          throw new AppError('Your Vision board is full.', 400, 'VISION_IMAGE_LIMIT');
        const previous = await tx.visionGeneration.findFirst({
          where: { visionId: vision.id, userId, kind: 'SCENE' },
          orderBy: { setNumber: 'desc' },
        });
        if ((previous?.setNumber ?? 0) >= MAX_SCENE_REQUESTS)
          throw new AppError(
            'You have reached the limit for generated scenes on this Vision',
            409,
            'VISION_GENERATION_LIMIT'
          );
        const sessionId = input.sessionId ?? randomUUID();
        let session = await tx.visionCreationSession.findFirst({
          where: {
            id: sessionId,
            userId,
            anchorId,
            visionId: vision.id,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
        });
        if (!session && input.sessionId) throw missing();
        if (!session) {
          await tx.visionCreationSession.updateMany({
            where: { userId, anchorId, status: 'ACTIVE' },
            data: { status: 'ABANDONED' },
          });
          await cancelEndedRounds(tx, userId, anchorId);
          session = await tx.visionCreationSession.create({
            data: {
              id: sessionId,
              userId,
              anchorId,
              visionId: vision.id,
              description: input.sceneDescription,
              expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            },
          });
        }
        if (
          await tx.visionGeneration.findFirst({
            where: {
              sessionId,
              status: { in: ['QUEUED', 'RUNNING', 'PARTIAL'] },
              updatedAt: { gt: new Date(Date.now() - STALE_JOB_MS) },
            },
            select: { id: true },
          })
        )
          throw new AppError(
            'Your images are still being created.',
            409,
            'VISION_GENERATION_IN_PROGRESS'
          );
        if (input.parentCandidateId) {
          const parent = await tx.visionGenerationCandidate.findFirst({
            where: {
              id: input.parentCandidateId,
              status: 'SUCCEEDED',
              asset: { userId },
              generation: { sessionId, userId, anchorId, visionId: vision.id },
            },
            select: { assetId: true },
          });
          if (!parent?.assetId)
            throw new AppError(
              'This source image is unavailable. Choose another saved option.',
              400,
              'INVALID_VISION_CANDIDATE'
            );
        }
        const latestRound = await tx.visionGeneration.findFirst({
          where: { sessionId },
          orderBy: { roundNumber: 'desc' },
          select: { roundNumber: true },
        });
        const roundNumber = latestRound ? (latestRound.roundNumber ?? 0) + 1 : 0;
        await tx.visionGeneration.create({
          data: {
            id: input.idempotencyKey,
            userId,
            anchorId,
            visionId: vision.id,
            sessionId,
            roundNumber,
            operation: input.operation ?? 'CREATE',
            parentCandidateId: input.parentCandidateId ?? null,
            description: input.sceneDescription,
            kind: 'SCENE',
            setNumber: (previous?.setNumber ?? 0) + 1,
            status: 'QUEUED',
            stage: 'creating_images',
            plan: JSON.parse(
              JSON.stringify({
                scenes: buildVisionSceneVariantPlan(input.sceneDescription),
                ...(input.devImageModel ? { devImageModel: input.devImageModel } : {}),
                requestFingerprint: fingerprint,
              })
            ) as Prisma.InputJsonValue,
            references: { create: refs.map((ref, sortOrder) => ({ ...ref, sortOrder })) },
          },
        });
        await tx.visionCreationSession.update({
          where: { id: sessionId },
          data: {
            viewedRoundId: input.idempotencyKey,
            draftReferences: refs,
            draftPrompt: '',
            ...(roundNumber === 0 ? { description: input.sceneDescription } : {}),
          },
        });
        return input.idempotencyKey;
      });
      return { jobId, enqueue: true, anchor };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await prisma.visionGeneration.findFirst({
          where: { id: input.idempotencyKey, userId, anchorId },
        });
        if ((duplicate?.plan as Record<string, unknown> | null)?.requestFingerprint === fingerprint)
          return { jobId: input.idempotencyKey, enqueue: false, anchor };
        throw new AppError(
          'Generation request conflicted. Try again.',
          409,
          'VISION_GENERATION_CONFLICT'
        );
      }
      throw error;
    }
  }
}
export const visionConversationService = new VisionConversationService();
