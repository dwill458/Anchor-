/**
 * Anchor App - Practice Routes
 *
 * Handles lightweight daily practice events (e.g., Stabilize).
 */

import { NextFunction, Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';

const router = Router();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --- Zod schemas ---

const StabilizeSchema = z.object({
  completedAt: z
    .string()
    .min(1)
    .refine(val => !Number.isNaN(new Date(val).getTime()), {
      message: 'Must be a valid ISO date string',
    }),
  timezoneOffsetMinutes: z.number().min(-840).max(840),
  lastStabilizeTimezoneOffsetMinutes: z.number().min(-840).max(840).nullable().optional(),
  stabilizeStreakDaysClient: z.number().min(1).optional(),
});

// Validates req.body against a schema; throws AppError on failure.
function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

const toLocalDayStartUtc = (date: Date, timezoneOffsetMinutes: number): number => {
  // Convert the instant into the user's local wall-clock day based on the supplied offset.
  const shifted = new Date(date.getTime() - timezoneOffsetMinutes * 60 * 1000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
};

const getLocalDayDiff = (
  current: Date,
  last: Date,
  currentTimezoneOffsetMinutes: number,
  lastTimezoneOffsetMinutes: number
): number => {
  const currentDayStart = toLocalDayStartUtc(current, currentTimezoneOffsetMinutes);
  const lastDayStart = toLocalDayStartUtc(last, lastTimezoneOffsetMinutes);
  const diff = Math.round((currentDayStart - lastDayStart) / MS_PER_DAY);

  // Defensive fallback for clock skew or future timestamps.
  return diff < 0 ? 0 : diff;
};

// All practice routes require authentication
router.use(authMiddleware);

/**
 * POST /api/practice/stabilize
 *
 * Records a completed Stabilize (30s) session.
 *
 * Body:
 * - completedAt: ISO string (required)
 * - timezoneOffsetMinutes: number (required) - from Date#getTimezoneOffset()
 * - lastStabilizeTimezoneOffsetMinutes: number | null (optional)
 * - stabilizeStreakDaysClient: number (optional client hint)
 */
router.post('/stabilize', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const {
      completedAt,
      timezoneOffsetMinutes,
      lastStabilizeTimezoneOffsetMinutes,
      stabilizeStreakDaysClient,
    } = validate(StabilizeSchema, req.body ?? {});

    const completedAtDate = new Date(completedAt);

    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const previousStreak = Math.max(0, user.stabilizeStreakDays ?? 0);
    const lastStabilizeAt = user.lastStabilizeAt;
    const effectiveLastOffset =
      typeof lastStabilizeTimezoneOffsetMinutes === 'number'
        ? lastStabilizeTimezoneOffsetMinutes
        : timezoneOffsetMinutes;

    let nextStreakDays = 1;
    if (lastStabilizeAt) {
      const dayDiff = getLocalDayDiff(
        completedAtDate,
        lastStabilizeAt,
        timezoneOffsetMinutes,
        effectiveLastOffset
      );

      if (dayDiff === 0) {
        nextStreakDays = Math.max(1, previousStreak);
      } else if (dayDiff === 1) {
        nextStreakDays = previousStreak + 1;
      } else {
        nextStreakDays = 1;
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        stabilizesTotal: { increment: 1 },
        stabilizeStreakDays: nextStreakDays,
        lastStabilizeAt: completedAtDate,
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        hasCompletedOnboarding: updated.hasCompletedOnboarding,
        subscriptionStatus: updated.subscriptionStatus,
        totalAnchorsCreated: updated.totalAnchorsCreated,
        totalActivations: updated.totalActivations,
        currentStreak: updated.currentStreak,
        longestStreak: updated.longestStreak,
        stabilizesTotal: updated.stabilizesTotal,
        stabilizeStreakDays: updated.stabilizeStreakDays,
        lastStabilizeAt: updated.lastStabilizeAt,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError('Failed to record stabilize', 500, 'PRACTICE_ERROR'));
  }
});

export default router;
