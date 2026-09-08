import { z } from 'zod';

export const VISION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type VisionStatus = (typeof VISION_STATUSES)[number];

export const VISION_SCENE_SOURCES = ['USER_UPLOAD', 'AI_GENERATED'] as const;
export type VisionSceneSource = (typeof VISION_SCENE_SOURCES)[number];

export interface VisionSceneReadModel {
  id: string;
  visionId: string;
  sourceType: VisionSceneSource;
  assetId: string | null;
  resolvedImageUrl: string | null;
  prompt: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VisionReadModel {
  id: string;
  anchorId: string;
  title: string | null;
  description: string | null;
  status: VisionStatus;
  scenes: VisionSceneReadModel[];
  seenToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetReadModel {
  id: string;
  userId: string;
  storageKey: string;
  resolvedUrl: string | null;
  mimeType: string;
  fileSizeBytes: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// Validation schemas
export const TimeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(value => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Must be a valid IANA time zone');

export const CreateVisionSceneSchema = z
  .object({
    sourceType: z.enum(VISION_SCENE_SOURCES),
    // Vision scenes always point at an owned Asset. This keeps private image
    // storage keys server-owned and avoids persisting client-controlled URLs.
    assetId: z.string().min(1).max(200),
    prompt: z.string().max(2000).optional().nullable(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const CreateVisionSchema = z.object({
  title: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  scenes: z.array(CreateVisionSceneSchema).max(20).optional(),
});

export const UpdateVisionSchema = z.object({
  title: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(VISION_STATUSES).optional(),
});

export const ReorderScenesSchema = z.object({
  sceneOrders: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: z.number().int().min(0).max(1000),
      })
    )
    .min(1)
    .max(50),
});

export const RecordVisionViewSchema = z.object({
  timeZone: TimeZoneSchema.optional(),
});
