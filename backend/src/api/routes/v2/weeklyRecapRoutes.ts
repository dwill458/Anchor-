import { NextFunction, Response, Router } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { getAuthenticatedUserId } from './authHelper';
import { RecapError, SqlExecutor, WeeklyRecapService } from '../../../services/v2/WeeklyRecapService';

/**
 * Weekly Insight 2.0 (global recap). Dark-launched behind WEEKLY_INSIGHT_V2_ENABLED.
 * The legacy /weekly-insights endpoints remain mounted and untouched.
 */
export function isWeeklyRecapEnabled(): boolean {
  return process.env.WEEKLY_INSIGHT_V2_ENABLED === 'true';
}

const STATUS: Record<RecapError['code'], number> = {
  INVALID_TIME_ZONE: 400,
  INVALID_WEEK: 400,
  INVALID_ANSWER: 400,
  NOT_FINAL: 409,
  NOT_FOUND: 404,
};

function translate(error: unknown): unknown {
  if (error instanceof RecapError) {
    return new AppError(error.message, STATUS[error.code], `WEEKLY_RECAP_${error.code}`);
  }
  return error;
}

export const prismaExecutor: SqlExecutor = {
  query: async <T = any>(text: string, values: unknown[] = []) =>
    (await prisma.$queryRawUnsafe(text, ...values)) as T[],
};

export function createWeeklyRecapRouter(service: Pick<WeeklyRecapService, 'getRecap' | 'submitFeedback' | 'listRecaps'>): Router {
  const router = Router();
  // Scoped to our own paths: this router is mounted at '/', so an unscoped router.use would
  // authenticate/gate every route mounted after it.
  router.use(['/weekly-recap', '/weekly-recaps'], authMiddleware, (_req: any, _res: any, next: any) => {
    if (!isWeeklyRecapEnabled()) return next(new AppError('Weekly Insight 2.0 is not enabled.', 403, 'FEATURE_DISABLED'));
    next();
  });

  const timeZoneOf = (req: AuthRequest) => String(req.query.timeZone ?? req.header('x-time-zone') ?? '');

  router.get('/weekly-recap/latest', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      res.json({ success: true, data: await service.getRecap(userId, { timeZone: timeZoneOf(req) }) });
    } catch (e) {
      next(translate(e));
    }
  });

  router.get('/weekly-recaps', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const limit = Number.parseInt(String(req.query.limit ?? '26'), 10);
      const rows = await service.listRecaps(userId, Number.isFinite(limit) ? limit : 26);
      res.json({
        success: true,
        data: rows.map((r) => ({
          weekKey: r.week_key,
          timeZone: r.time_zone,
          status: r.status,
          headline: r.headline,
          heroKind: r.hero_kind,
          hasFeedback: r.has_feedback,
        })),
      });
    } catch (e) {
      next(translate(e));
    }
  });

  router.get('/weekly-recap/:weekKey', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      res.json({
        success: true,
        data: await service.getRecap(userId, { weekKey: req.params.weekKey, timeZone: timeZoneOf(req) }),
      });
    } catch (e) {
      next(translate(e));
    }
  });

  router.post('/weekly-recap/:weekKey/feedback', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const result = await service.submitFeedback(userId, req.params.weekKey, String(req.body?.rating ?? ''));
      res.json({ success: true, data: { weekKey: req.params.weekKey, rating: result.feedback } });
    } catch (e) {
      next(translate(e));
    }
  });

  return router;
}

export default createWeeklyRecapRouter(new WeeklyRecapService(prismaExecutor));
