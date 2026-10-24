import { NextFunction, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../../../config/env';
import { prismaRecapReader, prismaSnapshotStore } from '../../../services/v2/WeeklyRecapPrisma';
import { WeeklyRecapError, WeeklyRecapService } from '../../../services/v2/WeeklyRecapService';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { getAuthenticatedUserId } from './authHelper';

const router = Router();
router.use(authMiddleware);

// ---- Weekly Insight 2.0 (server-authoritative, global). Behind ENABLE_WEEKLY_RECAP_V2; legacy routes below stay as-is. ----
const recapService = new WeeklyRecapService(prismaRecapReader, prismaSnapshotStore);
const recapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many Weekly Insight requests. Please try again later.' } },
});
function requireRecapV2() {
  if (!env.ENABLE_WEEKLY_RECAP_V2) throw new AppError('Weekly Insight 2.0 is not enabled.', 403, 'FEATURE_DISABLED');
}
const asAppError = (error: unknown) => (error instanceof WeeklyRecapError ? new AppError(error.message, error.status, error.code) : error);
const zoneOf = (req: AuthRequest) => (typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);

async function sendRecap(req: AuthRequest, res: Response, next: NextFunction, weekKey: string) {
  const started = Date.now();
  try {
    requireRecapV2();
    const userId = await getAuthenticatedUserId(req);
    const result = await recapService.get(userId, { weekKey, timeZone: zoneOf(req) });
    res.setHeader('Server-Timing', `recap;dur=${Date.now() - started}`);
    if (result.kind === 'NO_HISTORY') {
      res.json({ success: true, data: { recap: null, reason: 'NO_HISTORY', weekKey: result.weekKey } });
      return;
    }
    res.json({ success: true, data: { id: result.id, recap: result.recap, feedback: result.feedback, updatedAt: result.updatedAt } });
  } catch (error) {
    next(asAppError(error));
  }
}
router.get('/weekly-recap/latest', recapLimiter, (req: AuthRequest, res, next) => sendRecap(req, res, next, 'latest'));
router.get('/weekly-recap/:weekKey', recapLimiter, (req: AuthRequest, res, next) => sendRecap(req, res, next, req.params.weekKey));
router.get('/weekly-recaps', recapLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireRecapV2();
    const userId = await getAuthenticatedUserId(req);
    const limit = Number(req.query.limit);
    const before = typeof req.query.before === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.before) ? req.query.before : undefined;
    res.json({ success: true, data: await recapService.history(userId, { before, limit: Number.isFinite(limit) ? limit : undefined }) });
  } catch (error) {
    next(asAppError(error));
  }
});

router.get('/weekly-insights', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const anchorId = typeof req.query.anchorId === 'string' ? req.query.anchorId : undefined;
    const rows = await prisma.weeklyInsightSnapshot.findMany({
      where: { userId, schemaVersion: 1, ...(anchorId ? { anchorId } : {}) },
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
router.post('/weekly-insights', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const { anchorId = null, weekStart, weekEnd, snapshot } = req.body ?? {};
    if (!weekStart || !weekEnd || !snapshot || typeof snapshot !== 'object')
      throw new AppError(
        'A persisted snapshot and week range are required.',
        400,
        'INVALID_WEEKLY_INSIGHT'
      );
    if ((snapshot as { recapVersion?: number }).recapVersion === 2)
      throw new AppError('Weekly Insight 2.0 recaps are server-authored.', 400, 'INVALID_WEEKLY_INSIGHT');
    const legacyData = { userId, anchorId, weekStart: new Date(weekStart), weekEnd: new Date(weekEnd), snapshot };
    // A NULL anchorId can never satisfy the compound unique key (Postgres treats NULLs as distinct), so the global
    // case looks the row up explicitly instead of upserting.
    const result = anchorId
      ? await prisma.weeklyInsightSnapshot.upsert({
          where: { userId_anchorId_weekStart: { userId, anchorId, weekStart: legacyData.weekStart } },
          create: legacyData,
          update: {},
        })
      : (await prisma.weeklyInsightSnapshot.findFirst({ where: { userId, anchorId: null, schemaVersion: 1, weekStart: legacyData.weekStart } })) ??
        (await prisma.weeklyInsightSnapshot.create({ data: legacyData }));
    res.json({
      success: true,
      data: { ...(result.snapshot as object), id: result.id, feedback: result.feedback },
    });
  } catch (error) {
    next(error);
  }
});
router.post(
  '/weekly-insights/:snapshotId/feedback',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const rating = String(req.body?.rating ?? '');
      if (!['Yes', 'Mostly', 'Not really'].includes(rating))
        throw new AppError('Invalid feedback rating.', 400, 'INVALID_WEEKLY_FEEDBACK');
      const target = await prisma.weeklyInsightSnapshot.findFirst({
        where: { id: req.params.snapshotId, userId },
        select: { id: true, status: true, schemaVersion: true },
      });
      if (!target) throw new AppError('Weekly Insight not found.', 404, 'WEEKLY_INSIGHT_NOT_FOUND');
      // Feedback is about what the person is shown. A provisional recap can still change, so it cannot be rated yet.
      if (target.schemaVersion === 2 && target.status !== 'FINAL')
        throw new AppError('This recap is still being finalized.', 409, 'RECAP_NOT_FINAL');
      await prisma.weeklyInsightSnapshot.updateMany({ where: { id: target.id, userId }, data: { feedback: rating } });
      res.json({ success: true, data: { snapshotId: req.params.snapshotId, rating } });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
