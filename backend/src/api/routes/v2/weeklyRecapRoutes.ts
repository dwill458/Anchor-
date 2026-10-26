import { NextFunction, Request, Response, Router } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getAuthenticatedUserId } from './authHelper';
import { WeeklyRecapError, WeeklyRecapService } from '../../../services/v2/WeeklyRecapService';
import { prismaRecapReader, prismaSnapshotStore } from '../../../services/v2/WeeklyRecapPrisma';

/**
 * Weekly Insight 2.0 (global recap). Dark-launched behind WEEKLY_INSIGHT_V2_ENABLED.
 * The legacy /weekly-insights endpoints remain mounted and untouched.
 */
export function isWeeklyRecapEnabled(): boolean {
  return process.env.WEEKLY_INSIGHT_V2_ENABLED === 'true';
}

function translate(error: unknown): unknown {
  // The mobile client reads these codes as they are (WEEK_NOT_AVAILABLE, INVALID_TIME_ZONE, ...).
  if (error instanceof WeeklyRecapError)
    return new AppError(error.message, error.status, error.code);
  return error;
}

export function createWeeklyRecapRouter(
  service: Pick<WeeklyRecapService, 'get' | 'history'>
): Router {
  const router = Router();
  // Scoped to our own paths: this router is mounted at '/', so an unscoped router.use would
  // authenticate/gate every route mounted after it.
  router.use(
    ['/weekly-recap', '/weekly-recaps'],
    authMiddleware,
    (_req: Request, _res: Response, next: NextFunction) => {
      if (!isWeeklyRecapEnabled())
        return next(new AppError('Weekly Insight 2.0 is not enabled.', 403, 'FEATURE_DISABLED'));
      next();
    }
  );

  const timeZoneOf = (req: AuthRequest) =>
    String(req.query.timeZone ?? req.header('x-time-zone') ?? '');

  // `latest` and an explicit Monday key share one handler; the service validates the key.
  router.get(
    '/weekly-recap/:weekKey',
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const userId = await getAuthenticatedUserId(req);
        const result = await service.get(userId, {
          weekKey: req.params.weekKey,
          timeZone: timeZoneOf(req),
        });
        if (result.kind === 'NO_HISTORY') {
          res.json({
            success: true,
            data: {
              recap: null,
              reason: 'NO_HISTORY',
              weekKey: result.weekKey,
              timeZone: result.timeZone,
            },
          });
          return;
        }
        res.json({
          success: true,
          data: {
            id: result.id,
            recap: result.recap,
            feedback: result.feedback,
            updatedAt: result.updatedAt.toISOString(),
          },
        });
      } catch (e) {
        next(translate(e));
      }
    }
  );

  router.get('/weekly-recaps', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const limit = Number.parseInt(String(req.query.limit ?? '26'), 10);
      const before = typeof req.query.before === 'string' ? req.query.before : undefined;
      res.json({
        success: true,
        data: await service.history(userId, { before, limit: Number.isFinite(limit) ? limit : 26 }),
      });
    } catch (e) {
      next(translate(e));
    }
  });

  return router;
}

export default createWeeklyRecapRouter(
  new WeeklyRecapService(prismaRecapReader, prismaSnapshotStore)
);
