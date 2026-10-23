import { z } from 'zod';
import { DEV_IMAGE_MODEL_IDS } from '../../services/image/devImageModels';

export const VISION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type VisionStatus = (typeof VISION_STATUSES)[number];
export const VISION_BOARD_LAYOUTS = ['CLASSIC', 'EDITORIAL', 'SCRAPBOOK'] as const;
export type VisionBoardLayout = (typeof VISION_BOARD_LAYOUTS)[number];
export type VisionNoteLayoutPositions = Partial<
  Record<'EDITORIAL' | 'SCRAPBOOK', { x: number; y: number } | null>
>;

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
  slotIndex?: number | null;
  focal?: { x: number; y: number } | null;
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
  boardLayout?: VisionBoardLayout;
  scenes: VisionSceneReadModel[];
  /** Notes are optional for compatibility with previously cached Vision reads. */
  notes?: VisionNoteReadModel[];
  seenToday: boolean;
  createdAt: string;
  updatedAt: string;
}

export const VISION_NOTE_STYLE_IDS = [
  'sticky_blush_pink',
  'sticky_butter_yellow',
  'sticky_sky_blue',
  'sticky_sage_green',
  'sticky_lavender',
  'sticky_peach',
  'sticky_warm_ivory',
  'sticky_rose_lined',
  'paper_ivory_torn',
  'paper_aged_parchment',
  'paper_handmade_cream',
  'paper_blush_torn',
  'paper_sage_handmade',
  'paper_white_deckled',
  'editorial_classic_cream',
  'editorial_powder_blue',
  'editorial_minimal_quote',
  'editorial_botanical_shadow',
  'editorial_coastal_illustration',
  'editorial_atmospheric_landscape',
  'editorial_vintage_letter',
  'editorial_golden_hour',
  'editorial_misty_mountains',
  'editorial_rose_editorial',
  'editorial_architectural',
  'editorial_midnight_editorial',
] as const;
export type VisionNoteStyleId = (typeof VISION_NOTE_STYLE_IDS)[number];
export const VISION_NOTE_FONT_IDS = ['handwritten', 'classic', 'modern'] as const;
export type VisionNoteFontId = (typeof VISION_NOTE_FONT_IDS)[number];
export const VISION_NOTE_MAX_CHARS = 200;
export const VISION_NOTE_MAX_ACTIVE = 24;
const VISION_NOTE_MIN_BOARD_ASPECT = 0.45;
const VISION_NOTE_MAX_BOARD_ASPECT = 2.65;

export interface VisionNotePresentation {
  styleId: VisionNoteStyleId;
  /** Optional so existing notes keep the font defined by their material preset. */
  fontId?: VisionNoteFontId;
  /** Normalized center coordinates and dimensions relative to the board. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  layerOrder: number;
}

export interface VisionNoteReadModel {
  id: string;
  visionId: string;
  content: { text: string };
  presentation: VisionNotePresentation;
  layoutPositions?: VisionNoteLayoutPositions | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

const VisionNoteTextSchema = z
  .string()
  .min(1)
  .superRefine((text, ctx) => {
    if (text.trim().length === 0)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Note text cannot be blank' });
    if (Array.from(text).length > VISION_NOTE_MAX_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Note text cannot exceed ${VISION_NOTE_MAX_CHARS} characters`,
      });
    }
  });

export const VisionNotePresentationSchema = z
  .object({
    styleId: z.enum(VISION_NOTE_STYLE_IDS),
    fontId: z.enum(VISION_NOTE_FONT_IDS).optional(),
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().min(0.12).max(0.65),
    height: z.number().finite().min(0.12).max(0.65),
    rotation: z.number().finite().min(-180).max(180),
    scale: z.number().finite().min(0.5).max(2),
    layerOrder: z.number().int().min(0).max(1000),
  })
  .strict()
  .superRefine((presentation, ctx) => {
    const radians = (presentation.rotation * Math.PI) / 180;
    // The board aspect changes with photo count. Use conservative bounds across
    // every supported board shape so persisted notes remain safe after images change.
    const halfWidth =
      (Math.abs(presentation.width * presentation.scale * Math.cos(radians)) +
        Math.abs(
          presentation.height *
            VISION_NOTE_MAX_BOARD_ASPECT *
            presentation.scale *
            Math.sin(radians)
        )) /
      2;
    const halfHeight =
      (Math.abs(presentation.height * presentation.scale * Math.cos(radians)) +
        Math.abs(
          (presentation.width / VISION_NOTE_MIN_BOARD_ASPECT) *
            presentation.scale *
            Math.sin(radians)
        )) /
      2;
    if (presentation.x < halfWidth || presentation.x > 1 - halfWidth)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['x'],
        message: 'Note must remain inside the Vision board',
      });
    if (presentation.y < halfHeight || presentation.y > 1 - halfHeight)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['y'],
        message: 'Note must remain inside the Vision board',
      });
  });

export const CreateVisionNoteSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    content: z.object({ text: VisionNoteTextSchema }).strict(),
    presentation: VisionNotePresentationSchema,
  })
  .strict();

const NoteLayoutPositionSchema = z
  .object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(6) })
  .strict()
  .nullable();
export const VisionNoteLayoutPositionsSchema = z
  .object({
    EDITORIAL: NoteLayoutPositionSchema.optional(),
    SCRAPBOOK: NoteLayoutPositionSchema.optional(),
  })
  .strict();

export const UpdateVisionNoteSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime().optional(),
    content: z.object({ text: VisionNoteTextSchema }).strict().optional(),
    presentation: VisionNotePresentationSchema.optional(),
    layoutPositions: VisionNoteLayoutPositionsSchema.optional(),
  })
  .strict()
  .refine(
    input =>
      input.content !== undefined ||
      input.presentation !== undefined ||
      input.layoutPositions !== undefined,
    'At least one note field is required'
  );

const VisionSceneAssetInputSchema = z
  .object({
    sourceType: z.enum(VISION_SCENE_SOURCES),
    assetId: z.string().min(1).max(200),
    prompt: z.string().max(2000).optional().nullable(),
    caption: z.string().trim().max(80).optional().nullable(),
  })
  .strict();

export const UpdateVisionSceneCaptionSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime().optional(),
    replacement: VisionSceneAssetInputSchema.optional(),
    caption: z.string().trim().max(80).nullable().optional(),
    slotIndex: z.number().int().min(0).max(7).nullable().optional(),
    focal: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    input =>
      input.caption !== undefined ||
      input.slotIndex !== undefined ||
      input.focal !== undefined ||
      input.replacement !== undefined,
    'At least one field is required'
  );

export const UpdateVisionSceneSlotsSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime().optional(),
    slots: z
      .array(
        z
          .object({
            sceneId: z.string().min(1).max(200),
            slotIndex: z.number().int().min(0).max(7),
          })
          .strict()
      )
      .min(1)
      .max(8)
      .refine(
        slots =>
          new Set(slots.map(s => s.sceneId)).size === slots.length &&
          new Set(slots.map(s => s.slotIndex)).size === slots.length,
        'Each photo and slot must be unique'
      ),
  })
  .strict();

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

export const CreateVisionSceneSchema = VisionSceneAssetInputSchema.extend({
  sortOrder: z.number().int().min(0).max(1000).optional(),
}).strict();

export const CreateVisionSchema = z.object({
  title: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().min(12).max(2000).optional().nullable(),
  scenes: z.array(CreateVisionSceneSchema).max(VISION_MAX_IMAGES).optional(),
});

export const StartVisionGenerationSchema = z
  .object({
    devImageModel: z.enum(DEV_IMAGE_MODEL_IDS).optional(),
    description: z.string().trim().min(12).max(2000),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{12,100}$/),
    // The server resolves this private asset itself. Clients never send raw
    // URLs or bytes to the generation endpoint.
    appearanceReferenceId: z.string().uuid().optional().nullable(),
  })
  .strict();

/**
 * One described scene for an existing Vision (two candidates come back). The first
 * image of a new Vision is described with the Vision's own description, so the
 * limit matches it.
 */
export const VISION_SCENE_DESCRIPTION_MAX = 2000;
export const VISION_REFERENCE_ROLES = ['identity', 'place', 'object', 'inspiration'] as const;
export const VISION_OPERATIONS = ['CREATE', 'EDIT', 'COMPOSE', 'VARIATE'] as const;
export const VisionReferenceSchema = z
  .object({
    assetId: z.string().uuid(),
    role: z.enum(VISION_REFERENCE_ROLES),
    label: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export const VisionReferencesSchema = z
  .array(VisionReferenceSchema)
  .max(5)
  .refine(
    refs => new Set(refs.map(ref => ref.assetId)).size === refs.length,
    'Choose distinct reference photos'
  );
export const StartVisionSceneGenerationSchema = z
  .object({
    devImageModel: z.enum(DEV_IMAGE_MODEL_IDS).optional(),
    sceneDescription: z.string().trim().min(6).max(VISION_SCENE_DESCRIPTION_MAX),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{12,100}$/),
    appearanceReferenceId: z.string().uuid().optional().nullable(),
    /** An uploaded asset of the person's real world today; the scene is that place transformed. */
    startAssetId: z.string().uuid().optional().nullable(),
    operation: z.enum(VISION_OPERATIONS).optional(),
    sessionId: z.string().uuid().optional(),
    parentCandidateId: z.string().uuid().optional(),
    references: VisionReferencesSchema.optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const operation = input.operation ?? 'CREATE';
    if (['EDIT', 'VARIATE'].includes(operation) && (!input.parentCandidateId || !input.sessionId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['parentCandidateId'],
        message: 'Choose an exact source candidate and session',
      });
    }
    if (['CREATE', 'COMPOSE'].includes(operation) && input.parentCandidateId) {
      ctx.addIssue({
        code: 'custom',
        path: ['parentCandidateId'],
        message: 'A new composition has no edit source',
      });
    }
    if (operation === 'COMPOSE' && (input.references?.length ?? 0) < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['references'],
        message: 'Composition requires at least two selected references',
      });
    }
    if (input.references !== undefined && (input.startAssetId || input.appearanceReferenceId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['references'],
        message: 'Use structured references or legacy references, not both',
      });
    }
  });
export type VisionSceneGenerationInput = z.infer<typeof StartVisionSceneGenerationSchema>;
export type VisionReferenceInput = z.infer<typeof VisionReferenceSchema>;
export type VisionOperation = (typeof VISION_OPERATIONS)[number];
export const CreateVisionSessionSchema = z
  .object({
    id: z.string().uuid(),
    description: z.string().trim().max(2000).default(''),
  })
  .strict();
export const UpdateVisionSessionSchema = z
  .object({
    description: z.string().max(2000).optional(),
    draftPrompt: z.string().max(2000).optional(),
    references: VisionReferencesSchema.optional(),
    selectedCandidateId: z.string().uuid().nullable().optional(),
    viewedRoundId: z
      .string()
      .regex(/^[A-Za-z0-9-]{12,100}$/)
      .nullable()
      .optional(),
    status: z.enum(['ABANDONED', 'SEALED']).optional(),
  })
  .strict();

export const CreateVisionAppearanceReferenceSchema = z
  .object({
    base64Image: z.string().min(1).max(7_000_000),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']).default('image/jpeg'),
    source: z.enum(VISION_APPEARANCE_REFERENCE_SOURCES),
    profileFingerprint: z.string().trim().min(8).max(256).optional().nullable(),
  })
  .strict();

export const UpdateVisionSchema = z.object({
  boardLayout: z.enum(VISION_BOARD_LAYOUTS).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
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
