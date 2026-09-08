import { NextFunction, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { threadStrengthService } from '../../../services/v2/ThreadStrengthService';

const router = Router();
const threadCompletionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many Thread completion attempts. Please try again later.',
    },
  },
});

router.post(
  '/completions/:sessionId',
  authMiddleware,
  threadCompletionLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (process.env.THREAD_V2_AUTHORITY !== 'true') {
        throw new AppError('Thread V2 authority is disabled.', 403, 'THREAD_V2_AUTHORITY_DISABLED');
      }
      const user = await prisma.user.findUnique({
        where: { authUid: req.user!.uid },
        select: { id: true },
      });
      if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      const movement = await threadStrengthService.calculateForPracticeSession({
        userId: user.id,
        sessionId: req.params.sessionId,
        mode: 'authoritative',
      });
      if (!movement)
        throw new AppError(
          'Practice session cannot update Thread Strength.',
          422,
          'THREAD_SESSION_INELIGIBLE'
        );
      res.json({ success: true, data: movement });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
