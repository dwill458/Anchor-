import { Router, Response, NextFunction } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getAuthenticatedUserId } from './authHelper';
import { visionService } from '../../../services/v2/VisionService';
import {
  CreateVisionSchema,
  UpdateVisionSchema,
  CreateVisionSceneSchema,
  ReorderScenesSchema,
  RecordVisionViewSchema,
  StartVisionGenerationSchema,
  CreateVisionAppearanceReferenceSchema,
} from '../../../domain/v2/vision';
import { visionGenerationService } from '../../../services/v2/VisionGenerationService';
import { visionAppearanceReferenceService } from '../../../services/v2/VisionAppearanceReferenceService';
import { uploadImageAssetFromBuffer } from '../../../services/StorageService';
import sharp from 'sharp';
import { z } from 'zod';
import {
  globalAiCeilingLimiter,
  visionGenerationLimiter,
  visionAppearanceLimiter,
} from '../../middleware/aiRateLimit';

const router = Router();
router.use(authMiddleware);
const AppearanceReferenceParamsSchema = z.object({ referenceId: z.string().uuid() }).strict();

// Appearance media is a private, explicit-use input—not a Vision scene and
// not a profile-photo mutation. Its signed preview is never persisted client-side.
router.get('/vision/appearance-reference', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await visionAppearanceReferenceService.latest(await getAuthenticatedUserId(req)) });
  } catch (error) { next(error); }
});

router.post(
  '/vision/appearance-reference',
  globalAiCeilingLimiter,
  visionAppearanceLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = validateBody(CreateVisionAppearanceReferenceSchema, req.body);
    const reference = await visionAppearanceReferenceService.create(await getAuthenticatedUserId(req), input);
    res.status(201).json({ success: true, data: reference });
  } catch (error) { next(error); }
});

router.delete('/vision/appearance-reference/:referenceId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const params = AppearanceReferenceParamsSchema.safeParse(req.params);
    if (!params.success) throw new AppError('Appearance reference is invalid', 400, 'INVALID_VISION_REFERENCE');
    await visionAppearanceReferenceService.destroy(params.data.referenceId, await getAuthenticatedUserId(req));
    res.json({ success: true, data: { success: true } });
  } catch (error) { next(error); }
});

function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

// ─────────────────────────────────────────────────────────────
// Anchor-scoped Vision endpoints
// ─────────────────────────────────────────────────────────────

router.get(
  '/anchors/:anchorId/vision',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { anchorId } = req.params;
      const clientTimeZone =
        (req.query.timeZone as string) || (req.headers['x-timezone'] as string) || 'UTC';

      const vision = await visionService.getAnchorVision(userId, anchorId, clientTimeZone);
      res.json({
        success: true,
        data: vision,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/anchors/:anchorId/vision',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { anchorId } = req.params;
      const input = validateBody(CreateVisionSchema, req.body);
      const clientTimeZone =
        (req.query.timeZone as string) || (req.headers['x-timezone'] as string) || 'UTC';

      const vision = await visionService.createAnchorVision(
        userId,
        anchorId,
        input,
        clientTimeZone
      );
      res.status(201).json({
        success: true,
        data: vision,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Vision Mutation endpoints
// ─────────────────────────────────────────────────────────────

router.get('/anchors/:anchorId/vision/generation', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    res.json({ success: true, data: await visionGenerationService.latest(userId, req.params.anchorId) });
  } catch (error) { next(error); }
});

router.post(
  '/anchors/:anchorId/vision/generation',
  globalAiCeilingLimiter,
  visionGenerationLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const input = validateBody(StartVisionGenerationSchema, req.body);
      const job = await visionGenerationService.start(userId, req.params.anchorId, input.description, input.idempotencyKey, input.appearanceReferenceId);
      res.status(202).json({ success: true, data: job });
    } catch (error) { next(error); }
  }
);

router.post(
  '/anchors/:anchorId/vision/generation/:jobId/retry',
  globalAiCeilingLimiter,
  visionGenerationLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const job = await visionGenerationService.retry(userId, req.params.anchorId, req.params.jobId);
      res.status(202).json({ success: true, data: job });
    } catch (error) { next(error); }
  }
);

router.patch('/visions/:visionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const { visionId } = req.params;
    const input = validateBody(UpdateVisionSchema, req.body);
    const clientTimeZone =
      (req.query.timeZone as string) || (req.headers['x-timezone'] as string) || 'UTC';

    const vision = await visionService.updateVision(userId, visionId, input, clientTimeZone);
    res.json({
      success: true,
      data: vision,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/visions/:visionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const { visionId } = req.params;

    const result = await visionService.archiveVision(userId, visionId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// Vision Scene endpoints
// ─────────────────────────────────────────────────────────────

router.post(
  '/visions/:visionId/scenes',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { visionId } = req.params;
      const input = validateBody(CreateVisionSceneSchema, req.body);

      const scene = await visionService.addScene(userId, visionId, input);
      res.status(201).json({
        success: true,
        data: scene,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/visions/:visionId/scenes/reorder',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { visionId } = req.params;
      const input = validateBody(ReorderScenesSchema, req.body);

      const scenes = await visionService.reorderScenes(userId, visionId, input);
      res.json({
        success: true,
        data: scenes,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/visions/:visionId/scenes/:sceneId',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { visionId, sceneId } = req.params;

      const result = await visionService.archiveScene(userId, visionId, sceneId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Seen-Today / View Tracking endpoint
// ─────────────────────────────────────────────────────────────

router.post(
  '/visions/:visionId/view',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { visionId } = req.params;
      const body = validateBody(RecordVisionViewSchema, req.body || {});
      const clientTimeZone =
        body.timeZone ||
        (req.query.timeZone as string) ||
        (req.headers['x-timezone'] as string) ||
        'UTC';

      const result = await visionService.recordVisionView(userId, visionId, clientTimeZone);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Asset Upload endpoint
// ─────────────────────────────────────────────────────────────

const MAX_VISION_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VISION_BASE64_LENGTH = Math.ceil((MAX_VISION_UPLOAD_BYTES * 4) / 3) + 128;
const VISION_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

const UploadAssetSchema = z
  .object({
    base64Image: z.string().min(1).max(MAX_VISION_BASE64_LENGTH),
    mimeType: z.enum(VISION_IMAGE_MIME_TYPES).default('image/png'),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

function decodeBase64Image(value: string, declaredMimeType: string): Buffer {
  const match = value.match(
    /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/
  );
  const payload = match ? match[2] : value;
  const embeddedMimeType = match?.[1] === 'image/jpg' ? 'image/jpeg' : match?.[1];
  const normalizedMimeType = declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType;

  if (embeddedMimeType && embeddedMimeType !== normalizedMimeType) {
    throw new AppError('Embedded image MIME type does not match mimeType', 400, 'VALIDATION_ERROR');
  }
  if (!payload || payload.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new AppError('base64Image is malformed', 400, 'VALIDATION_ERROR');
  }

  const buffer = Buffer.from(payload, 'base64');
  const normalizedPayload = payload.replace(/=+$/, '');
  const roundTrip = buffer.toString('base64').replace(/=+$/, '');
  if (
    !buffer.length ||
    normalizedPayload !== roundTrip ||
    buffer.length > MAX_VISION_UPLOAD_BYTES
  ) {
    throw new AppError(
      'base64Image is malformed or exceeds the 5MB limit',
      400,
      'VALIDATION_ERROR'
    );
  }

  return buffer;
}

router.post('/assets/upload', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const input = validateBody(UploadAssetSchema, req.body);
    const mimeType = input.mimeType || 'image/png';

    const buffer = decodeBase64Image(input.base64Image, mimeType);
    const imageMetadata = await sharp(buffer)
      .metadata()
      .catch(() => null);
    const actualMimeType =
      imageMetadata?.format === 'jpeg'
        ? 'image/jpeg'
        : imageMetadata?.format
          ? `image/${imageMetadata.format}`
          : null;
    if (!actualMimeType || actualMimeType !== mimeType) {
      throw new AppError(
        'base64Image is not a valid image of the declared MIME type',
        400,
        'VALIDATION_ERROR'
      );
    }

    const uploaded = await uploadImageAssetFromBuffer(buffer, userId, 'vision-assets', 0, {
      visibility: 'private',
      contentType: mimeType,
    });
    const asset = await visionService.createAsset(userId, {
      storageKey: uploaded.objectKey,
      mimeType,
      fileSizeBytes: buffer.length,
      metadata: input.metadata,
    });
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    next(error);
  }
});

export default router;
