import { NextFunction, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { redisClient } from '../../lib/redis';
import { requireVisualizeAccess } from '../../services/PracticeAccessService';
import {
  generateVisualizationSceneSuggestions,
  validateVisualizationScene,
  VISUALIZATION_SCENE_MAX_LENGTH,
} from '../../services/VisualizationSceneService';

const router = Router();

const generationLimiterStore =
  process.env.NODE_ENV === 'test' || !process.env.REDIS_URL
    ? undefined
    : new RedisStore({
        prefix: 'rl:visualize-scenes:',
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      });

const generationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  store: generationLimiterStore,
  message: {
    success: false,
    error: { code: 'SCENE_GENERATION_LIMIT', message: 'Try another suggestion later.' },
  },
});

const PutSceneSchema = z
  .object({
    currentText: z.string().trim().min(1).max(VISUALIZATION_SCENE_MAX_LENGTH),
    originalSuggestion: z.string().trim().min(1).max(VISUALIZATION_SCENE_MAX_LENGTH),
    generationSource: z.enum(['gemini', 'deterministic_fallback', 'user_edited']),
    generationVersion: z.string().min(1).max(100),
    clientUpdatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

function validate<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.errors
      .map(error => `${error.path.join('.')}: ${error.message}`)
      .join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

async function resolveOwnedAnchor(req: AuthRequest) {
  if (!req.user) throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  const user = await prisma.user.findUnique({
    where: { authUid: req.user.uid },
    select: {
      id: true,
      isComped: true,
      subscriptionStatus: true,
      subscriptionId: true,
      trialStartedAt: true,
    },
  });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  await requireVisualizeAccess(user);

  const anchor = await prisma.anchor.findFirst({
    where: { id: req.params.id, userId: user.id, isArchived: false },
    select: { id: true, intentionText: true, category: true },
  });
  if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
  return { user, anchor };
}

router.use(authMiddleware);

router.get(
  '/:id/visualization-scene',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { user, anchor } = await resolveOwnedAnchor(req);
      const scene = await prisma.visualizationScene.findFirst({
        where: { userId: user.id, anchorId: anchor.id },
      });
      res.json({ success: true, data: scene });
    } catch (error) {
      if (error instanceof AppError) return next(error);
      return next(new AppError('Failed to load visualization scene', 500, 'PRACTICE_ERROR'));
    }
  }
);

router.put(
  '/:id/visualization-scene',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const input = validate(PutSceneSchema, req.body ?? {});
      if (
        !validateVisualizationScene(input.currentText) ||
        !validateVisualizationScene(input.originalSuggestion)
      ) {
        throw new AppError(
          'Scene must contain one or two short sentences',
          400,
          'VALIDATION_ERROR'
        );
      }
      const clientUpdatedAt = new Date(input.clientUpdatedAt);
      if (clientUpdatedAt.getTime() > Date.now() + 5 * 60 * 1000) {
        throw new AppError('Invalid scene timestamp', 400, 'VALIDATION_ERROR');
      }
      const { user, anchor } = await resolveOwnedAnchor(req);
      const existing = await prisma.visualizationScene.findFirst({
        where: { userId: user.id, anchorId: anchor.id },
      });
      if (existing && existing.clientUpdatedAt.getTime() > clientUpdatedAt.getTime()) {
        res.json({ success: true, data: existing, stale: true });
        return;
      }

      const sceneData = {
        currentText: input.currentText,
        originalSuggestion: input.originalSuggestion,
        generationSource: input.generationSource,
        generationVersion: input.generationVersion,
        clientUpdatedAt,
      };

      if (existing) {
        const updated = await prisma.visualizationScene.updateMany({
          where: {
            userId: user.id,
            anchorId: anchor.id,
            clientUpdatedAt: { lte: clientUpdatedAt },
          },
          data: sceneData,
        });
        const authoritative = await prisma.visualizationScene.findUnique({
          where: { anchorId: anchor.id },
        });
        res.json({ success: true, data: authoritative, stale: updated.count === 0 });
        return;
      }

      let scene;
      try {
        scene = await prisma.visualizationScene.create({
          data: {
            userId: user.id,
            anchorId: anchor.id,
            ...sceneData,
          },
        });
      } catch (error) {
        if (
          !(
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002'
          )
        ) {
          throw error;
        }
        const updated = await prisma.visualizationScene.updateMany({
          where: {
            userId: user.id,
            anchorId: anchor.id,
            clientUpdatedAt: { lte: clientUpdatedAt },
          },
          data: sceneData,
        });
        scene = await prisma.visualizationScene.findUnique({ where: { anchorId: anchor.id } });
        res.json({ success: true, data: scene, stale: updated.count === 0 });
        return;
      }
      res.json({ success: true, data: scene, stale: false });
    } catch (error) {
      if (error instanceof AppError) return next(error);
      return next(new AppError('Failed to save visualization scene', 500, 'PRACTICE_ERROR'));
    }
  }
);

router.post(
  '/:id/visualization-scene/suggestions',
  generationLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { anchor } = await resolveOwnedAnchor(req);
      const result = await generateVisualizationSceneSuggestions({
        intention: anchor.intentionText,
        category: anchor.category,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AppError) return next(error);
      return next(new AppError('Failed to generate scene suggestions', 500, 'PRACTICE_ERROR'));
    }
  }
);

export default router;
