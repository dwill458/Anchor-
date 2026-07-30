/**
 * Anchor App - Practice Routes
 *
 * Handles lightweight daily practice events (e.g., Stabilize).
 */

import { NextFunction, Router, Response } from 'express';
import { PracticeSession } from '@prisma/client';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import {
  BACKGROUND_AUDIO_MODES,
  GUIDANCE_VOICES,
  PRACTICE_MODES,
  VISUALIZE_DURATIONS_SECONDS,
} from '../../types/practice';
import { validateVisualizationScene } from '../../services/VisualizationSceneService';
import { requireVisualizeAccess } from '../../services/PracticeAccessService';

const router = Router();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NEXT_ACTION_MAX_LENGTH = 240;
const COMPLETION_SOURCES = [
  'practice_screen',
  'anchor_detail',
  'notification',
  'widget',
  'deep_link',
  'restored',
  'unknown',
] as const;

type AuthenticatedPracticeUser = Prisma.UserGetPayload<{
  select: {
    id: true;
    authUid: true;
    isComped: true;
    subscriptionStatus: true;
    subscriptionId: true;
    trialStartedAt: true;
  };
}>;

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

const IsoDateSchema = z.string().datetime({ offset: true });
const LocalDateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Must be a real calendar date');
const TimeZoneSchema = z
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
const PracticeSessionSchema = z
  .object({
    id: z.string().min(1).max(200),
    anchorId: z.string().min(1).max(200).nullable(),
    anchorLocalId: z.string().min(1).max(200).nullable().optional(),
    anchorServerId: z.string().min(1).max(200).nullable().optional(),
    practiceMode: z.enum(PRACTICE_MODES),
    plannedDurationSeconds: z.number().int().min(1).max(7200),
    completedDurationSeconds: z.number().int().min(1).max(7200),
    completionStatus: z.literal('completed'),
    startedAt: IsoDateSchema,
    completedAt: IsoDateSchema,
    // Optional: clients released before the canonical practice ledger
    // (commit 7cb8f97) never sent these. Defaulted/derived in
    // normalizeLegacySessionInput() rather than rejected, so already-installed
    // apps don't 400 forever on every completion until their user updates.
    localDateKey: LocalDateKeySchema.optional(),
    timeZone: TimeZoneSchema.optional(),
    utcOffsetMinutesAtCompletion: z.number().int().min(-840).max(840).optional(),
    completionSource: z.enum(COMPLETION_SOURCES).optional(),
    schemaVersion: z.number().int().min(1).max(100).optional(),
    legacyType: z.string().trim().min(1).max(100).nullable().optional(),
    guidanceVoice: z.enum(GUIDANCE_VOICES),
    backgroundAudio: z.enum(BACKGROUND_AUDIO_MODES),
    sceneSnapshot: z.string().max(180).nullable().optional(),
    nextAction: z.string().trim().min(1).max(NEXT_ACTION_MAX_LENGTH).nullable().optional(),
    clientVersion: z.string().max(100).nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

const PracticeSessionQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  anchorId: z.string().min(1).max(200).optional(),
  practiceMode: z.enum(PRACTICE_MODES).optional(),
});

const NextActionSchema = z
  .object({ nextAction: z.string().trim().min(1).max(NEXT_ACTION_MAX_LENGTH).nullable() })
  .strict();

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

async function getAuthenticatedUser(req: AuthRequest): Promise<AuthenticatedPracticeUser> {
  if (!req.user) throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  const user = await prisma.user.findUnique({
    where: { authUid: req.user.uid },
    select: {
      id: true,
      authUid: true,
      isComped: true,
      subscriptionStatus: true,
      subscriptionId: true,
      trialStartedAt: true,
    },
  });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user;
}

type PracticeSessionInput = z.infer<typeof PracticeSessionSchema>;
type NormalizedPracticeSessionInput = Omit<
  PracticeSessionInput,
  | 'localDateKey'
  | 'timeZone'
  | 'utcOffsetMinutesAtCompletion'
  | 'completionSource'
  | 'schemaVersion'
> & {
  localDateKey: string;
  timeZone: string;
  utcOffsetMinutesAtCompletion: number;
  completionSource: (typeof COMPLETION_SOURCES)[number];
  schemaVersion: number;
};

function computeLocalDateContext(
  completedAt: Date,
  timeZone: string
): { localDateKey: string; utcOffsetMinutes: number } {
  const wallClockParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(completedAt);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(wallClockParts.find(value => value.type === type)?.value);
  const localDateKey = `${String(part('year')).padStart(4, '0')}-${String(part('month')).padStart(2, '0')}-${String(part('day')).padStart(2, '0')}`;
  const wallClockAsUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  );
  const utcOffsetMinutes = Math.round((wallClockAsUtc - completedAt.getTime()) / 60_000);
  return { localDateKey, utcOffsetMinutes };
}

// Clients released before the canonical practice ledger (commit 7cb8f97)
// never sent localDateKey/timeZone/utcOffsetMinutesAtCompletion/
// completionSource/schemaVersion. Derive/default them here instead of
// rejecting, so already-installed apps can keep syncing completions until
// their user updates.
function normalizeLegacySessionInput(input: PracticeSessionInput): NormalizedPracticeSessionInput {
  const timeZone = input.timeZone ?? 'UTC';
  const derived =
    input.localDateKey === undefined || input.utcOffsetMinutesAtCompletion === undefined
      ? computeLocalDateContext(new Date(input.completedAt), timeZone)
      : null;
  return {
    ...input,
    timeZone,
    localDateKey: input.localDateKey ?? derived!.localDateKey,
    utcOffsetMinutesAtCompletion: input.utcOffsetMinutesAtCompletion ?? derived!.utcOffsetMinutes,
    completionSource: input.completionSource ?? 'unknown',
    schemaVersion: input.schemaVersion ?? 1,
  };
}

function assertValidCompletedSession(input: NormalizedPracticeSessionInput): void {
  const startedAt = new Date(input.startedAt);
  const completedAt = new Date(input.completedAt);
  if (completedAt < startedAt || completedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new AppError('Invalid practice timestamps', 400, 'VALIDATION_ERROR');
  }
  if (input.completedDurationSeconds > input.plannedDurationSeconds + 5) {
    throw new AppError('Completed duration exceeds the planned session', 400, 'VALIDATION_ERROR');
  }
  const { localDateKey: expectedLocalDateKey, utcOffsetMinutes: expectedOffset } =
    computeLocalDateContext(completedAt, input.timeZone);
  if (input.localDateKey !== expectedLocalDateKey) {
    throw new AppError(
      'Local practice date does not match completion timezone',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (input.utcOffsetMinutesAtCompletion !== expectedOffset) {
    throw new AppError(
      'Practice time-zone offset does not match completion timezone',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (input.practiceMode === 'visualize') {
    if (
      !(VISUALIZE_DURATIONS_SECONDS as readonly number[]).includes(input.plannedDurationSeconds)
    ) {
      throw new AppError('Unsupported Visualize duration', 400, 'VALIDATION_ERROR');
    }
    if (input.completedDurationSeconds !== input.plannedDurationSeconds) {
      throw new AppError('Visualize must reach its completion boundary', 400, 'VALIDATION_ERROR');
    }
    if (!validateVisualizationScene(input.sceneSnapshot)) {
      throw new AppError('A valid scene snapshot is required', 400, 'VALIDATION_ERROR');
    }
  }
}

function immutableSessionMatches(
  existing: PracticeSession,
  input: NormalizedPracticeSessionInput
): boolean {
  const expectedServerAnchorSnapshot = input.anchorServerId ?? input.anchorId;
  const anchorRelationMatches =
    existing.anchorId === input.anchorId ||
    (existing.anchorId === null &&
      existing.anchorServerIdSnapshot === expectedServerAnchorSnapshot);
  return (
    anchorRelationMatches &&
    existing.anchorLocalId === (input.anchorLocalId ?? null) &&
    existing.anchorServerIdSnapshot === (input.anchorServerId ?? input.anchorId ?? null) &&
    existing.practiceMode === input.practiceMode &&
    existing.plannedDurationSeconds === input.plannedDurationSeconds &&
    existing.completedDurationSeconds === input.completedDurationSeconds &&
    existing.completionStatus === input.completionStatus &&
    existing.startedAt.getTime() === new Date(input.startedAt).getTime() &&
    existing.completedAt.getTime() === new Date(input.completedAt).getTime() &&
    existing.localDateKey === input.localDateKey &&
    existing.timeZone === input.timeZone &&
    existing.utcOffsetMinutesAtCompletion === input.utcOffsetMinutesAtCompletion &&
    existing.completionSource === input.completionSource &&
    existing.schemaVersion === input.schemaVersion &&
    existing.legacyType === (input.legacyType ?? null) &&
    existing.guidanceVoice === input.guidanceVoice &&
    existing.backgroundAudio === input.backgroundAudio &&
    existing.sceneSnapshot === (input.sceneSnapshot ?? null)
  );
}

router.post('/sessions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = normalizeLegacySessionInput(validate(PracticeSessionSchema, req.body ?? {}));
    assertValidCompletedSession(input);
    const user = await getAuthenticatedUser(req);
    if (input.practiceMode === 'visualize') await requireVisualizeAccess(user);

    const existing = await prisma.practiceSession.findUnique({ where: { id: input.id } });
    if (existing) {
      if (existing.userId !== user.id || !immutableSessionMatches(existing, input)) {
        throw new AppError('Session ID has already been used', 409, 'SESSION_ID_CONFLICT');
      }
      res.json({ success: true, data: existing, idempotent: true });
      return;
    }

    let relationAnchorId: string | null = null;
    if (input.anchorId) {
      const referencedAnchor = await prisma.anchor.findUnique({
        where: { id: input.anchorId },
        select: { id: true, userId: true },
      });
      if (referencedAnchor && referencedAnchor.userId !== user.id) {
        throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
      }
      // A session completed before a delete/release remains valid. If the
      // anchor has since been deleted, retain its snapshots without restoring
      // a live relation.
      relationAnchorId = referencedAnchor?.id ?? null;
    }

    const created = await prisma.$transaction(async tx => {
      const session = await tx.practiceSession.create({
        data: {
          id: input.id,
          userId: user.id,
          anchorId: relationAnchorId,
          anchorLocalId: input.anchorLocalId ?? null,
          anchorServerIdSnapshot: input.anchorServerId ?? input.anchorId,
          practiceMode: input.practiceMode,
          plannedDurationSeconds: input.plannedDurationSeconds,
          completedDurationSeconds: input.completedDurationSeconds,
          completionStatus: input.completionStatus,
          startedAt: new Date(input.startedAt),
          completedAt: new Date(input.completedAt),
          localDateKey: input.localDateKey,
          timeZone: input.timeZone,
          utcOffsetMinutesAtCompletion: input.utcOffsetMinutesAtCompletion,
          completionSource: input.completionSource,
          schemaVersion: input.schemaVersion,
          legacyType: input.legacyType ?? null,
          guidanceVoice: input.guidanceVoice,
          backgroundAudio: input.backgroundAudio,
          sceneSnapshot: input.sceneSnapshot ?? null,
          nextAction: input.nextAction ?? null,
          clientVersion: input.clientVersion ?? null,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      // Focus/Deep Prime retain their existing legacy activation/charge writes
      // during compatibility. Visualize has no legacy row, so it owns the
      // compatibility counters here.
      if (relationAnchorId && input.practiceMode === 'visualize') {
        await tx.anchor.update({
          where: { id: relationAnchorId },
          data: {
            activationCount: { increment: 1 },
            lastActivatedAt: new Date(input.completedAt),
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { totalActivations: { increment: 1 } },
        });
      }
      return session;
    });
    res.status(201).json({ success: true, data: created, idempotent: false });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('Failed to record practice session', 500, 'PRACTICE_ERROR'));
  }
});

router.get('/sessions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = validate(PracticeSessionQuerySchema, req.query);
    const limit = query.limit ?? 50;
    const user = await getAuthenticatedUser(req);
    const rows = await prisma.practiceSession.findMany({
      where: {
        userId: user.id,
        ...(query.anchorId
          ? { OR: [{ anchorId: query.anchorId }, { anchorLocalId: query.anchorId }] }
          : {}),
        ...(query.practiceMode ? { practiceMode: query.practiceMode } : {}),
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      success: true,
      data,
      pagination: { nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore },
    });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('Failed to load practice sessions', 500, 'PRACTICE_ERROR'));
  }
});

router.patch(
  '/sessions/:id/next-action',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { nextAction } = validate(NextActionSchema, req.body ?? {});
      const user = await getAuthenticatedUser(req);
      const existing = await prisma.practiceSession.findFirst({
        where: { id: req.params.id, userId: user.id },
      });
      if (!existing)
        throw new AppError('Practice session not found', 404, 'PRACTICE_SESSION_NOT_FOUND');
      const updated = await prisma.practiceSession.update({
        where: { id: existing.id },
        data: { nextAction },
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof AppError) return next(error);
      return next(new AppError('Failed to save next action', 500, 'PRACTICE_ERROR'));
    }
  }
);

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

    const { completedAt, timezoneOffsetMinutes, lastStabilizeTimezoneOffsetMinutes } = validate(
      StabilizeSchema,
      req.body ?? {}
    );

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
        isComped: updated.isComped,
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
