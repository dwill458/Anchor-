/**
 * Anchor App - Authentication Routes
 *
 * Handles user authentication and profile synchronization
 */

import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

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
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { authUid, email, displayName, authProvider } = req.body;

    // Validation
    if (!authUid || !email) {
      throw new AppError('Missing required fields: authUid and email', 400, 'VALIDATION_ERROR');
    }

    if (!['email', 'google', 'apple'].includes(authProvider)) {
      throw new AppError('Invalid authProvider', 400, 'VALIDATION_ERROR');
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { authUid },
    });

    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { authUid },
        data: {
          email,
          displayName: displayName || user.displayName,
          lastSeenAt: new Date(),
        },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          authUid,
          email,
          displayName,
          authProvider,
          lastSeenAt: new Date(),
        },
      });

      // Create default user settings
      await prisma.userSettings.create({
        data: {
          userId: user.id,
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        subscriptionStatus: user.subscriptionStatus,
        totalAnchorsCreated: user.totalAnchorsCreated,
        totalActivations: user.totalActivations,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to sync user', 500, 'SYNC_ERROR');
  }
});

/**
 * GET /api/auth/me
 *
 * Get current authenticated user's profile
 * Requires authentication
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
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
        subscriptionStatus: user.subscriptionStatus,
        totalAnchorsCreated: user.totalAnchorsCreated,
        totalActivations: user.totalActivations,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
        settings: user.settings,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to fetch user', 500, 'FETCH_ERROR');
  }
});

/**
 * PUT /api/auth/profile
 *
 * Update user profile
 * Requires authentication
 *
 * Body:
 * - displayName: New display name (optional)
 */
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { displayName } = req.body;

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
        subscriptionStatus: user.subscriptionStatus,
        totalAnchorsCreated: user.totalAnchorsCreated,
        totalActivations: user.totalActivations,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update profile', 500, 'UPDATE_ERROR');
  }
});

export default router;
