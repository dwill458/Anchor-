/**
 * Anchor App - Authentication Routes
 *
 * Handles user authentication and profile synchronization
 */

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

const TOKEN_SECRET = process.env.JWT_SECRET || 'secret';
const TOKEN_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

const buildUserResponse = (user: any) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  subscriptionStatus: user.subscriptionStatus,
  totalAnchorsCreated: user.totalAnchorsCreated,
  totalActivations: user.totalActivations,
  currentStreak: user.currentStreak,
  longestStreak: user.longestStreak,
  createdAt: user.createdAt,
});

const signToken = (authUid: string, email: string) =>
  jwt.sign({ uid: authUid, email }, TOKEN_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

/**
 * POST /api/auth/register
 *
 * Email/password registration (JWT-based)
 *
 * Body:
 * - email
 * - password
 * - displayName (optional)
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new AppError('User already exists', 409, 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const authUid = normalizedEmail; // Stable UID for email auth

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        displayName: displayName || null,
        authProvider: 'email',
        authUid,
        passwordHash,
        lastSeenAt: new Date(),
      },
    });

    await prisma.userSettings.create({
      data: {
        userId: user.id,
      },
    });

    const token = signToken(user.authUid, user.email);

    res.status(201).json({
      success: true,
      data: {
        user: buildUserResponse(user),
        token,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to register user', 500, 'REGISTER_ERROR');
  }
});

/**
 * POST /api/auth/login
 *
 * Email/password login (JWT-based)
 *
 * Body:
 * - email
 * - password
 */
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken(user.authUid, user.email);

    res.json({
      success: true,
      data: {
        user: buildUserResponse(user),
        token,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to login', 500, 'LOGIN_ERROR');
  }
});

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
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
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
    } = req.body;

    // Validation
    if (dailyReminderTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(dailyReminderTime)) {
      throw new AppError('Invalid dailyReminderTime format. Use HH:MM', 400, 'VALIDATION_ERROR');
    }

    if (hapticIntensity !== undefined && (hapticIntensity < 1 || hapticIntensity > 5)) {
      throw new AppError('hapticIntensity must be between 1 and 5', 400, 'VALIDATION_ERROR');
    }

    if (vaultViewType && !['grid', 'list'].includes(vaultViewType)) {
      throw new AppError('vaultViewType must be "grid" or "list"', 400, 'VALIDATION_ERROR');
    }

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
      throw error;
    }
    throw new AppError('Failed to update settings', 500, 'UPDATE_ERROR');
  }
});

export default router;
