import { NextFunction, Response, Router } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { getAuthenticatedUserId } from './authHelper';
import { weeklyInsightService } from '../../../services/v2/WeeklyInsightService';

const router = Router();
router.use(authMiddleware);
router.get('/weekly-insights', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const anchorId = typeof req.query.anchorId === 'string' ? req.query.anchorId : undefined;
    const rows = await prisma.weeklyInsightSnapshot.findMany({
      where: { userId, ...(anchorId ? { anchorId } : {}) },
      orderBy: { weekStart: 'desc' },
      take: 52,
    });
    res.json({
      success: true,
      data: rows.map(row => ({ ...(row.snapshot as object), id: row.id, feedback: row.feedback })),
    });
  } catch (error) {
    next(error);
  }
});
router.post(
  '/weekly-insights/generate',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { anchorId, timeZone } = req.body ?? {};
      if (anchorId !== undefined && anchorId !== null && typeof anchorId !== 'string')
        throw new AppError('anchorId must be a string.', 400, 'INVALID_WEEKLY_INSIGHT');
      if (timeZone !== undefined && typeof timeZone !== 'string')
        throw new AppError('timeZone must be a string.', 400, 'INVALID_WEEKLY_INSIGHT');
      const result = await weeklyInsightService.generate(userId, { anchorId, timeZone });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);
router.post(
  '/weekly-insights/:snapshotId/feedback',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const rating = String(req.body?.rating ?? '');
      if (!['Yes', 'Mostly', 'Not really'].includes(rating))
        throw new AppError('Invalid feedback rating.', 400, 'INVALID_WEEKLY_FEEDBACK');
      const result = await prisma.weeklyInsightSnapshot.updateMany({
        where: { id: req.params.snapshotId, userId },
        data: { feedback: rating },
      });
      if (!result.count)
        throw new AppError('Weekly Insight not found.', 404, 'WEEKLY_INSIGHT_NOT_FOUND');
      res.json({ success: true, data: { snapshotId: req.params.snapshotId, rating } });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
