/**
 * Anchor App - Users Routes
 *
 * Handles user profile management including profile picture uploads
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { uploadProfilePicture } from '../../services/StorageService';
import { logger } from '../../utils/logger';

const router = Router();

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  profilePictureUrl: z.string().url().optional(),
  profilePictureBase64: z.string().optional(),
  profilePictureMimeType: z.enum(['image/jpeg', 'image/png']).optional(),
});

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

/**
 * PATCH /api/users/me
 *
 * Update authenticated user's profile (display name, profile picture)
 * Accepts either profilePictureUrl directly or profilePictureBase64 (encoded image data)
 * Requires authentication
 */
router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { displayName, profilePictureUrl, profilePictureBase64, profilePictureMimeType } = validate(
      UpdateProfileSchema,
      req.body
    );

    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) {
      updateData.displayName = displayName || null;
    }

    if (profilePictureBase64) {
      const mimeType = profilePictureMimeType || 'image/jpeg';
      const uploadedUrl = await uploadProfilePicture(user.id, profilePictureBase64, mimeType);
      updateData.profilePictureUrl = uploadedUrl;
    } else if (profilePictureUrl !== undefined) {
      updateData.profilePictureUrl = profilePictureUrl || null;
    }

    if (Object.keys(updateData).length === 0) {
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          profilePictureUrl: (user as any).profilePictureUrl,
        },
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { authUid: req.user.uid },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        profilePictureUrl: (updatedUser as any).profilePictureUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Profile update error', error);
    next(new AppError('Failed to update profile', 500, 'UPDATE_ERROR'));
  }
});

export default router;
