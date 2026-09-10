import { NextFunction, Response, Router } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { getAuthenticatedUserId } from './authHelper';
import { anchorReleaseService } from '../../../services/v2/AnchorReleaseService';

const router = Router();
router.use(authMiddleware);
router.post(
  '/anchors/:anchorId/release',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await anchorReleaseService.release(
        await getAuthenticatedUserId(req),
        req.params.anchorId,
        String(req.body?.idempotencyKey ?? '')
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
