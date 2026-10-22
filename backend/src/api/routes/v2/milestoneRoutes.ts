import { NextFunction, Response, Router } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { getAuthenticatedUserId } from './authHelper';
import { milestoneService } from '../../../services/v2/milestones/MilestoneService';
import { milestonePresentationService } from '../../../services/v2/milestones/MilestonePresentationService';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authMiddleware);

const ActionSchema = z.object({ kind: z.enum(['practice', 'vision', 'chart', 'goal']), sourceEntityId: z.string().min(1).max(160), eventId: z.string().min(1).max(160).optional() }).strict()
  .refine(action => action.kind !== 'chart' || Boolean(action.eventId));
router.post('/anchors/:anchorId/milestone-celebration', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = ActionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Invalid milestone action', 400, 'INVALID_MILESTONE_ACTION');
    const userId = await getAuthenticatedUserId(req);
    const presentation = await milestonePresentationService.reserve(userId, req.params.anchorId, parsed.data);
    res.json({ success: true, data: { presentation } });
  } catch (error) { next(error); }
});

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
      if (req.body?.presentationId !== undefined) {
        const id = z.string().uuid().safeParse(req.body.presentationId);
        if (!id.success) throw new AppError('Invalid presentation', 400, 'INVALID_PRESENTATION');
        await milestonePresentationService.acknowledge(userId, req.params.milestoneId, id.data);
        res.json({ success: true });
        return;
      }
      const milestone = await milestoneService.markCelebrated(userId, req.params.milestoneId);
      res.json({ success: true, data: { milestone } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
