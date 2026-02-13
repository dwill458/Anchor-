/**
 * Anchor App - Practice Routes
 *
 * Handles lightweight daily practice events (e.g., Stabilize).
 */

import { NextFunction, Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
    } = req.body ?? {};

    if (typeof completedAt !== 'string' || !completedAt) {
      throw new AppError('Missing required field: completedAt', 400, 'VALIDATION_ERROR');
    }

    const completedAtDate = new Date(completedAt);
    if (Number.isNaN(completedAtDate.getTime())) {
      throw new AppError(
        'Invalid completedAt. Must be an ISO date string.',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (typeof timezoneOffsetMinutes !== 'number' || Number.isNaN(timezoneOffsetMinutes)) {
      throw new AppError('Missing required field: timezoneOffsetMinutes', 400, 'VALIDATION_ERROR');
    }
    if (timezoneOffsetMinutes < -840 || timezoneOffsetMinutes > 840) {
      throw new AppError(
        'Invalid timezoneOffsetMinutes. Must be between -840 and 840.',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (
      lastStabilizeTimezoneOffsetMinutes !== null &&
      lastStabilizeTimezoneOffsetMinutes !== undefined &&
      (typeof lastStabilizeTimezoneOffsetMinutes !== 'number' ||
        Number.isNaN(lastStabilizeTimezoneOffsetMinutes))
    ) {
      throw new AppError(
        'Invalid lastStabilizeTimezoneOffsetMinutes. Must be a number or null.',
        400,
        'VALIDATION_ERROR'
      );
    }
    if (
      typeof lastStabilizeTimezoneOffsetMinutes === 'number' &&
      (lastStabilizeTimezoneOffsetMinutes < -840 || lastStabilizeTimezoneOffsetMinutes > 840)
    ) {
      throw new AppError(
        'Invalid lastStabilizeTimezoneOffsetMinutes. Must be between -840 and 840.',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (
      stabilizeStreakDaysClient !== undefined &&
      (typeof stabilizeStreakDaysClient !== 'number' ||
        Number.isNaN(stabilizeStreakDaysClient) ||
        stabilizeStreakDaysClient < 1)
    ) {
      throw new AppError(
        'Invalid stabilizeStreakDaysClient. Must be a number >= 1 when provided.',
        400,
        'VALIDATION_ERROR'
      );
    }

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
