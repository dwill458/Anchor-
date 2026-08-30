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
import { resolveMonetizationAccess } from '../../services/MonetizationAccessService';

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

      const access = await resolveMonetizationAccess(user, new Date(), { forceRefresh: true });
      if (!access.entitlementVerified && !access.isComped && !access.legacyMigrationAccess) {
        res.status(503).json({
          success: false,
          error: {
            code: 'BILLING_UNAVAILABLE',
            message: 'Billing access could not be verified yet. Please retry shortly.',
          },
        });
        return;
      }
      const subscriptionStatus = access.hasProAccess ? 'pro' : 'free';
      // Preserve the internal comp marker as a projection detail; it is not
      // used as store entitlement evidence and is never sent to RevenueCat.
      const subscriptionId = access.isComped
        ? user.subscriptionId
        : access.hasProAccess
          ? access.productIdentifier
          : null;

      if (!access.isComped && (
        user.subscriptionId !== subscriptionId ||
        user.subscriptionStatus !== subscriptionStatus
      )) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus, subscriptionId },
        });
      }

      res.json({
        success: true,
        data: {
          hasActiveEntitlement: access.hasProAccess,
          subscriptionStatus,
          productIdentifier: subscriptionId,
          source: access.source,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
