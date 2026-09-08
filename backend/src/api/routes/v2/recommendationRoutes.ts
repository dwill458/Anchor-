import { Router, Response, NextFunction } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { getAuthenticatedUserId } from './authHelper';
import { recommendationService } from '../../../services/v2/RecommendationService';
import { AcknowledgeSignalSchema } from '../../../domain/v2/recommendation';

const router = Router();
router.use(authMiddleware);

router.get(
  '/anchors/:anchorId/recommendation-context',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { anchorId } = req.params;
      const clientTimeZone =
        (req.query.timeZone as string) || (req.headers['x-timezone'] as string) || 'UTC';

      const context = await recommendationService.getRecommendationContext(
        userId,
        anchorId,
        clientTimeZone
      );
      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      next(error);
    }
  }
);

async function handleAcknowledgeSignal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = await getAuthenticatedUserId(req);
    const { signalId } = req.params;
    const bodyResult = AcknowledgeSignalSchema.safeParse(req.body || {});
    const signalType =
      bodyResult.success && bodyResult.data.signalType ? bodyResult.data.signalType : 'signal';

    const result = await recommendationService.acknowledgeSignal(userId, signalId, signalType);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

router.post('/anchors/:anchorId/recommendation-signals/:signalId/ack', handleAcknowledgeSignal);
router.post('/recommendations/signals/:signalId/ack', handleAcknowledgeSignal);

export default router;
