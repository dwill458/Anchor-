import { env } from '../config/env';
import { AppError } from '../api/middleware/errorHandler';
import { resolveMonetizationAccess, type MonetizationUser } from './MonetizationAccessService';

export interface PracticeAccessUser extends MonetizationUser {
  subscriptionStatus?: string;
  subscriptionId?: string | null;
}

export async function requireVisualizeAccess(user: PracticeAccessUser): Promise<void> {
  if (!env.ENABLE_VISUALIZE) {
    throw new AppError('Visualize is not available', 403, 'FEATURE_DISABLED');
  }
  const access = await resolveMonetizationAccess(user);
  if (!access.hasProAccess) {
    throw new AppError('Visualize requires Anchor Pro', 403, 'PREMIUM_PRACTICE_LOCKED');
  }
}
