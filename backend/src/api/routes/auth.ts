/**
 * Anchor App - Authentication Routes
 *
 * Handles user authentication and profile synchronization
 */

import { Prisma } from '@prisma/client';
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { getFirebaseAdmin } from '../../config/firebase';

const router = Router();

// Tighter rate limits for sensitive auth endpoints to prevent brute-force/enumeration.
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
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

// --- Zod schemas ---

const SyncSchema = z.object({
  displayName: z.string().optional(),
  authProvider: z.enum(['email', 'google', 'apple']).optional(),
  hasCompletedOnboarding: z.boolean().optional(),
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
  hapticIntensity: z.number().min(1).max(5).optional(),
  vaultViewType: z.enum(['grid', 'list']).optional(),
});

const PushTokensSchema = z.object({
  expoPushToken: z.string().min(1).nullable().optional(),
  fcmToken: z.string().min(1).nullable().optional(),
  apnsToken: z.string().min(1).nullable().optional(),
});

const NotificationStateSyncSchema = z.object({
  notificationState: z.record(z.unknown()).optional(),
  // Nested format sent by mobile client (syncPushTokensToServer)
  pushTokens: PushTokensSchema.optional(),
  replacePushTokens: z.boolean().optional(),
}).refine(
  (value) => value.notificationState !== undefined || value.pushTokens !== undefined,
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

      const { displayName, authProvider, hasCompletedOnboarding } = validate(SyncSchema, req.body);
      const email = req.user.email;

      if (!email) {
        throw new AppError(
          'Authenticated user is missing an email address',
          400,
          'INVALID_AUTH_CONTEXT'
        );
      }

      let provider = authProvider;
      if (!provider) {
        const firebaseUser = await getFirebaseAdmin().auth().getUser(req.user.uid);
        provider = mapProviderIdToAuthProvider(firebaseUser.providerData[0]?.providerId);
      }

      const user = await prisma.user.upsert({
        where: { authUid: req.user.uid },
        update: {
          email,
          displayName: displayName || undefined,
          ...(hasCompletedOnboarding === true && { hasCompletedOnboarding: true }),
          lastSeenAt: new Date(),
        },
        create: {
          authUid: req.user.uid,
          email,
          displayName,
          authProvider: provider,
          hasCompletedOnboarding: hasCompletedOnboarding === true,
          lastSeenAt: new Date(),
        },
      });

      await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          subscriptionStatus: user.subscriptionStatus,
          totalAnchorsCreated: user.totalAnchorsCreated,
          totalActivations: user.totalActivations,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          stabilizesTotal: user.stabilizesTotal,
          stabilizeStreakDays: user.stabilizeStreakDays,
          lastStabilizeAt: user.lastStabilizeAt,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
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

    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
      include: {
        settings: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        subscriptionStatus: user.subscriptionStatus,
        totalAnchorsCreated: user.totalAnchorsCreated,
        totalActivations: user.totalActivations,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        stabilizesTotal: user.stabilizesTotal,
        stabilizeStreakDays: user.stabilizeStreakDays,
        lastStabilizeAt: user.lastStabilizeAt,
        createdAt: user.createdAt,
        settings: user.settings,
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

      const user = await prisma.user.findUnique({
        where: { authUid: req.user.uid },
        include: {
          settings: true,
          anchors: {
            orderBy: { createdAt: 'desc' },
            include: {
              activations: { orderBy: { activatedAt: 'desc' } },
              charges: { orderBy: { chargedAt: 'desc' } },
            },
          },
          activations: { orderBy: { activatedAt: 'desc' } },
          charges: { orderBy: { chargedAt: 'desc' } },
          orders: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const [syncQueue, burnedAnchors, flaggedContent] = await Promise.all([
        prisma.syncQueue.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.burnedAnchor.findMany({
          where: { userId: user.id },
          orderBy: { burnedAt: 'desc' },
        }),
        prisma.flaggedContent.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      res.json({
        success: true,
        data: {
          exportVersion: 1,
          exportedAt: new Date().toISOString(),
          account: user,
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
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          subscriptionStatus: user.subscriptionStatus,
          totalAnchorsCreated: user.totalAnchorsCreated,
          totalActivations: user.totalActivations,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          stabilizesTotal: user.stabilizesTotal,
          stabilizeStreakDays: user.stabilizeStreakDays,
          lastStabilizeAt: user.lastStabilizeAt,
          createdAt: user.createdAt,
        },
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

      const {
        notificationsEnabled,
        dailyReminderTime,
        streakProtection,
        defaultChargeDuration,
        hapticIntensity,
        vaultViewType,
      } = validate(UpdateSettingsSchema, req.body);

      // Find user to get their ID
      const user = await prisma.user.findUnique({
        where: { authUid: req.user.uid },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Update settings (upsert in case they don't exist yet)
      const settings = await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {
          ...(notificationsEnabled !== undefined && { notificationsEnabled }),
          ...(dailyReminderTime && { dailyReminderTime }),
          ...(streakProtection !== undefined && { streakProtection }),
          ...(defaultChargeDuration !== undefined && { defaultChargeDuration }),
          ...(hapticIntensity !== undefined && { hapticIntensity }),
          ...(vaultViewType && { vaultViewType }),
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          ...(notificationsEnabled !== undefined && { notificationsEnabled }),
          ...(dailyReminderTime && { dailyReminderTime }),
          ...(streakProtection !== undefined && { streakProtection }),
          ...(defaultChargeDuration !== undefined && { defaultChargeDuration }),
          ...(hapticIntensity !== undefined && { hapticIntensity }),
          ...(vaultViewType && { vaultViewType }),
        },
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

      const { notificationState, pushTokens, replacePushTokens = true } = validate(
        NotificationStateSyncSchema,
        req.body
      );

      const user = await prisma.user.findUnique({
        where: { authUid: req.user.uid },
        select: { id: true },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const notificationEnabled = notificationState && Object.prototype.hasOwnProperty.call(
        notificationState,
        'notification_enabled'
      )
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
        if (replacePushTokens || Object.prototype.hasOwnProperty.call(pushTokens, 'expoPushToken')) {
          assignments.push(Prisma.sql`expo_push_token = ${pushTokens.expoPushToken ?? null}`);
        }
        if (replacePushTokens || Object.prototype.hasOwnProperty.call(pushTokens, 'fcmToken')) {
          assignments.push(Prisma.sql`fcm_token = ${pushTokens.fcmToken ?? null}`);
        }
        if (replacePushTokens || Object.prototype.hasOwnProperty.call(pushTokens, 'apnsToken')) {
          assignments.push(Prisma.sql`apns_token = ${pushTokens.apnsToken ?? null}`);
        }
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

      const firebaseAdmin = getFirebaseAdmin().auth();

      try {
        await firebaseAdmin.deleteUser(req.user.uid);
      } catch (error) {
        const code =
          typeof error === 'object' && error && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';

        if (code !== 'auth/user-not-found') {
          throw new AppError('Failed to delete authentication account', 500, 'AUTH_DELETE_ERROR');
        }
      }

      // Delete user (cascades handled by Prisma schema onDelete: Cascade)
      // This will automatically delete:
      // - anchors (which cascade to activations and charges)
      // - activations
      // - charges
      // - orders
      // - settings
      await prisma.user.delete({
        where: { id: user.id },
      });

      // Also clean up sync queue (not in schema relations)
      await prisma.syncQueue.deleteMany({
        where: { userId: user.id },
      });

      res.json({
        success: true,
        data: {
          message: 'Account successfully deleted',
          deletedUserId: user.id,
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
