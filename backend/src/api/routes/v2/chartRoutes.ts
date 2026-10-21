import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { requireChartEnabled, requireChartWriteEnabled } from '../../../config/chartFlags';
import { getAuthenticatedUserId } from './authHelper';
import { chartService } from '../../../services/chart/ChartService';
import { chartPlannerService } from '../../../services/chart/ChartPlannerService';
import { getMonetizationAccess } from '../../../services/MonetizationAccessService';

import {
  globalAiCeilingLimiter,
  chartPlanLimiter,
  chartAdjustLimiter,
  chartPlanConcurrencyGuard,
} from '../../middleware/aiRateLimit';

/**
 * Anchor 2.0 Chart API. A Chart is addressed through its Anchor; route-level
 * operations use the Chart (Course) id. Waypoint completion, edits, reorder and
 * cancellation stay on the canonical /api/courses endpoints.
 */
const router = Router();
router.use(authMiddleware);

const IdempotencyKey = z.string().trim().min(8).max(200);
const Id = z.string().min(1).max(200);
const CourseVersion = z.number().int().min(1);
const MetricNumber = z.number().finite().min(-1e12).max(1e12);

const WaypointKind = z.enum(['MILESTONE', 'METRIC', 'CAPABILITY']);
const ProgressMode = z.enum(['numeric', 'checklist', 'completion', 'moves', 'none']);
const RouteWaypoint = z
  .object({
    id: Id.nullish(),
    title: z.string().trim().min(1).max(60),
    rationale: z.string().max(400).nullish(),
    kind: WaypointKind.optional(),
    progressMode: ProgressMode.optional(),
    metricLabel: z.string().max(40).nullish(),
    metricBaseline: MetricNumber.nullish(),
    metricTarget: MetricNumber.nullish(),
    completionCriteria: z.string().trim().max(400).nullish(),
    requirements: z.array(z.object({ id: z.string().min(1).max(80), title: z.string().trim().min(1).max(140), completed: z.boolean() }).strict()).max(12).optional(),
    suggestedMoves: z.array(z.object({ title: z.string().trim().min(1).max(120), rationale: z.string().max(280).nullish() }).strict()).max(4).optional(),
  })
  .strict();

/**
 * Optional references the person attached while describing where they are starting.
 * Photos are Vision assets the client already uploaded (POST /api/v2/assets/upload). Places are
 * text plus optional coordinates. Documents are plain text, used for one request and never stored.
 */
const ChartReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('photo'), assetId: z.string().uuid(), role: z.enum(['start', 'extra']).default('extra') }).strict(),
  z
    .object({
      kind: z.literal('place'),
      label: z.string().trim().min(1).max(120),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('document'), name: z.string().trim().min(1).max(80), text: z.string().trim().min(1).max(6000) }).strict(),
]);

const PlanSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    startingContext: z.string().max(500).nullish(),
    actualStartingPoint: z.string().max(500).nullish(),
    destinationDescription: z.string().max(500).nullish(),
    followUp: z
      // The answer may be empty when a reference answers the question instead.
      .object({ question: z.string().min(1).max(200), answer: z.string().trim().max(500).default('') })
      .strict()
      .nullish(),
    references: z.array(ChartReferenceSchema).max(4).nullish(),
  })
  .strict()
  .refine(value => !value.followUp || value.followUp.answer.length > 0 || (value.references?.length ?? 0) > 0, {
    message: 'A follow-up needs an answer or a reference',
    path: ['followUp'],
  });

const AdjustSchema = z
  .object({
    idempotencyKey: IdempotencyKey,
    reason: z.enum([
      'SMALLER_STEPS', 'STARTING_FROM_ZERO', 'CHANGE_APPROACH',
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
    actualStartingPoint: z.string().max(500).nullish(),
    destinationDescription: z.string().max(500).nullish(),
    draft: z
      .object({
        destination: z.string().trim().min(1).max(140),
        waypoints: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(60),
                kind: WaypointKind.optional(),
                progressMode: ProgressMode.optional(),
                metricTarget: MetricNumber.nullish(),
                completionCriteria: z.string().max(400).nullish(),
                metricBaseline: MetricNumber.nullish(),
                metricCurrent: MetricNumber.nullish(),
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
    actualStartingPoint: z.string().max(500).nullish(),
    destinationDescription: z.string().max(500).nullish(),
    proposalId: Id.nullish(),
    routeScope: z.enum(['DESTINATION', 'NEXT_STRETCH']).optional(),
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
    routeScope: z.enum(['DESTINATION', 'NEXT_STRETCH']).optional(),
    oneMove: z.object({ title: z.string().trim().min(1).max(120), rationale: z.string().max(280).nullish() }).strict().nullish(),
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
  .object({ expectedCourseVersion: CourseVersion, metricCurrent: MetricNumber.nullable().optional(), requirementId: z.string().min(1).max(80).optional(), completed: z.boolean().optional() })
  .strict()
  .refine(v => (v.metricCurrent !== undefined) !== (v.requirementId !== undefined && v.completed !== undefined), { message: 'Provide a numeric value or a checklist item update' });

const ArchiveDeleteSchema = z
  .object({ expectedCourseVersion: CourseVersion.optional() })
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

/**
 * Creating a Chart (planning a route, revising a draft, saving it) is Pro. Opening and
 * working an existing Chart stays open to every account. Checked before `writeUser`
 * so a refused request leaves no trace.
 */
async function requireChartCreationAccess(req: AuthRequest): Promise<void> {
  requireChartWriteEnabled();
  const access = await getMonetizationAccess(await getAuthenticatedUserId(req));
  if (!access.hasProAccess) {
    throw new AppError('Creating a Chart requires Anchor Pro', 403, 'CHART_PREMIUM_REQUIRED');
  }
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
  globalAiCeilingLimiter,
  chartPlanLimiter,
  chartPlanConcurrencyGuard,
  handle(async (req, res) => {
    await requireChartCreationAccess(req);
    const userId = await writeUser(req);
    const body = validate(PlanSchema, req.body);
    const requestId = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string) || undefined;
    const result = await chartPlannerService.generate(userId, {
      anchorId: req.params.anchorId,
      idempotencyKey: body.idempotencyKey,
      startingContext: body.startingContext ?? null,
      actualStartingPoint: body.actualStartingPoint ?? null,
      destinationDescription: body.destinationDescription ?? null,
      followUp: body.followUp ?? null,
      requestId,
      // Added only when present, so text-only clients behave exactly as before.
      ...(body.references?.length ? { references: body.references } : {}),
    });
    res.json({ success: true, data: result });
  })
);

router.post(
  '/anchors/:anchorId/chart/plan/adjust',
  globalAiCeilingLimiter,
  chartAdjustLimiter,
  handle(async (req, res) => {
    const body = validate(AdjustSchema, req.body);
    // Revising a draft is part of creating; adjusting a saved Chart is not.
    if (!body.courseId) await requireChartCreationAccess(req);
    const userId = await writeUser(req);
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
    await requireChartCreationAccess(req);
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
  globalAiCeilingLimiter,
  chartAdjustLimiter,
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

router.post(
  '/charts/:courseId/archive',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = req.body && Object.keys(req.body).length > 0 ? validate(ArchiveDeleteSchema, req.body) : {};
    res.json({
      success: true,
      data: await chartService.archiveChart(userId, { courseId: req.params.courseId }, body.expectedCourseVersion),
    });
  })
);

router.delete(
  '/charts/:courseId',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = req.body && Object.keys(req.body).length > 0 ? validate(ArchiveDeleteSchema, req.body) : {};
    res.json({
      success: true,
      data: await chartService.deleteChart(userId, { courseId: req.params.courseId }, body.expectedCourseVersion),
    });
  })
);

router.post(
  '/anchors/:anchorId/chart/archive',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = req.body && Object.keys(req.body).length > 0 ? validate(ArchiveDeleteSchema, req.body) : {};
    res.json({
      success: true,
      data: await chartService.archiveChart(userId, { anchorId: req.params.anchorId }, body.expectedCourseVersion),
    });
  })
);

router.delete(
  '/anchors/:anchorId/chart',
  handle(async (req, res) => {
    const userId = await writeUser(req);
    const body = req.body && Object.keys(req.body).length > 0 ? validate(ArchiveDeleteSchema, req.body) : {};
    res.json({
      success: true,
      data: await chartService.deleteChart(userId, { anchorId: req.params.anchorId }, body.expectedCourseVersion),
    });
  })
);

export default router;
