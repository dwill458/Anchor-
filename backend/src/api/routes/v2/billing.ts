import { NextFunction, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { resolveMonetizationAccess } from '../../../services/MonetizationAccessService';
import { getTrialState } from '../../../services/v2/TrialLifecycleService';

const router = Router();
const trialActivationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many trial activation attempts. Please try again later.' } },
});

/** Starts the local trial lifecycle only after an authenticated explicit action. */
router.post('/trial/activate', authMiddleware, trialActivationLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.uid) throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    const existing = await prisma.user.findUnique({ where: { authUid: req.user.uid }, select: { id: true, isComped: true, trialStartedAt: true } });
    if (!existing) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    const initialState = getTrialState(existing.trialStartedAt);
    if (initialState === 'EXPIRED') throw new AppError('This trial has already been used.', 409, 'TRIAL_ALREADY_USED');
    if (initialState === 'NOT_STARTED') {
      // Conditional update makes concurrent taps/retries idempotent and keeps
      // the timestamp entirely server-owned.
      await prisma.user.updateMany({ where: { id: existing.id, trialStartedAt: null }, data: { trialStartedAt: new Date() } });
    }
    const user = await prisma.user.findUnique({ where: { id: existing.id }, select: { id: true, isComped: true, trialStartedAt: true } });
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    const access = await resolveMonetizationAccess(user);
    res.json({ success: true, data: { trialState: getTrialState(user.trialStartedAt), trialStartedAt: user.trialStartedAt, entitlement: access } });
  } catch (error) { next(error); }
});

export default router;
