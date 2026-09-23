import { Router, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { requireChartEnabled, requireChartWriteEnabled } from '../../../config/chartFlags';
import { getAuthenticatedUserId } from './authHelper';
import { chartService } from '../../../services/chart/ChartService';
import { chartPlannerService } from '../../../services/chart/ChartPlannerService';

/**
 * Anchor 2.0 Chart API. A Chart is addressed through its Anchor; route-level
 * operations use the Chart (Course) id. Waypoint completion, edits, reorder and
 * cancellation stay on the canonical /api/courses endpoints.
 */
const router = Router();
router.use(authMiddleware);

const planLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'CHART_PLAN_RATE_LIMITED', message: 'Too many route requests. Try again shortly.' },
    });
  },
});

const IdempotencyKey = z.string().trim().min(8).max(200);
const Id = z.string().min(1).max(200);
const CourseVersion = z.number().int().min(1);
const MetricNumber = z.number().finite().min(0).max(1e12);

const WaypointKind = z.enum(['MILESTONE', 'METRIC', 'CAPABILITY']);
const RouteWaypoint = z
  .object({
    id: Id.nullish(),
    title: z.string().trim().min(1).max(60),
    rationale: z.string().max(400).nullish(),
    kind: WaypointKind.optional(),
    metricLabel: z.string().max(40).nullish(),
    metricBaseline: MetricNumber.nullish(),
    metricTarget: MetricNumber.positive().nullish(),
  })
  .strict();

const PlanSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    startingContext: z.string().max(500).nullish(),
    followUp: z
      .object({ question: z.string().min(1).max(200), answer: z.string().trim().min(1).max(500) })
      .strict()
      .nullish(),
  })
  .strict();

const AdjustSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    reason: z.enum([
      'TOO_MANY_STEPS',
      'TOO_FEW_STEPS',
      'DIFFERENT_MILESTONES',
      'FURTHER_ALONG',
      'CHANGE_DESTINATION',
      'OTHER',
    ]),
    detail: z.string().max(500).nullish(),
    courseId: Id.nullish(),
    startingContext: z.string().max(500).nullish(),
    draft: z
      .object({
        destination: z.string().trim().min(1).max(140),
        waypoints: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(60),
                kind: WaypointKind.optional(),
                metricTarget: MetricNumber.nullish(),
                metricLabel: z.string().max(40).nullish(),
              })
              .strip()
          )
          .max(12),
      })
      .strict()
      .nullish(),
  })
  .strict()
  .refine(value => Boolean(value.courseId) !== Boolean(value.draft), {
    message: 'Provide either courseId or draft',
  });

const CreateSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    destinationText: z.string().trim().min(1).max(140),
    startingContext: z.string().max(500).nullish(),
    proposalId: Id.nullish(),
    complexity: z.enum(['SIMPLE', 'MODERATE', 'COMPLEX']).nullish(),
    waypoints: z.array(RouteWaypoint.omit({ id: true })).min(1).max(12),
    oneMove: z
      .object({ title: z.string().trim().min(1).max(120), rationale: z.string().max(280).nullish() })
      .strict()
      .nullish(),
  })
  .strict();

const ApplyRouteSchema = z
  .object({
    expectedCourseVersion: CourseVersion,
    idempotencyKey: IdempotencyKey,
    destinationText: z.string().trim().min(1).max(140).nullish(),
    waypoints: z.array(RouteWaypoint).min(1).max(12),
    proposalId: Id.nullish(),
    adjustmentReason: z.string().max(32).nullish(),
    confirmRewrite: z.boolean().optional(),
  })
  .strict();

const AddMoveSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    waypointId: Id,
    title: z.string().trim().min(1).max(120),
    rationale: z.string().max(280).nullish(),
    makeCurrent: z.boolean().optional(),
  })
  .strict();

const UpdateMoveSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    rationale: z.string().max(280).nullish(),
    accept: z.boolean().optional(),
    makeCurrent: z.boolean().optional(),
  })
  .strict();

const ProgressSchema = z
  .object({ expectedCourseVersion: CourseVersion, metricCurrent: MetricNumber.nullable() })
  .strict();

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.errors.map(error => `${error.path.join('.')}: ${error.message}`).join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

async function readUser(req: AuthRequest): Promise<string> {
  requireChartEnabled();
  return getAuthenticatedUserId(req);
}

/** Writes need the Chart schema flag; Anchor 2.0 sets it on first use. */
async function writeUser(req: AuthRequest): Promise<string> {
  requireChartWriteEnabled();
  const userId = await getAuthenticatedUserId(req);
  await prisma.user.updateMany({ where: { id: userId, chartSchemaVersion: { not: 1 } }, data: { chartSchemaVersion: 1 } });
  return userId;
}

type Handler = (req: AuthRequest, res: Response) => Promise<void>;
const handle =
  (fn: Handler) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };

router.get(
  '/anchors/:anchorId/chart',
  handle(async (req, res) => {
    const userId = await readUser(req);
    res.json({ success: true, data: await chartService.getChartForAnchor(userId, req.params.anchorId) });
  })
);

router.post(
  '/anchors/:anchorId/chart/plan',
  planLimiter,
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(PlanSchema, req.body);
    const result = await chartPlannerService.generate(userId, {
      anchorId: req.params.anchorId,
      idempotencyKey: body.idempotencyKey,
      startingContext: body.startingContext ?? null,
      followUp: body.followUp ?? null,
    });
    res.json({ success: true, data: result });
  })
);

router.post(
  '/anchors/:anchorId/chart/plan/adjust',
  planLimiter,
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(AdjustSchema, req.body);
    const result = await chartPlannerService.adjust(userId, {
      anchorId: req.params.anchorId,
      idempotencyKey: body.idempotencyKey,
      reason: body.reason,
      detail: body.detail ?? null,
      courseId: body.courseId ?? null,
      draft: body.draft ?? null,
      startingContext: body.startingContext ?? null,
    });
    res.json({ success: true, data: result });
  })
);

router.post(
  '/anchors/:anchorId/chart',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(CreateSchema, req.body);
    const chart = await chartService.createChart(userId, {
      anchorId: req.params.anchorId,
      idempotencyKey: body.idempotencyKey,
      destinationText: body.destinationText,
      startingContext: body.startingContext ?? null,
      proposalId: body.proposalId ?? null,
      complexity: body.complexity ?? null,
      waypoints: body.waypoints,
      oneMove: body.oneMove ?? null,
    });
    res.status(201).json({ success: true, data: chart });
  })
);

router.put(
  '/charts/:courseId/route',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(ApplyRouteSchema, req.body);
    res.json({ success: true, data: await chartService.applyRoute(userId, req.params.courseId, body) });
  })
);

router.post(
  '/charts/:courseId/moves',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(AddMoveSchema, req.body);
    const chart = await chartService.addMove(userId, req.params.courseId, {
      ...body,
      source: 'USER',
      status: 'ACTIVE',
    });
    res.status(201).json({ success: true, data: chart });
  })
);

router.patch(
  '/charts/:courseId/moves/:moveId',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(UpdateMoveSchema, req.body);
    res.json({
      success: true,
      data: await chartService.updateMove(userId, req.params.courseId, req.params.moveId, body),
    });
  })
);

router.post(
  '/charts/:courseId/moves/:moveId/complete',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    res.json({
      success: true,
      data: await chartService.completeMove(userId, req.params.courseId, req.params.moveId),
    });
  })
);

router.post(
  '/charts/:courseId/moves/:moveId/dismiss',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    res.json({
      success: true,
      data: await chartService.dismissMove(userId, req.params.courseId, req.params.moveId),
    });
  })
);

router.post(
  '/charts/:courseId/waypoints/:waypointId/suggest-moves',
  planLimiter,
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const { courseId, waypointId } = req.params;
    const suggestions = await chartPlannerService.suggestMoves(userId, courseId, waypointId);
    const chart = suggestions.available
      ? await chartService.replaceSuggestedMoves(userId, courseId, waypointId, suggestions.moves)
      : null;
    res.json({ success: true, data: { available: suggestions.available, chart } });
  })
);

router.patch(
  '/charts/:courseId/waypoints/:waypointId/progress',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = validate(ProgressSchema, req.body);
    res.json({
      success: true,
      data: await chartService.updateWaypointProgress(userId, req.params.courseId, req.params.waypointId, body),
    });
  })
);

export default router;
