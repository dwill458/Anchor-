import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReflectionMood, ReflectionPromptType, ReflectionSource } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { reflectionService } from '../../services/ReflectionService';
import {
  requireChartReflectionWritesEnabled,
  requireChartInitialized,
} from '../../config/chartFlags';

const router = Router();
const StructuredContentSchema = z
  .object({
    whatHelped: z.string().max(1000).optional(),
    whatLearned: z.string().max(1000).optional(),
  })
  .strict();
const CreateSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(200),
    source: z.nativeEnum(ReflectionSource),
    promptType: z.nativeEnum(ReflectionPromptType),
    promptVersion: z.number().int().min(1).max(100),
    body: z.string().max(1000).optional(),
    structuredContent: StructuredContentSchema.optional(),
    moodBefore: z.nativeEnum(ReflectionMood).optional(),
    moodAfter: z.nativeEnum(ReflectionMood).optional(),
    practiceSessionId: z.string().min(1).max(200).optional(),
    anchorId: z.string().min(1).max(200).optional(),
    courseId: z.string().min(1).max(200).optional(),
    waypointId: z.string().min(1).max(200).optional(),
  })
  .strict();
const UpdateSchema = z
  .object({
    body: z.string().max(1000).optional(),
    structuredContent: StructuredContentSchema.optional(),
    moodAfter: z.nativeEnum(ReflectionMood).optional(),
    aiConsentGranted: z.boolean().optional(),
  })
  .strict();

async function requireUser(req: AuthRequest): Promise<{ id: string; chartSchemaVersion: number }> {
  if (!req.user?.uid) throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  const user = await prisma.user.findUnique({
    where: { authUid: req.user.uid },
    select: { id: true, chartSchemaVersion: true },
  });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  requireChartInitialized(user.chartSchemaVersion);
  return user;
}

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.errors
      .map(error => `${error.path.join('.')}: ${error.message}`)
      .join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartReflectionWritesEnabled();
    const user = await requireUser(req);
    const data = await reflectionService.create(user.id, validate(CreateSchema, req.body ?? {}));
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:reflectionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartReflectionWritesEnabled();
    const user = await requireUser(req);
    const data = await reflectionService.update(
      user.id,
      req.params.reflectionId,
      validate(UpdateSchema, req.body ?? {})
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete('/:reflectionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartReflectionWritesEnabled();
    const user = await requireUser(req);
    await reflectionService.delete(user.id, req.params.reflectionId);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
