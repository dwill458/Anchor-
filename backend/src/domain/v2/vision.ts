import { z } from 'zod';
import { DEV_IMAGE_MODEL_IDS } from '../../services/image/devImageModels';

export const VISION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type VisionStatus = (typeof VISION_STATUSES)[number];

export const VISION_SCENE_SOURCES = ['USER_UPLOAD', 'AI_GENERATED', 'USER_CAMERA'] as const;
export type VisionSceneSource = (typeof VISION_SCENE_SOURCES)[number];

export interface VisionSceneReadModel {
  id: string;
  visionId: string;
  sourceType: VisionSceneSource;
  assetId: string | null;
  resolvedImageUrl: string | null;
  prompt: string | null;
  caption: string | null;
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

export const VISION_APPEARANCE_REFERENCE_SOURCES = ['PROFILE', 'CUSTOM'] as const;
export type VisionAppearanceReferenceSource = (typeof VISION_APPEARANCE_REFERENCE_SOURCES)[number];

export interface VisionAppearanceReferenceReadModel {
  id: string;
  source: VisionAppearanceReferenceSource;
  previewUrl: string | null;
  expiresAt: string | null;
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

/** A Vision is a board of at most this many photographs (the app composes 0-8). */
export const VISION_MAX_IMAGES = 8;

export const CreateVisionSceneSchema = z
  .object({
    sourceType: z.enum(VISION_SCENE_SOURCES),
    // Vision scenes always point at an owned Asset. This keeps private image
    // storage keys server-owned and avoids persisting client-controlled URLs.
    assetId: z.string().min(1).max(200),
    prompt: z.string().max(2000).optional().nullable(),
    caption: z.string().trim().max(80).optional().nullable(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const CreateVisionSchema = z.object({
  title: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().min(12).max(2000).optional().nullable(),
  scenes: z.array(CreateVisionSceneSchema).max(VISION_MAX_IMAGES).optional(),
});

export const StartVisionGenerationSchema = z.object({
  devImageModel: z.enum(DEV_IMAGE_MODEL_IDS).optional(),
  description: z.string().trim().min(12).max(2000),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{12,100}$/),
  // The server resolves this private asset itself. Clients never send raw
  // URLs or bytes to the generation endpoint.
  appearanceReferenceId: z.string().uuid().optional().nullable(),
}).strict();

/**
 * One described scene for an existing Vision (two candidates come back). The first
 * image of a new Vision is described with the Vision's own description, so the
 * limit matches it.
 */
export const VISION_SCENE_DESCRIPTION_MAX = 2000;
export const StartVisionSceneGenerationSchema = z.object({
  devImageModel: z.enum(DEV_IMAGE_MODEL_IDS).optional(),
  sceneDescription: z.string().trim().min(6).max(VISION_SCENE_DESCRIPTION_MAX),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{12,100}$/),
  appearanceReferenceId: z.string().uuid().optional().nullable(),
  /** An uploaded asset of the person's real world today; the scene is that place transformed. */
  startAssetId: z.string().uuid().optional().nullable(),
}).strict();

export const CreateVisionAppearanceReferenceSchema = z.object({
  base64Image: z.string().min(1).max(7_000_000),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']).default('image/jpeg'),
  source: z.enum(VISION_APPEARANCE_REFERENCE_SOURCES),
  profileFingerprint: z.string().trim().min(8).max(256).optional().nullable(),
}).strict();

export const UpdateVisionSchema = z.object({
  title: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().min(12).max(2000).optional().nullable(),
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
    .max(VISION_MAX_IMAGES),
});

export const RecordVisionViewSchema = z.object({
  timeZone: TimeZoneSchema.optional(),
});
