import { NextFunction, Response, Router } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { getAuthenticatedUserId } from './authHelper';
import { milestoneService } from '../../../services/v2/milestones/MilestoneService';

const router = Router();
router.use(authMiddleware);

/**
 * The Anchor's permanent milestone record. Reading reconciles first, so history made offline or
 * before milestones existed is recorded here. `created` lists only what this call newly recorded.
 */
router.get(
  '/anchors/:anchorId/milestones',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { milestones, created } = await milestoneService.reconcileAndList(userId, req.params.anchorId);
      res.json({ success: true, data: { milestones, created } });
    } catch (error) {
      next(error);
    }
  }
);

/** Presentation receipt: the celebration finished. Idempotent, and it never changes what was earned. */
router.post(
  '/milestones/:milestoneId/celebrated',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const milestone = await milestoneService.markCelebrated(userId, req.params.milestoneId);
      res.json({ success: true, data: { milestone } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
