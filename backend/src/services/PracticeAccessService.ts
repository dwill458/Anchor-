import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError } from '../api/middleware/errorHandler';
import { getRevenueCatAccess } from './RevenueCatEntitlementService';

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface PracticeAccessUser {
  id: string;
  isComped: boolean;
  subscriptionStatus: string;
  subscriptionId: string | null;
  trialStartedAt: Date;
}

export async function requireVisualizeAccess(user: PracticeAccessUser): Promise<void> {
  if (!env.ENABLE_VISUALIZE) {
    throw new AppError('Visualize is not available', 403, 'FEATURE_DISABLED');
  }
  if (user.isComped) return;

  const liveAccess = await getRevenueCatAccess(user.id);
  const paidFromServer = liveAccess
    ? liveAccess.isActive
    : user.subscriptionStatus === 'pro' || user.subscriptionStatus === 'pro_annual';

  if (liveAccess) {
    const nextStatus = liveAccess.isActive ? 'pro' : 'free';
    if (
      nextStatus !== user.subscriptionStatus ||
      liveAccess.productIdentifier !== user.subscriptionId
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: nextStatus,
          subscriptionId: liveAccess.productIdentifier,
        },
      });
    }
  }

  if (!paidFromServer && Date.now() >= user.trialStartedAt.getTime() + TRIAL_DURATION_MS) {
    throw new AppError('Visualize requires Anchor Pro', 403, 'PREMIUM_PRACTICE_LOCKED');
  }
}
