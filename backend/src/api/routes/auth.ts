/**
 * Anchor App - Authentication Routes
 *
 * Handles user authentication and profile synchronization
 */

import { Prisma } from '@prisma/client';
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { getFirebaseAdmin } from '../../config/firebase';
import { hasCompedAccess } from '../../utils/compedAccess';
import { logger } from '../../utils/logger';

const router = Router();

// Tighter rate limits for sensitive auth endpoints to prevent brute-force/enumeration.
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many sync attempts, please try again later' },
  },
});

const deleteAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many deletion attempts, please try again later',
    },
  },
});

function mapProviderIdToAuthProvider(providerId?: string): 'email' | 'google' | 'apple' {
  switch (providerId) {
    case 'google.com':
      return 'google';
    case 'apple.com':
      return 'apple';
    default:
      return 'email';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function serializeUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  profilePictureUrl?: string | null;
  hasCompletedOnboarding: boolean;
  isComped: boolean;
  subscriptionStatus: string;
  totalAnchorsCreated: number;
  totalActivations: number;
  currentStreak: number;
  longestStreak: number;
  stabilizesTotal: number;
  stabilizeStreakDays: number;
  lastStabilizeAt: Date | null;
  createdAt: Date;
  trialStartedAt?: Date | null;
}): {
  id: string;
  email: string;
  displayName: string | null;
  profilePictureUrl?: string | null;
  hasCompletedOnboarding: boolean;
  isComped: boolean;
  subscriptionStatus: string;
  totalAnchorsCreated: number;
  totalActivations: number;
  currentStreak: number;
  longestStreak: number;
  stabilizesTotal: number;
  stabilizeStreakDays: number;
  lastStabilizeAt: Date | null;
  createdAt: Date;
  trialStartedAt: Date;
  isTrialExpired: boolean;
} {
  // Anchor the trial on trialStartedAt (resettable per-account), falling back to
  // createdAt for records written before the column existed.
  const trialAnchor = user.trialStartedAt ?? user.createdAt;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    ...(user.profilePictureUrl && { profilePictureUrl: user.profilePictureUrl }),
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    isComped: user.isComped,
    subscriptionStatus: user.subscriptionStatus,
    totalAnchorsCreated: user.totalAnchorsCreated,
    totalActivations: user.totalActivations,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    stabilizesTotal: user.stabilizesTotal,
    stabilizeStreakDays: user.stabilizeStreakDays,
    lastStabilizeAt: user.lastStabilizeAt,
    createdAt: user.createdAt,
    trialStartedAt: trialAnchor,
    isTrialExpired: Date.now() >= trialAnchor.getTime() + TRIAL_DURATION_MS,
  };
}

async function syncCompedFlag(user: {
  id: string;
  email: string;
  isComped: boolean;
}): Promise<boolean> {
  const nextIsComped = hasCompedAccess(user.email);
  if (user.isComped === nextIsComped) {
    return nextIsComped;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isComped: nextIsComped },
  });

  return nextIsComped;
}

function buildUserSyncPayload(input: {
  email: string;
  displayName?: string;
  authProvider: 'email' | 'google' | 'apple';
  isComped: boolean;
  hasCompletedOnboarding?: boolean;
  lastSeenAt: Date;
}): {
  email: string;
  displayName: string | undefined;
  authProvider: 'email' | 'google' | 'apple';
  isComped: boolean;
  hasCompletedOnboarding?: true;
  lastSeenAt: Date;
} {
  const { email, displayName, authProvider, isComped, hasCompletedOnboarding, lastSeenAt } = input;

  return {
    email,
    displayName: displayName || undefined,
    authProvider,
    isComped,
    ...(hasCompletedOnboarding === true && { hasCompletedOnboarding: true }),
    lastSeenAt,
  };
}

function isUniqueEmailConflict(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('email')
  );
}

function buildSettingsUpsertData(settings: {
  notificationsEnabled?: boolean;
  dailyReminderTime?: string;
  streakProtection?: boolean;
  defaultChargeDuration?: number;
  focusSessionMode?: 'quick' | 'deep';
  focusSessionDuration?: number;
  focusSessionAudio?: 'silent' | 'ambient';
  primeSessionDuration?: number;
  primeSessionAudio?: 'silent' | 'ambient';
  hapticIntensity?: number;
  vaultViewType?: 'grid' | 'list';
}): {
  notificationsEnabled?: boolean;
  dailyReminderTime?: string;
  streakProtection?: boolean;
  defaultChargeDuration?: number;
  focusSessionMode?: 'quick' | 'deep';
  focusSessionDuration?: number;
  focusSessionAudio?: 'silent' | 'ambient';
  primeSessionDuration?: number;
  primeSessionAudio?: 'silent' | 'ambient';
  hapticIntensity?: number;
  vaultViewType?: 'grid' | 'list';
} {
  const {
    notificationsEnabled,
    dailyReminderTime,
    streakProtection,
    defaultChargeDuration,
    focusSessionMode,
    focusSessionDuration,
    focusSessionAudio,
    primeSessionDuration,
    primeSessionAudio,
    hapticIntensity,
    vaultViewType,
  } = settings;

  return {
    ...(notificationsEnabled !== undefined && { notificationsEnabled }),
    ...(dailyReminderTime && { dailyReminderTime }),
    ...(streakProtection !== undefined && { streakProtection }),
    ...(defaultChargeDuration !== undefined && { defaultChargeDuration }),
    ...(focusSessionMode !== undefined && { focusSessionMode }),
    ...(focusSessionDuration !== undefined && { focusSessionDuration }),
    ...(focusSessionAudio !== undefined && { focusSessionAudio }),
    ...(primeSessionDuration !== undefined && { primeSessionDuration }),
    ...(primeSessionAudio !== undefined && { primeSessionAudio }),
    ...(hapticIntensity !== undefined && { hapticIntensity }),
    ...(vaultViewType && { vaultViewType }),
  };
}

// --- Zod schemas ---

const SyncSchema = z.object({
  displayName: z.string().optional(),
  authProvider: z.enum(['email', 'google', 'apple']).optional(),
  hasCompletedOnboarding: z.boolean().optional(),
  allowCreate: z.boolean().optional(),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
});

const UpdateSettingsSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  dailyReminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'dailyReminderTime must be in HH:MM format')
    .optional(),
  streakProtection: z.boolean().optional(),
  defaultChargeDuration: z.number().min(30).max(3600).optional(),
  focusSessionMode: z.enum(['quick', 'deep']).optional(),
  focusSessionDuration: z.number().min(10).max(120).optional(),
  focusSessionAudio: z.enum(['silent', 'ambient']).optional(),
  primeSessionDuration: z.number().min(120).max(7200).optional(),
  primeSessionAudio: z.enum(['silent', 'ambient']).optional(),
  hapticIntensity: z.number().min(1).max(5).optional(),
  vaultViewType: z.enum(['grid', 'list']).optional(),
});

const PushTokensSchema = z.object({
  expoPushToken: z.string().min(1).nullable().optional(),
  fcmToken: z.string().min(1).nullable().optional(),
  apnsToken: z.string().min(1).nullable().optional(),
});

const NotificationStateSyncSchema = z
  .object({
    notificationState: z.record(z.unknown()).optional(),
    // Nested format sent by mobile client (syncPushTokensToServer)
    pushTokens: PushTokensSchema.optional(),
    replacePushTokens: z.boolean().optional(),
  })
  .refine(
    value => value.notificationState !== undefined || value.pushTokens !== undefined,
    'notificationState or pushTokens are required'
  );

// Validates req.body against a schema; throws AppError on failure.
function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

function buildFlaggedContentUserWhere(user: { id: string; authUid: string }): {
  userId?: string;
  OR?: Array<{ userId: string }>;
} {
  if (user.id === user.authUid) {
    return { userId: user.id };
  }

  return {
    OR: [{ userId: user.id }, { userId: user.authUid }],
  };
}

async function getExportSection<T>(
  section: string,
  context: { authUid: string; userId?: string },
  resolver: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await resolver();
  } catch (error) {
    logger.error(
      `Account export section failed: ${section}`,
      error instanceof Error ? error : new Error(String(error)),
      context
    );
    return fallback;
  }
}

/**
 * POST /api/auth/sync
 *
 * Sync user profile with backend after Firebase authentication
 * Creates new user if doesn't exist, updates if exists
 *
 * Body:
 * - authUid: Firebase user ID
 * - email: User email
 * - displayName: User display name (optional)
 * - authProvider: 'email' | 'google' | 'apple'
 */
router.post(
  '/sync',
  syncLimiter,
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }
      const authUid = req.user.uid;

      const {
        displayName,
        authProvider,
        hasCompletedOnboarding,
        allowCreate = true,
      } = validate(SyncSchema, req.body);
      const rawEmail = req.user.email;

      if (!rawEmail) {
        throw new AppError(
          'Authenticated user is missing an email address',
          400,
          'INVALID_AUTH_CONTEXT'
        );
      }

      const email = normalizeEmail(rawEmail);

      if (!email) {
        throw new AppError(
          'Authenticated user is missing an email address',
          400,
          'INVALID_AUTH_CONTEXT'
        );
      }

      const isComped = hasCompedAccess(email);
      let provider = authProvider;
      if (!provider) {
        const firebaseUser = await getFirebaseAdmin().auth().getUser(authUid);
        provider = mapProviderIdToAuthProvider(firebaseUser.providerData[0]?.providerId);
      }

      const lastSeenAt = new Date();
      const syncPayload = buildUserSyncPayload({
        email,
        displayName,
        authProvider: provider,
        isComped,
        hasCompletedOnboarding,
        lastSeenAt,
      });

      const user = await prisma
        .$transaction(async tx => {
          const existingByAuthUid = await tx.user.findUnique({
            where: { authUid },
          });

          const syncedUser = existingByAuthUid
            ? await tx.user.update({
                where: { authUid },
                data: syncPayload,
              })
            : await (async () => {
                const existingByEmail = await tx.user.findFirst({
                  where: {
                    email: {
                      equals: email,
                      mode: 'insensitive',
                    },
                  },
                });

                if (existingByEmail) {
                  return tx.user.update({
                    where: { id: existingByEmail.id },
                    data: {
                      ...syncPayload,
                      authUid,
                    },
                  });
                }

                if (!allowCreate) {
                  throw new AppError(
                    'No Anchor account was found for this sign-in. Use the account email from your existing Anchor profile, or create a new account.',
                    404,
                    'USER_NOT_FOUND'
                  );
                }

                // If this races with a concurrent sync inserting the same email, let the
                // unique-constraint error propagate out of this transaction. Postgres aborts
                // the whole transaction once a statement errors, so the recovery lookup below
                // runs in a fresh transaction rather than reusing this aborted one.
                return tx.user.create({
                  data: {
                    authUid,
                    ...syncPayload,
                    hasCompletedOnboarding: hasCompletedOnboarding === true,
                  },
                });
              })();

          await tx.userSettings.upsert({
            where: { userId: syncedUser.id },
            update: {},
            create: { userId: syncedUser.id },
          });

          return syncedUser;
        })
        .catch(async error => {
          if (!isUniqueEmailConflict(error)) {
            throw error;
          }

          return prisma.$transaction(async tx => {
            const userCreatedByConcurrentSync = await tx.user.findFirst({
              where: {
                email: {
                  equals: email,
                  mode: 'insensitive',
                },
              },
            });

            if (!userCreatedByConcurrentSync) {
              throw error;
            }

            const syncedUser = await tx.user.update({
              where: { id: userCreatedByConcurrentSync.id },
              data: {
                ...syncPayload,
                authUid,
              },
            });

            await tx.userSettings.upsert({
              where: { userId: syncedUser.id },
              update: {},
              create: { userId: syncedUser.id },
            });

            return syncedUser;
          });
        });

      res.json({
        success: true,
        data: serializeUser(user),
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error('Auth sync Prisma error', error, {
          authUid: req.user?.uid,
          authProvider: req.body?.authProvider,
          path: req.path,
          prismaCode: error.code,
          prismaMeta: error.meta,
        });
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        logger.error('Auth sync Prisma validation error', error, {
          authUid: req.user?.uid,
          authProvider: req.body?.authProvider,
          path: req.path,
        });
      } else {
        logger.error('Auth sync unexpected error', error, {
          authUid: req.user?.uid,
          authProvider: req.body?.authProvider,
          path: req.path,
        });
      }

      next(new AppError('Failed to sync user', 500, 'SYNC_ERROR'));
    }
  }
);

/**
 * GET /api/auth/me
 *
 * Get current authenticated user's profile
 * Requires authentication
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const userRecord = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
      include: {
        settings: true,
      },
    });

    if (!userRecord) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isComped = await syncCompedFlag(userRecord);
    const user = { ...userRecord, isComped };

    res.json({
      success: true,
      data: {
        ...serializeUser(user),
        settings: userRecord.settings,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to fetch user', 500, 'FETCH_ERROR'));
  }
});

/**
 * GET /api/auth/me/export
 *
 * Export the authenticated user's account data as JSON.
 */
router.get(
  '/me/export',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }
      const authUid = req.user.uid;

      const user = await prisma.user.findUnique({
        where: { authUid },
        select: {
          id: true,
          email: true,
          displayName: true,
          authProvider: true,
          authUid: true,
          isComped: true,
          subscriptionStatus: true,
          subscriptionId: true,
          createdAt: true,
          updatedAt: true,
          lastSeenAt: true,
          hasCompletedOnboarding: true,
          totalAnchorsCreated: true,
          totalActivations: true,
          currentStreak: true,
          longestStreak: true,
          stabilizesTotal: true,
          stabilizeStreakDays: true,
          lastStabilizeAt: true,
          notificationState: true,
          expoPushToken: true,
          fcmToken: true,
          apnsToken: true,
          notificationsEnabled: true,
          settings: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const exportContext = { authUid, userId: user.id };
      const [anchors, activations, charges, orders, syncQueue, burnedAnchors, flaggedContent] =
        await Promise.all([
          getExportSection(
            'anchors',
            exportContext,
            () =>
              prisma.anchor.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                include: {
                  activations: { orderBy: { activatedAt: 'desc' } },
                  charges: { orderBy: { chargedAt: 'desc' } },
                },
              }),
            []
          ),
          getExportSection(
            'activations',
            exportContext,
            () =>
              prisma.activation.findMany({
                where: { userId: user.id },
                orderBy: { activatedAt: 'desc' },
              }),
            []
          ),
          getExportSection(
            'charges',
            exportContext,
            () =>
              prisma.charge.findMany({
                where: { userId: user.id },
                orderBy: { chargedAt: 'desc' },
              }),
            []
          ),
          getExportSection(
            'orders',
            exportContext,
            () =>
              prisma.order.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
              }),
            []
          ),
          getExportSection(
            'syncQueue',
            exportContext,
            () =>
              prisma.syncQueue.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
              }),
            []
          ),
          getExportSection(
            'burnedAnchors',
            exportContext,
            () =>
              prisma.burnedAnchor.findMany({
                where: { userId: user.id },
                orderBy: { burnedAt: 'desc' },
              }),
            []
          ),
          getExportSection(
            'flaggedContent',
            exportContext,
            () =>
              prisma.flaggedContent.findMany({
                where: buildFlaggedContentUserWhere(user),
                orderBy: { createdAt: 'desc' },
              }),
            []
          ),
        ]);
      const { passwordHash: _passwordHash, ...exportedUser } = user as typeof user & {
        passwordHash?: string | null;
      };

      res.json({
        success: true,
        data: {
          exportVersion: 1,
          exportedAt: new Date().toISOString(),
          account: {
            ...exportedUser,
            anchors,
            activations,
            charges,
            orders,
          },
          burnedAnchors,
          flaggedContent,
          syncQueue,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(new AppError('Failed to export account data', 500, 'EXPORT_ERROR'));
    }
  }
);

/**
 * PUT /api/auth/profile
 *
 * Update user profile
 * Requires authentication
 *
 * Body:
 * - displayName: New display name (optional)
 */
router.put(
  '/profile',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const { displayName } = validate(UpdateProfileSchema, req.body);

      const user = await prisma.user.update({
        where: { authUid: req.user.uid },
        data: {
          displayName: displayName || undefined,
          updatedAt: new Date(),
        },
      });

      res.json({
        success: true,
        data: serializeUser({
          ...user,
          isComped: await syncCompedFlag(user),
        }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(new AppError('Failed to update profile', 500, 'UPDATE_ERROR'));
    }
  }
);

/**
 * PUT /api/auth/settings
 *
 * Update user settings
 * Requires authentication
 *
 * Body:
 * - notificationsEnabled: Boolean (optional)
 * - dailyReminderTime: String in HH:MM format (optional)
 * - streakProtection: Boolean (optional)
 * - defaultChargeDuration: Number in seconds (optional)
 * - focusSessionMode: 'quick' | 'deep' (optional)
 * - focusSessionDuration: Number in seconds (optional)
 * - focusSessionAudio: 'silent' | 'ambient' (optional)
 * - primeSessionDuration: Number in seconds (optional)
 * - primeSessionAudio: 'silent' | 'ambient' (optional)
 * - hapticIntensity: Number 1-5 (optional)
 * - vaultViewType: 'grid' | 'list' (optional)
 */
router.put(
  '/settings',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }
      const authUid = req.user.uid;

      const {
        notificationsEnabled,
        dailyReminderTime,
        streakProtection,
        defaultChargeDuration,
        focusSessionMode,
        focusSessionDuration,
        focusSessionAudio,
        primeSessionDuration,
        primeSessionAudio,
        hapticIntensity,
        vaultViewType,
      } = validate(UpdateSettingsSchema, req.body);

      const settingsData = buildSettingsUpsertData({
        notificationsEnabled,
        dailyReminderTime,
        streakProtection,
        defaultChargeDuration,
        focusSessionMode,
        focusSessionDuration,
        focusSessionAudio,
        primeSessionDuration,
        primeSessionAudio,
        hapticIntensity,
        vaultViewType,
      });

      const settings = await prisma.$transaction(async tx => {
        const user = await tx.user.findUnique({
          where: { authUid },
        });

        if (!user) {
          throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        return tx.userSettings.upsert({
          where: { userId: user.id },
          update: {
            ...settingsData,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            ...settingsData,
          },
        });
      });

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(new AppError('Failed to update settings', 500, 'UPDATE_ERROR'));
    }
  }
);

/**
 * PUT /api/auth/notification-state
 *
 * Persist merged notification state for the authenticated user.
 * This path exists because the mobile app authenticates with Firebase, not Supabase Auth.
 */
router.put(
  '/notification-state',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }
      const authUid = req.user.uid;

      const {
        notificationState,
        pushTokens,
        replacePushTokens = true,
      } = validate(NotificationStateSyncSchema, req.body);

      const user = await prisma.user.findUnique({
        where: { authUid },
        select: { id: true },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const notificationEnabled =
        notificationState &&
        Object.prototype.hasOwnProperty.call(notificationState, 'notification_enabled')
          ? Boolean(notificationState.notification_enabled)
          : null;

      const assignments: Prisma.Sql[] = [];

      if (notificationState) {
        const stateJson = JSON.stringify(notificationState);
        assignments.push(
          Prisma.sql`notification_state = COALESCE(notification_state, '{}'::jsonb) || ${stateJson}::jsonb`
        );
      }

      if (notificationEnabled !== null) {
        assignments.push(Prisma.sql`notifications_enabled = ${notificationEnabled}`);
      }

      if (pushTokens) {
        if (
          replacePushTokens ||
          Object.prototype.hasOwnProperty.call(pushTokens, 'expoPushToken')
        ) {
          assignments.push(Prisma.sql`expo_push_token = ${pushTokens.expoPushToken ?? null}`);
        }
        if (replacePushTokens || Object.prototype.hasOwnProperty.call(pushTokens, 'fcmToken')) {
          assignments.push(Prisma.sql`fcm_token = ${pushTokens.fcmToken ?? null}`);
        }
        if (replacePushTokens || Object.prototype.hasOwnProperty.call(pushTokens, 'apnsToken')) {
          assignments.push(Prisma.sql`apns_token = ${pushTokens.apnsToken ?? null}`);
        }
      }

      if (assignments.length === 0) {
        throw new AppError('No fields to update', 400, 'VALIDATION_ERROR');
      }

      const query = Prisma.sql`
        UPDATE users
        SET ${Prisma.join(assignments, ', ')}
        WHERE id = ${user.id}
        RETURNING notification_state, notifications_enabled, expo_push_token, fcm_token, apns_token
      `;

      const rows = await prisma.$queryRaw<
        Array<{
          notification_state: Prisma.JsonValue | null;
          notifications_enabled: boolean;
          expo_push_token: string | null;
          fcm_token: string | null;
          apns_token: string | null;
        }>
      >(query);

      const updated = rows[0];
      if (!updated) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          notificationState: updated.notification_state ?? {},
          notificationsEnabled: updated.notifications_enabled,
          expoPushToken: updated.expo_push_token,
          fcmToken: updated.fcm_token,
          apnsToken: updated.apns_token,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(new AppError('Failed to sync notification state', 500, 'UPDATE_ERROR'));
    }
  }
);

/**
 * DELETE /api/auth/me
 *
 * Delete user account and all associated data (GDPR/CCPA compliant)
 * Requires authentication
 *
 * Cascade deletes:
 * - All anchors (with charges, activations)
 * - User settings
 * - Orders
 * - Sync queue entries
 * - User record
 */
router.delete(
  '/me',
  deleteAccountLimiter,
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { authUid: req.user.uid },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      await prisma.$transaction(async tx => {
        await tx.flaggedContent.deleteMany({
          where: buildFlaggedContentUserWhere(user),
        });
        await tx.burnedAnchor.deleteMany({
          where: { userId: user.id },
        });
        await tx.syncQueue.deleteMany({
          where: { userId: user.id },
        });
        await tx.user.delete({
          where: { id: user.id },
        });
      });

      const firebaseAdmin = getFirebaseAdmin().auth();
      let authAccountDeleted = true;

      try {
        await firebaseAdmin.deleteUser(req.user.uid);
      } catch (error) {
        const code =
          typeof error === 'object' && error && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';

        if (code !== 'auth/user-not-found') {
          authAccountDeleted = false;
        }
      }

      res.json({
        success: true,
        data: {
          message: authAccountDeleted
            ? 'Account successfully deleted'
            : 'Account data deleted; authentication account requires manual cleanup',
          deletedUserId: user.id,
          authAccountDeleted,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(new AppError('Failed to delete account', 500, 'DELETE_ERROR'));
    }
  }
);

export default router;
