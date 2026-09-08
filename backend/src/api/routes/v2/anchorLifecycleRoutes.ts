import { Router, Response, NextFunction } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { getAuthenticatedUserId } from './authHelper';
import { intentionCompletionService } from '../../../services/v2/IntentionCompletionService';

const router = Router();
router.use(authMiddleware);

async function handleCompleteAnchor(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = await getAuthenticatedUserId(req);
    const { id } = req.params;

    const result = await intentionCompletionService.completeIntention(userId, id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

router.post('/anchors/:id/complete', handleCompleteAnchor);
router.patch('/anchors/:id/complete', handleCompleteAnchor);

export default router;
