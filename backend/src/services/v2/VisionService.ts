import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';
import { resolveStorageKeyUrl } from '../StorageService';
import {
  VisionReadModel,
  VisionSceneReadModel,
  AssetReadModel,
  CreateVisionSchema,
  UpdateVisionSchema,
  CreateVisionSceneSchema,
  ReorderScenesSchema,
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
          sourceType: scene.sourceType as 'USER_UPLOAD' | 'AI_GENERATED',
          assetId: scene.assetId,
          resolvedImageUrl: resolvedImageUrl ?? null,
          prompt: scene.prompt,
          sortOrder: scene.sortOrder,
          isArchived: scene.isArchived,
          createdAt: scene.createdAt.toISOString(),
          updatedAt: scene.updatedAt.toISOString(),
        };
      })
    );

    return {
      id: vision.id,
      anchorId: vision.anchorId,
      title: vision.title,
      description: vision.description,
      status: vision.status as 'ACTIVE' | 'ARCHIVED',
      scenes,
      seenToday,
      createdAt: vision.createdAt.toISOString(),
      updatedAt: vision.updatedAt.toISOString(),
    };
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

    // Check if an active Vision already exists
    const existing = await prisma.vision.findFirst({
      where: { anchorId, userId, status: 'ACTIVE' },
    });

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
      const created = await prisma.vision.create({
        data: {
          id: randomUUID(),
          userId,
          anchorId,
          title: input.title ?? null,
          description: input.description ?? null,
          status: 'ACTIVE',
        },
      });
      visionId = created.id;
    }

    // If scenes were supplied, create them
    if (input.scenes && input.scenes.length > 0) {
      for (let i = 0; i < input.scenes.length; i++) {
        const scene = input.scenes[i];
        if (scene.assetId) {
          const asset = await prisma.asset.findFirst({
            where: { id: scene.assetId, userId },
          });
          if (!asset) {
            throw new AppError('Asset not found or not owned by user', 404, 'ASSET_NOT_FOUND');
          }
        }
        await prisma.visionScene.create({
          data: {
            id: randomUUID(),
            visionId,
            userId,
            sourceType: scene.sourceType,
            assetId: scene.assetId ?? null,
            prompt: scene.prompt ?? null,
            sortOrder: scene.sortOrder ?? i,
            isArchived: false,
          },
        });
      }
    }

    const result = await this.getAnchorVision(userId, anchorId, clientTimeZone);
    if (!result) {
      throw new AppError('Failed to load created vision', 500, 'VISION_ERROR');
    }
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

    await prisma.vision.update({
      where: { id: visionId },
      data: updateData,
    });

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

    await prisma.vision.update({
      where: { id: visionId },
      data: { status: 'ARCHIVED' },
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

    if (input.assetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: input.assetId, userId },
      });
      if (!asset) {
        throw new AppError('Asset not found or not owned by user', 404, 'ASSET_NOT_FOUND');
      }
    }

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const maxScene = await prisma.visionScene.findFirst({
        where: { visionId, isArchived: false },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      sortOrder = maxScene ? maxScene.sortOrder + 1 : 0;
    }

    const scene = await prisma.visionScene.create({
      data: {
        id: randomUUID(),
        visionId,
        userId,
        sourceType: input.sourceType,
        assetId: input.assetId ?? null,
        prompt: input.prompt ?? null,
        sortOrder,
        isArchived: false,
      },
      include: { asset: true },
    });

    const resolvedImageUrl = scene.asset?.storageKey
      ? await resolveStorageKeyUrl(scene.asset.storageKey)
      : null;

    return {
      id: scene.id,
      visionId: scene.visionId,
      sourceType: scene.sourceType as 'USER_UPLOAD' | 'AI_GENERATED',
      assetId: scene.assetId,
      resolvedImageUrl: resolvedImageUrl ?? null,
      prompt: scene.prompt,
      sortOrder: scene.sortOrder,
      isArchived: scene.isArchived,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    };
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
          sourceType: scene.sourceType as 'USER_UPLOAD' | 'AI_GENERATED',
          assetId: scene.assetId,
          resolvedImageUrl: resolvedImageUrl ?? null,
          prompt: scene.prompt,
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

    await prisma.visionScene.update({
      where: { id: sceneId },
      data: { isArchived: true },
    });

    return { success: true };
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
