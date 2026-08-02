/**
 * Server-confirmed billing access.
 *
 * The client never supplies a RevenueCat user ID, price, product, or entitlement.
 * Firebase authentication identifies the user; the server then resolves the matching
 * database user and verifies that user's RevenueCat access.
 */

import { NextFunction, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { getRevenueCatAccess } from '../../services/RevenueCatEntitlementService';

const router = Router();

const billingRefreshLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many billing confirmation attempts. Please try again shortly.',
    },
  },
});

/**
 * POST /api/billing/refresh
 *
 * Forces a fresh RevenueCat lookup after a completed purchase or restore and
 * persists the result before the app treats access as unlocked.
 */
router.post(
  '/refresh',
  authMiddleware,
  billingRefreshLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.uid) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const user = await prisma.user.findUnique({
        where: { authUid: req.user.uid },
        select: {
          id: true,
          isComped: true,
          subscriptionStatus: true,
          subscriptionId: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.isComped) {
        res.json({
          success: true,
          data: {
            hasActiveEntitlement: true,
            subscriptionStatus: 'pro',
            productIdentifier: user.subscriptionId,
            source: 'comped',
          },
        });
        return;
      }

      const access = await getRevenueCatAccess(user.id, new Date(), { forceRefresh: true });
      if (!access) {
        throw new AppError(
          'Billing access is temporarily unavailable. Please try again shortly.',
          503,
          'BILLING_UNAVAILABLE'
        );
      }

      const subscriptionStatus = access.isActive ? 'pro' : 'free';
      const subscriptionId = access.isActive ? access.productIdentifier : null;

      if (
        user.subscriptionId !== subscriptionId ||
        user.subscriptionStatus !== subscriptionStatus
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus, subscriptionId },
        });
      }

      res.json({
        success: true,
        data: {
          hasActiveEntitlement: access.isActive,
          subscriptionStatus,
          productIdentifier: subscriptionId,
          source: 'revenuecat',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
