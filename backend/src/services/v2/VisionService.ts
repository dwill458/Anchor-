import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { milestoneService } from './milestones/MilestoneService';
import { AppError } from '../../api/middleware/errorHandler';
import { resolveStorageKeyUrl } from '../StorageService';
import {
  VisionReadModel,
  VisionSceneReadModel,
  VisionSceneSource,
  VisionNoteReadModel,
  VisionNotePresentation,
  AssetReadModel,
  CreateVisionSchema,
  UpdateVisionSchema,
  CreateVisionSceneSchema,
  ReorderScenesSchema,
  VISION_MAX_IMAGES,
  VISION_NOTE_MAX_ACTIVE,
  CreateVisionNoteSchema,
  UpdateVisionNoteSchema,
  UpdateVisionSceneCaptionSchema,
} from '../../domain/v2/vision';
import { z } from 'zod';

export function normalizeTimeZone(timeZone: string): string {
  const normalized = timeZone.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format();
    return normalized;
  } catch {
    return 'UTC';
  }
}

export function computeLocalDateKey(date: Date, timeZone: string): string {
  try {
    const wallClockParts = new Intl.DateTimeFormat('en-US', {
      timeZone: normalizeTimeZone(timeZone),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(wallClockParts.find(value => value.type === type)?.value);
    return `${String(part('year')).padStart(4, '0')}-${String(part('month')).padStart(2, '0')}-${String(part('day')).padStart(2, '0')}`;
  } catch {
    // Fallback to UTC if timezone is unrecognized
    return date.toISOString().slice(0, 10);
  }
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toVisionNoteColumns(presentation: VisionNotePresentation) {
  return {
    styleId: presentation.styleId,
    ...(presentation.fontId ? { fontId: presentation.fontId } : {}),
    x: presentation.x,
    y: presentation.y,
    width: presentation.width,
    height: presentation.height,
    rotation: presentation.rotation,
    scale: presentation.scale,
    layerOrder: presentation.layerOrder,
  };
}

function sameVisionNotePayload(note: { text: string; styleId: string; fontId?: string | null; x: number; y: number; width: number; height: number; rotation: number; scale: number; layerOrder: number }, input: z.infer<typeof CreateVisionNoteSchema>): boolean {
  const p = input.presentation;
  return note.text === input.content.text && note.styleId === p.styleId && (note.fontId ?? undefined) === p.fontId && note.x === p.x && note.y === p.y && note.width === p.width && note.height === p.height && note.rotation === p.rotation && note.scale === p.scale && note.layerOrder === p.layerOrder;
}

export class VisionService {
  async getAnchorVision(
    userId: string,
    anchorId: string,
    clientTimeZone: string = 'UTC',
    now: Date = new Date()
  ): Promise<VisionReadModel | null> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true },
    });
    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    const vision = await prisma.vision.findFirst({
      where: { anchorId, userId, status: 'ACTIVE' },
      include: {
        scenes: {
          where: { isArchived: false },
          orderBy: { sortOrder: 'asc' },
          include: { asset: true },
        },
        views: {
          orderBy: { viewedAt: 'desc' },
          take: 20,
        },
        notes: {
          where: { isArchived: false },
          orderBy: [{ layerOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!vision) {
      return null;
    }

    const todayKey = computeLocalDateKey(now, clientTimeZone);
    const seenToday = vision.views.some(view => {
      if (view.localDateKey && view.localDateKey === todayKey) {
        return true;
      }
      return computeLocalDateKey(view.viewedAt, clientTimeZone) === todayKey;
    });

    const scenes: VisionSceneReadModel[] = await Promise.all(
      vision.scenes.map(async scene => {
        const resolvedImageUrl = scene.asset?.storageKey
          ? await resolveStorageKeyUrl(scene.asset.storageKey)
          : null;
        return {
          id: scene.id,
          visionId: scene.visionId,
          sourceType: scene.sourceType as VisionSceneSource,
          assetId: scene.assetId,
          resolvedImageUrl: resolvedImageUrl ?? null,
          prompt: scene.prompt,
          caption: scene.caption ?? null,
          slotIndex: scene.slotIndex ?? null,
          focal: scene.focalX != null && scene.focalY != null ? { x: scene.focalX, y: scene.focalY } : null,
          sortOrder: scene.sortOrder,
          isArchived: scene.isArchived,
          createdAt: scene.createdAt.toISOString(),
          updatedAt: scene.updatedAt.toISOString(),
        };
      })
    );

    const notes: VisionNoteReadModel[] = (vision.notes ?? []).map(note => ({
      id: note.id,
      visionId: note.visionId,
      content: { text: note.text },
      presentation: {
        styleId: note.styleId as VisionNotePresentation['styleId'],
        ...(note.fontId ? { fontId: note.fontId as NonNullable<VisionNotePresentation['fontId']> } : {}),
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        rotation: note.rotation,
        scale: note.scale,
        layerOrder: note.layerOrder,
      },
      isArchived: note.isArchived,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    }));

    return {
      id: vision.id,
      anchorId: vision.anchorId,
      title: vision.title,
      description: vision.description,
      status: vision.status as 'ACTIVE' | 'ARCHIVED',
      scenes,
      notes,
      seenToday,
      createdAt: vision.createdAt.toISOString(),
      updatedAt: vision.updatedAt.toISOString(),
    };
  }

  /** Creates an idempotent note and an empty active Vision atomically when needed. */
  async createNote(
    userId: string,
    anchorId: string,
    input: z.infer<typeof CreateVisionNoteSchema>,
    clientTimeZone: string = 'UTC',
  ): Promise<VisionReadModel> {
    const presentation = input.presentation;
    const anchor = await prisma.anchor.findFirst({ where: { id: anchorId, userId, isArchived: false }, select: { id: true } });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');

    const persistForVision = async (visionId: string) => prisma.$transaction(async tx => {
      // Serialize active-note count checks with note writes for this Anchor.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "anchors" WHERE "id" = ${anchorId} FOR UPDATE`);
      const activeVision = await tx.vision.findFirst({ where: { id: visionId, anchorId, userId, status: 'ACTIVE' }, select: { id: true } });
      if (!activeVision) throw new AppError('Active vision not found', 404, 'VISION_NOT_FOUND');
      const duplicate = await tx.visionNote.findUnique({ where: { visionId_clientRequestId: { visionId, clientRequestId: input.clientRequestId } } });
      if (duplicate) {
        if (!sameVisionNotePayload(duplicate, input)) throw new AppError('Request id was already used for a different note', 409, 'IDEMPOTENCY_CONFLICT');
        return visionId;
      }
      const count = await tx.visionNote.count({ where: { visionId, userId, isArchived: false } });
      if (count >= VISION_NOTE_MAX_ACTIVE) throw new AppError(`A Vision can contain up to ${VISION_NOTE_MAX_ACTIVE} active notes`, 400, 'VISION_NOTE_LIMIT');
      const saved = await tx.visionNote.create({ data: { id: randomUUID(), visionId, userId, clientRequestId: input.clientRequestId, text: input.content.text, ...toVisionNoteColumns(presentation), isArchived: false } });
      await tx.vision.updateMany({ where: { id: visionId, userId, firstCommittedAt: null }, data: { firstCommittedAt: saved.createdAt } });
      return visionId;
    });

    let active = await prisma.vision.findFirst({ where: { anchorId, userId, status: 'ACTIVE' }, select: { id: true } });
    let visionId: string;
    if (active) {
      visionId = await persistForVision(active.id);
    } else {
      try {
        visionId = await prisma.$transaction(async tx => {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "anchors" WHERE "id" = ${anchorId} FOR UPDATE`);
          const nowActive = await tx.vision.findFirst({ where: { anchorId, userId, status: 'ACTIVE' }, select: { id: true } });
          if (nowActive) {
            const duplicate = await tx.visionNote.findUnique({ where: { visionId_clientRequestId: { visionId: nowActive.id, clientRequestId: input.clientRequestId } } });
            if (duplicate) {
              if (!sameVisionNotePayload(duplicate, input)) throw new AppError('Request id was already used for a different note', 409, 'IDEMPOTENCY_CONFLICT');
              return nowActive.id;
            }
            const count = await tx.visionNote.count({ where: { visionId: nowActive.id, userId, isArchived: false } });
            if (count >= VISION_NOTE_MAX_ACTIVE) throw new AppError(`A Vision can contain up to ${VISION_NOTE_MAX_ACTIVE} active notes`, 400, 'VISION_NOTE_LIMIT');
            const saved = await tx.visionNote.create({ data: { id: randomUUID(), visionId: nowActive.id, userId, clientRequestId: input.clientRequestId, text: input.content.text, ...toVisionNoteColumns(presentation), isArchived: false } });
            await tx.vision.updateMany({ where: { id: nowActive.id, userId, firstCommittedAt: null }, data: { firstCommittedAt: saved.createdAt } });
            return nowActive.id;
          }
          const created = await tx.vision.create({ data: { id: randomUUID(), userId, anchorId, title: null, description: null, status: 'ACTIVE' }, select: { id: true } });
          const count = await tx.visionNote.count({ where: { visionId: created.id, userId, isArchived: false } });
          if (count >= VISION_NOTE_MAX_ACTIVE) throw new AppError(`A Vision can contain up to ${VISION_NOTE_MAX_ACTIVE} active notes`, 400, 'VISION_NOTE_LIMIT');
          const saved = await tx.visionNote.create({ data: { id: randomUUID(), visionId: created.id, userId, clientRequestId: input.clientRequestId, text: input.content.text, ...toVisionNoteColumns(presentation), isArchived: false } });
          await tx.vision.updateMany({ where: { id: created.id, userId, firstCommittedAt: null }, data: { firstCommittedAt: saved.createdAt } });
          return created.id;
        });
      } catch (error) {
        if (!isPrismaUniqueViolation(error)) throw error;
        active = await prisma.vision.findFirst({ where: { anchorId, userId, status: 'ACTIVE' }, select: { id: true } });
        if (!active) throw error;
        visionId = await persistForVision(active.id);
      }
    }
    const result = await this.getAnchorVision(userId, anchorId, clientTimeZone);
    if (!result || result.id !== visionId) throw new AppError('Failed to load created note', 500, 'VISION_NOTE_ERROR');
    void milestoneService.evaluateQuietly(userId, anchorId, { kind: 'vision', sourceEntityId: visionId });
    return result;
  }

  async updateNote(userId: string, visionId: string, noteId: string, input: z.infer<typeof UpdateVisionNoteSchema>, clientTimeZone = 'UTC'): Promise<VisionReadModel> {
    const vision = await this.getActiveVisionForNote(userId, visionId);
    const note = await prisma.visionNote.findFirst({ where: { id: noteId, visionId, userId, isArchived: false } });
    if (!note) throw new AppError('Vision note not found', 404, 'VISION_NOTE_NOT_FOUND');
    const data: Prisma.VisionNoteUpdateManyMutationInput = {};
    if (input.content) data.text = input.content.text;
    if (input.presentation) Object.assign(data, toVisionNoteColumns(input.presentation));
    const changed = await prisma.visionNote.updateMany({ where: { id: noteId, visionId, userId, isArchived: false }, data });
    if (!changed.count) throw new AppError('Vision note not found', 404, 'VISION_NOTE_NOT_FOUND');
    const result = await this.getAnchorVision(userId, vision.anchorId, clientTimeZone);
    if (!result) throw new AppError('Failed to load updated note', 500, 'VISION_NOTE_ERROR');
    return result;
  }

  async deleteNote(userId: string, visionId: string, noteId: string, clientTimeZone = 'UTC'): Promise<VisionReadModel> {
    const vision = await this.getActiveVisionForNote(userId, visionId);
    const note = await prisma.visionNote.findFirst({ where: { id: noteId, visionId, userId } });
    if (!note) throw new AppError('Vision note not found', 404, 'VISION_NOTE_NOT_FOUND');
    if (!note.isArchived) await prisma.visionNote.updateMany({ where: { id: noteId, visionId, userId, isArchived: false }, data: { isArchived: true } });
    const result = await this.getAnchorVision(userId, vision.anchorId, clientTimeZone);
    if (!result) throw new AppError('Failed to load deleted note', 500, 'VISION_NOTE_ERROR');
    return result;
  }

  async restoreNote(userId: string, visionId: string, noteId: string, clientTimeZone = 'UTC'): Promise<VisionReadModel> {
    const vision = await this.getActiveVisionForNote(userId, visionId);
    const note = await prisma.visionNote.findFirst({ where: { id: noteId, visionId, userId } });
    if (!note) throw new AppError('Vision note not found', 404, 'VISION_NOTE_NOT_FOUND');
    if (note.isArchived) await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "anchors" WHERE "id" = ${vision.anchorId} FOR UPDATE`);
      const currentNote = await tx.visionNote.findFirst({ where: { id: noteId, visionId, userId } });
      if (!currentNote) throw new AppError('Vision note not found', 404, 'VISION_NOTE_NOT_FOUND');
      if (!currentNote.isArchived) return;
      const count = await tx.visionNote.count({ where: { visionId, userId, isArchived: false } });
      if (count >= VISION_NOTE_MAX_ACTIVE) throw new AppError(`A Vision can contain up to ${VISION_NOTE_MAX_ACTIVE} active notes`, 400, 'VISION_NOTE_LIMIT');
      await tx.visionNote.updateMany({ where: { id: noteId, visionId, userId, isArchived: true }, data: { isArchived: false } });
    });
    const result = await this.getAnchorVision(userId, vision.anchorId, clientTimeZone);
    if (!result) throw new AppError('Failed to load restored note', 500, 'VISION_NOTE_ERROR');
    return result;
  }

  private async getActiveVisionForNote(userId: string, visionId: string) {
    const vision = await prisma.vision.findFirst({ where: { id: visionId, userId, status: 'ACTIVE' } });
    if (!vision) throw new AppError('Active vision not found', 404, 'VISION_NOT_FOUND');
    return vision;
  }

  async createAnchorVision(
    userId: string,
    anchorId: string,
    input: z.infer<typeof CreateVisionSchema>,
    clientTimeZone: string = 'UTC'
  ): Promise<VisionReadModel> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true },
    });
    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // A generated candidate is bound to the Vision that requested it.
    const existing = await prisma.vision.findFirst({
      where: { anchorId, userId, status: 'ACTIVE' },
    });

    if (input.scenes?.length) {
      if (new Set(input.scenes.map(scene => scene.assetId)).size !== input.scenes.length) {
        throw new AppError('Choose distinct images', 400, 'VALIDATION_ERROR');
      }
      for (const scene of input.scenes) {
        await this.validateSceneAsset(userId, anchorId, scene.assetId, scene.sourceType, existing?.id);
      }
    }

    let visionId: string;
    if (existing) {
      // Idempotently update title/description if provided
      const updated = await prisma.vision.update({
        where: { id: existing.id },
        data: {
          title: input.title !== undefined ? input.title : existing.title,
          description: input.description !== undefined ? input.description : existing.description,
        },
      });
      visionId = updated.id;
    } else {
      try {
        const created = await prisma.vision.create({
          data: {
            id: randomUUID(), userId, anchorId,
            title: input.title ?? null, description: input.description ?? null, status: 'ACTIVE',
          },
        });
        visionId = created.id;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        const concurrent = await prisma.vision.findFirst({ where: { anchorId, userId, status: 'ACTIVE' } });
        if (!concurrent) throw error;
        const updated = await prisma.vision.update({
          where: { id: concurrent.id },
          data: { title: input.title ?? concurrent.title, description: input.description ?? concurrent.description },
        });
        visionId = updated.id;
      }
    }

    // If scenes were supplied, add only assets not already selected. Replayed saves are idempotent.
    if (input.scenes && input.scenes.length > 0) {
      const alreadySelected = await prisma.visionScene.findMany({
        where: { visionId, isArchived: false }, select: { assetId: true },
      });
      const selectedIds = new Set(alreadySelected.map(scene => scene.assetId));
      const missing = input.scenes.filter(scene => !selectedIds.has(scene.assetId));
      if (alreadySelected.length + missing.length > VISION_MAX_IMAGES) throw new AppError(`A Vision can contain up to ${VISION_MAX_IMAGES} images`, 400, 'VISION_IMAGE_LIMIT');
      for (let i = 0; i < input.scenes.length; i++) {
        const scene = input.scenes[i];
        if (selectedIds.has(scene.assetId)) continue;
        try {
          await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM visions WHERE id = ${visionId} FOR UPDATE`;
            await tx.visionScene.create({
              data: {
                id: randomUUID(), visionId, userId, sourceType: scene.sourceType,
                assetId: scene.assetId ?? null, prompt: scene.prompt ?? null, caption: scene.caption ?? null,
                sortOrder: scene.sortOrder ?? i, isArchived: false,
              },
            });
            await milestoneService.captureVisionCommit(userId, anchorId, visionId, tx);
          });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        }
        selectedIds.add(scene.assetId);
      }
    }

    const result = await this.getAnchorVision(userId, anchorId, clientTimeZone);
    if (!result) {
      throw new AppError('Failed to load created vision', 500, 'VISION_ERROR');
    }
    void milestoneService.evaluateQuietly(userId, anchorId, { kind: 'vision', sourceEntityId: visionId });
    return result;
  }

  async updateVision(
    userId: string,
    visionId: string,
    input: z.infer<typeof UpdateVisionSchema>,
    clientTimeZone: string = 'UTC'
  ): Promise<VisionReadModel> {
    const vision = await prisma.vision.findFirst({
      where: { id: visionId, userId },
    });
    if (!vision) {
      throw new AppError('Vision not found', 404, 'VISION_NOT_FOUND');
    }

    const updateData: Prisma.VisionUpdateInput = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;

    if (input.status !== undefined) {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "anchors" WHERE "id" = ${vision.anchorId} FOR UPDATE`);
        await tx.vision.update({ where: { id: visionId }, data: updateData });
      });
    } else {
      await prisma.vision.update({ where: { id: visionId }, data: updateData });
    }

    const refreshed = await this.getAnchorVision(userId, vision.anchorId, clientTimeZone);
    if (!refreshed) {
      // If archived, getAnchorVision returns null, so construct archival representation
      return {
        id: vision.id,
        anchorId: vision.anchorId,
        title: input.title !== undefined ? input.title : vision.title,
        description: input.description !== undefined ? input.description : vision.description,
        status: (input.status || vision.status) as 'ACTIVE' | 'ARCHIVED',
        scenes: [],
        seenToday: false,
        createdAt: vision.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return refreshed;
  }

  async archiveVision(userId: string, visionId: string): Promise<{ success: boolean }> {
    const vision = await prisma.vision.findFirst({
      where: { id: visionId, userId },
    });
    if (!vision) {
      throw new AppError('Vision not found', 404, 'VISION_NOT_FOUND');
    }

    await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "anchors" WHERE "id" = ${vision.anchorId} FOR UPDATE`);
      await tx.vision.update({ where: { id: visionId }, data: { status: 'ARCHIVED' } });
    });

    return { success: true };
  }

  async addScene(
    userId: string,
    visionId: string,
    input: z.infer<typeof CreateVisionSceneSchema>
  ): Promise<VisionSceneReadModel> {
    const vision = await prisma.vision.findFirst({
      where: { id: visionId, userId, status: 'ACTIVE' },
    });
    if (!vision) {
      throw new AppError('Active vision not found', 404, 'VISION_NOT_FOUND');
    }

    const existing = await prisma.visionScene.findFirst({
      where: { visionId, userId, assetId: input.assetId, isArchived: false },
      include: { asset: true },
    });
    if (existing) {
      await milestoneService.captureVisionCommit(userId, vision.anchorId, visionId);
      const resolvedImageUrl = existing.asset?.storageKey ? await resolveStorageKeyUrl(existing.asset.storageKey) : null;
      return {
        id: existing.id, visionId, sourceType: existing.sourceType as VisionSceneSource,
        assetId: existing.assetId, resolvedImageUrl: resolvedImageUrl ?? null, prompt: existing.prompt, caption: existing.caption ?? null,
        sortOrder: existing.sortOrder, isArchived: false,
        createdAt: existing.createdAt.toISOString(), updatedAt: existing.updatedAt.toISOString(),
      };
    }

    const count = await prisma.visionScene.count({ where: { visionId, isArchived: false } });
    if (count >= VISION_MAX_IMAGES) throw new AppError(`A Vision can contain up to ${VISION_MAX_IMAGES} images`, 400, 'VISION_IMAGE_LIMIT');
    await this.validateSceneAsset(userId, vision.anchorId, input.assetId, input.sourceType, vision.id);

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const maxScene = await prisma.visionScene.findFirst({
        where: { visionId, isArchived: false },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      sortOrder = maxScene ? maxScene.sortOrder + 1 : 0;
    }

    const scene = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM visions WHERE id = ${visionId} FOR UPDATE`;
      const committed = await tx.visionScene.create({
        data: {
          id: randomUUID(),
          visionId,
          userId,
          sourceType: input.sourceType,
          assetId: input.assetId ?? null,
          prompt: input.prompt ?? null,
          caption: input.caption ?? null,
          sortOrder,
          isArchived: false,
        },
        include: { asset: true },
      });
      await milestoneService.captureVisionCommit(userId, vision.anchorId, visionId, tx);
      return committed;
    });

    void milestoneService.evaluateQuietly(userId, vision.anchorId, { kind: 'vision', sourceEntityId: visionId });
    const resolvedImageUrl = scene.asset?.storageKey
      ? await resolveStorageKeyUrl(scene.asset.storageKey)
      : null;

    return {
      id: scene.id,
      visionId: scene.visionId,
      sourceType: scene.sourceType as VisionSceneSource,
      assetId: scene.assetId,
      resolvedImageUrl: resolvedImageUrl ?? null,
      prompt: scene.prompt,
          caption: scene.caption ?? null,
      sortOrder: scene.sortOrder,
      isArchived: scene.isArchived,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    };
  }

  private async validateSceneAsset(userId: string, anchorId: string, assetId: string, sourceType: VisionSceneSource, visionId?: string): Promise<void> {
    const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
    if (!asset) throw new AppError('Asset not found or not owned by user', 404, 'ASSET_NOT_FOUND');
    if (sourceType === 'AI_GENERATED') {
      const candidate = await prisma.visionGenerationCandidate.findFirst({
        where: { assetId, generation: { userId, anchorId, visionId: visionId ?? '' } }, select: { id: true },
      });
      if (!candidate) throw new AppError('Generated image does not belong to this Anchor', 400, 'INVALID_VISION_CANDIDATE');
    } else if (!asset.storageKey.includes('vision-assets')) {
      throw new AppError('Uploaded image is not a Vision asset', 400, 'INVALID_VISION_ASSET');
    }
  }

  async reorderScenes(
    userId: string,
    visionId: string,
    input: z.infer<typeof ReorderScenesSchema>
  ): Promise<VisionSceneReadModel[]> {
    const vision = await prisma.vision.findFirst({
      where: { id: visionId, userId, status: 'ACTIVE' },
    });
    if (!vision) {
      throw new AppError('Active vision not found', 404, 'VISION_NOT_FOUND');
    }

    const activeScenes = await prisma.visionScene.findMany({
      where: { visionId, userId, isArchived: false }, select: { id: true },
    });
    const existingIds = activeScenes.map(scene => scene.id).sort();
    const requestedIds = input.sceneOrders.map(item => item.id).sort();
    const requestedOrders = input.sceneOrders.map(item => item.sortOrder).sort((a, b) => a - b);
    if (JSON.stringify(existingIds) !== JSON.stringify(requestedIds) ||
        requestedOrders.some((order, index) => order !== index)) {
      throw new AppError('Image order must include every active image exactly once', 400, 'INVALID_VISION_ORDER');
    }

    await prisma.$transaction(
      input.sceneOrders.map(item =>
        prisma.visionScene.updateMany({
          where: { id: item.id, visionId, userId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    const scenes = await prisma.visionScene.findMany({
      where: { visionId, isArchived: false },
      orderBy: { sortOrder: 'asc' },
      include: { asset: true },
    });

    return Promise.all(
      scenes.map(async scene => {
        const resolvedImageUrl = scene.asset?.storageKey
          ? await resolveStorageKeyUrl(scene.asset.storageKey)
          : null;
        return {
          id: scene.id,
          visionId: scene.visionId,
          sourceType: scene.sourceType as VisionSceneSource,
          assetId: scene.assetId,
          resolvedImageUrl: resolvedImageUrl ?? null,
          prompt: scene.prompt,
          caption: scene.caption ?? null,
          sortOrder: scene.sortOrder,
          isArchived: scene.isArchived,
          createdAt: scene.createdAt.toISOString(),
          updatedAt: scene.updatedAt.toISOString(),
        };
      })
    );
  }

  async archiveScene(
    userId: string,
    visionId: string,
    sceneId: string
  ): Promise<{ success: boolean }> {
    const scene = await prisma.visionScene.findFirst({
      where: { id: sceneId, visionId, userId },
    });
    if (!scene) {
      throw new AppError('Scene not found', 404, 'SCENE_NOT_FOUND');
    }

    if (!scene.isArchived) {
      const count = await prisma.visionScene.count({ where: { visionId, userId, isArchived: false } });
      if (count <= 1) throw new AppError('Keep at least one image in your Vision', 400, 'VISION_IMAGE_MINIMUM');
    }

    await prisma.visionScene.update({
      where: { id: sceneId },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async updateSceneCaption(userId: string, visionId: string, sceneId: string, input: z.infer<typeof UpdateVisionSceneCaptionSchema>, clientTimeZone = 'UTC'): Promise<VisionReadModel> {
    const vision = await prisma.vision.findFirst({ where: { id: visionId, userId, status: 'ACTIVE' }, select: { id: true, anchorId: true } });
    if (!vision) throw new AppError('Active vision not found', 404, 'VISION_NOT_FOUND');
    const scene = await prisma.visionScene.findFirst({ where: { id: sceneId, visionId, userId, isArchived: false }, select: { id: true } });
    if (!scene) throw new AppError('Active Vision image not found', 404, 'SCENE_NOT_FOUND');
    const data: { caption?: string | null; slotIndex?: number | null; focalX?: number | null; focalY?: number | null } = {};
    if (input.caption !== undefined) data.caption = input.caption?.trim() || null;
    if (input.slotIndex !== undefined) data.slotIndex = input.slotIndex;
    if (input.focal !== undefined) { data.focalX = input.focal?.x ?? null; data.focalY = input.focal?.y ?? null; }
    await prisma.visionScene.updateMany({ where: { id: sceneId, visionId, userId, isArchived: false }, data });
    const result = await this.getAnchorVision(userId, vision.anchorId, clientTimeZone);
    if (!result) throw new AppError('Failed to load updated Vision image', 500, 'VISION_ERROR');
    return result;
  }

  async recordVisionView(
    userId: string,
    visionId: string,
    clientTimeZone: string = 'UTC',
    now: Date = new Date()
  ): Promise<{ visionId: string; viewedAt: string; seenToday: boolean; localDateKey: string }> {
    const vision = await prisma.vision.findFirst({
      where: { id: visionId, userId, status: 'ACTIVE' },
    });
    if (!vision) {
      throw new AppError('Active vision not found', 404, 'VISION_NOT_FOUND');
    }

    const normalizedTimeZone = normalizeTimeZone(clientTimeZone);
    const localDateKey = computeLocalDateKey(now, normalizedTimeZone);

    const view = await prisma.visionView.create({
      data: {
        id: randomUUID(),
        visionId,
        userId,
        viewedAt: now,
        localDateKey,
        timeZone: normalizedTimeZone,
      },
    });

    return {
      visionId: view.visionId,
      viewedAt: view.viewedAt.toISOString(),
      seenToday: true,
      localDateKey,
    };
  }

  async createAsset(
    userId: string,
    input: {
      storageKey: string;
      mimeType: string;
      fileSizeBytes?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<AssetReadModel> {
    const asset = await prisma.asset.create({
      data: {
        id: randomUUID(),
        userId,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    const resolvedUrl = (await resolveStorageKeyUrl(asset.storageKey)) || null;

    return {
      id: asset.id,
      userId: asset.userId,
      storageKey: asset.storageKey,
      resolvedUrl,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes,
      metadata: input.metadata ?? null,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}

export const visionService = new VisionService();
