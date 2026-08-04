import { NextFunction, Response, Router } from 'express';
import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import {
  requireChartInitialized,
  requireChartPlannerEnabled,
  requireChartWriteEnabled,
} from '../../config/chartFlags';
import { coursePlannerService } from '../../services/CoursePlannerService';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { prisma } from '../../lib/prisma';
import { redisClient } from '../../lib/redis';

const router = Router();
const IdempotencyKey = z.string().trim().min(1).max(200);
const GenerateSchema = z
  .object({ destinationText: z.string().trim().min(1).max(140), idempotencyKey: IdempotencyKey })
  .strict();
const AcceptSchema = z.object({ idempotencyKey: IdempotencyKey }).strict();
const plannerLimiterStore =
  process.env.NODE_ENV === 'test' || !process.env.REDIS_URL
    ? undefined
    : new RedisStore({
        prefix: 'rl:chart-plan:hourly:',
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      });
const plannerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  message: { error: 'Too many planning requests' },
  store: plannerLimiterStore,
});

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('Planner input is invalid', 400, 'VALIDATION_ERROR');
  return parsed.data;
}

interface PlannerRouteUser {
  id: string;
  chartSchemaVersion: number;
  isComped: boolean;
  subscriptionStatus: string;
  subscriptionId: string | null;
  trialStartedAt: Date | null;
}

/**
 * Entitlement inputs are read from the database on every request. Entitlement
 * and quota are never taken from the client.
 */
async function resolveUser(req: AuthRequest): Promise<PlannerRouteUser> {
  if (!req.user?.uid) throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  const user = await prisma.user.findUnique({
    where: { authUid: req.user.uid },
    select: {
      id: true,
      chartSchemaVersion: true,
      isComped: true,
      subscriptionStatus: true,
      subscriptionId: true,
      trialStartedAt: true,
    },
  });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
}

router.use(authMiddleware);
router.use(plannerLimiter);

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartPlannerEnabled();
    const user = await resolveUser(req);
    requireChartInitialized(user.chartSchemaVersion, false);
    const input = validate(GenerateSchema, req.body ?? {});
    res.status(201).json({ success: true, data: await coursePlannerService.generate(user, input) });
  } catch (error) {
    next(error);
  }
});

/**
 * Safe, display-only quota state. Registered before `/:proposalId` so the
 * literal path is not captured as a proposal id.
 */
router.get('/quota', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartPlannerEnabled();
    const user = await resolveUser(req);
    requireChartInitialized(user.chartSchemaVersion, false);
    const quota = await coursePlannerService.getQuota(user);
    res.json({
      success: true,
      data: {
        eligible: quota.eligible,
        limit: quota.limit,
        remaining: quota.remaining,
        resetAt: quota.resetAt,
        reason: quota.reason,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:proposalId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartPlannerEnabled();
    const user = await resolveUser(req);
    requireChartInitialized(user.chartSchemaVersion, false);
    res.json({
      success: true,
      data: await coursePlannerService.get(user.id, req.params.proposalId),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:proposalId/accept', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireChartPlannerEnabled();
    requireChartWriteEnabled();
    const user = await resolveUser(req);
    requireChartInitialized(user.chartSchemaVersion);
    const input = validate(AcceptSchema, req.body ?? {});
    res.json({
      success: true,
      data: await coursePlannerService.accept(user.id, {
        proposalId: req.params.proposalId,
        ...input,
      }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
