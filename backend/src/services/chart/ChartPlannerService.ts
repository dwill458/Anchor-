import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../api/middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { getChartFeatureFlags } from '../../config/chartFlags';
import { logger } from '../../utils/logger';
import {
  ChartProviderError,
  resolveChartPlannerConfig,
  type ChartModelProvider,
  type ChartPlannerConfig,
} from './chartModelProviders';
import {
  CHART_PLANNER_SYSTEM,
  MOVE_SUGGESTION_SYSTEM,
  buildMoveSuggestionMessage,
  buildPlanningUserMessage,
  type ChartAdjustmentReason,
  type ChartPlanningContext,
  type ChartRouteWaypointContext,
} from './chartPlanPrompt';
import {
  ChartPlanValidationError,
  GENERATION_JSON_SCHEMA,
  MOVE_SUGGESTIONS_JSON_SCHEMA,
  normalizeGenerationResult,
  normalizeMoveSuggestions,
  type ChartComplexity,
  type ChartGenerationResult,
  type PlannedMove,
  type PlannedWaypoint,
} from './chartPlanSchema';
import { buildTemplateRoute } from './chartTemplateRoute';

export const CHART_PLANNER_VERSION = 'chart-2.0';
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
/** A transient provider error is retried once, only if it failed fast. */
const RETRY_WINDOW_MS = 4_000;

export type ChartProposalWaypoint = PlannedWaypoint & { clientKey: string };

export type ChartProposal = {
  proposalId: string;
  kind: 'CREATE' | 'ADJUST';
  anchorId: string | null;
  courseId: string | null;
  baseCourseVersion: number | null;
  destination: string;
  complexity: ChartComplexity;
  waypoints: ChartProposalWaypoint[];
  suggestedOneMove: PlannedMove | null;
  guidance: string | null;
  /**
   * `ai` means a model produced the route; `template` means the deterministic
   * outline. `fallbackUsed` is analytics-only and never names a provider.
   */
  generation: { source: 'ai' | 'template'; fallbackUsed: boolean; needsNaming: boolean };
  createdAt: string;
  expiresAt: string;
};

export type ChartPlanResponse =
  | { status: 'needs_context'; followUpQuestion: string }
  | { status: 'proposal'; proposal: ChartProposal };

export type ChartDraftRoute = {
  destination: string;
  waypoints: Array<{ title: string; kind?: string; metricTarget?: number | null; metricLabel?: string | null }>;
};

type ChainOutcome<T> =
  | { ok: true; value: T; provider: ChartModelProvider; fallbackUsed: boolean }
  | { ok: false; reason: string };

const PersistedWaypointSchemaKeys = [
  'clientKey',
  'title',
  'rationale',
  'kind',
  'metricLabel',
  'metricTarget',
  'metricBaseline',
] as const;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function scopedKey(userId: string, scope: string, key: string): string {
  return digest(`chart-plan:${scope}:${userId}:${key}`);
}

function describeFailure(error: unknown): string {
  if (error instanceof ChartProviderError) return error.failure;
  if (error instanceof ChartPlanValidationError) return `invalid_${error.reason}`;
  return 'unknown';
}

function toWaypointContext(waypoint: {
  title: string;
  reachedAt: Date | null;
  id: string;
  metricTarget: number | null;
  metricLabel: string | null;
}, currentWaypointId: string | null): ChartRouteWaypointContext {
  return {
    title: waypoint.title,
    state: waypoint.reachedAt ? 'REACHED' : waypoint.id === currentWaypointId ? 'CURRENT' : 'UPCOMING',
    metric:
      waypoint.metricTarget !== null
        ? `${waypoint.metricTarget}${waypoint.metricLabel ? ` ${waypoint.metricLabel}` : ''}`
        : null,
  };
}

function parsePersistedWaypoints(value: Prisma.JsonValue): ChartProposalWaypoint[] {
  if (!Array.isArray(value)) throw new AppError('Proposal is no longer available', 409, 'PROPOSAL_UNAVAILABLE');
  return value.map(item => {
    const record = (item ?? {}) as Record<string, unknown>;
    for (const key of PersistedWaypointSchemaKeys) {
      if (!(key in record)) throw new AppError('Proposal is no longer available', 409, 'PROPOSAL_UNAVAILABLE');
    }
    return record as unknown as ChartProposalWaypoint;
  });
}

export class ChartPlannerService {
  constructor(private readonly configFactory: () => ChartPlannerConfig = () => resolveChartPlannerConfig()) {}

  /**
   * Runs the provider chain for one structured request.
   * PRIMARY → (retry once if fast + transient) → FALLBACK → caller's template.
   */
  private async runChain<T>(
    purpose: 'route' | 'moves',
    build: (provider: ChartModelProvider, timeoutMs: number) => Promise<T>
  ): Promise<ChainOutcome<T>> {
    const flags = getChartFeatureFlags();
    if (!flags.chart_ai_planner_enabled) return { ok: false, reason: 'planner_disabled' };
    const config = this.configFactory();
    if (config.providers.length === 0) return { ok: false, reason: 'provider_not_configured' };

    let lastReason = 'unknown';
    for (const [index, provider] of config.providers.entries()) {
      const timeoutMs = index === 0 ? config.primaryTimeoutMs : config.fallbackTimeoutMs;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const started = Date.now();
        try {
          const value = await build(provider, timeoutMs);
          logger.info('chart_planner_attempt', {
            purpose,
            provider: provider.name,
            model: provider.model,
            outcome: 'success',
            fallback: index > 0,
            latencyMs: Date.now() - started,
          });
          return { ok: true, value, provider, fallbackUsed: index > 0 };
        } catch (error) {
          lastReason = describeFailure(error);
          const elapsed = Date.now() - started;
          logger.warn('chart_planner_attempt', {
            purpose,
            provider: provider.name,
            model: provider.model,
            outcome: lastReason,
            fallback: index > 0,
            latencyMs: elapsed,
          });
          const retry =
            attempt === 0 &&
            error instanceof ChartProviderError &&
            error.retryable &&
            elapsed < RETRY_WINDOW_MS;
          if (!retry) break;
        }
      }
    }
    return { ok: false, reason: lastReason };
  }

  private async loadAnchorContext(userId: string, anchorId: string) {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId },
      select: { id: true, intentionText: true, category: true, releasedAt: true, isArchived: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    if (anchor.releasedAt || anchor.isArchived) {
      throw new AppError('This Anchor has been released', 409, 'ANCHOR_UNAVAILABLE');
    }
    const vision = await prisma.vision.findFirst({
      where: { anchorId, userId, status: 'ACTIVE' },
      select: { id: true, title: true, description: true },
      orderBy: { updatedAt: 'desc' },
    });
    return { anchor, vision };
  }

  async generate(
    userId: string,
    input: {
      anchorId: string;
      idempotencyKey: string;
      startingContext?: string | null;
      followUp?: { question: string; answer: string } | null;
    }
  ): Promise<ChartPlanResponse> {
    const key = scopedKey(userId, 'create', input.idempotencyKey);
    const replay = await prisma.aIPlanProposal.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      if (replay.userId !== userId) {
        throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
      }
      return { status: 'proposal', proposal: this.toProposal(replay) };
    }

    const { anchor, vision } = await this.loadAnchorContext(userId, input.anchorId);
    const startingContext = input.startingContext?.trim() || null;
    const context: ChartPlanningContext = {
      intention: anchor.intentionText,
      category: anchor.category,
      startingContext,
      vision: vision && (vision.title || vision.description) ? { title: vision.title, description: vision.description } : null,
      followUp: input.followUp?.answer?.trim() ? input.followUp : null,
      adjustment: null,
    };
    // Exactly one follow-up per creation: once answered, the planner must plan.
    const allowFollowUp = !context.followUp;

    const outcome = await this.runChain<ChartGenerationResult>('route', (provider, timeoutMs) =>
      provider
        .generateJson({
          schemaName: 'chart_route',
          jsonSchema: GENERATION_JSON_SCHEMA as unknown as Record<string, unknown>,
          system: CHART_PLANNER_SYSTEM,
          user: buildPlanningUserMessage(context, { allowFollowUp }),
          timeoutMs,
          temperature: 0.4,
        })
        .then(raw => normalizeGenerationResult(raw, { allowFollowUp }))
    );

    if (outcome.ok && outcome.value.needsMoreContext) {
      return { status: 'needs_context', followUpQuestion: outcome.value.followUpQuestion };
    }

    const inputHash = digest(
      JSON.stringify({ anchorId: anchor.id, startingContext, followUp: context.followUp?.answer ?? null })
    );
    return {
      status: 'proposal',
      proposal: await this.persist(userId, {
        idempotencyKey: key,
        kind: 'CREATE',
        anchorId: anchor.id,
        courseId: null,
        baseCourseVersion: null,
        startingContext,
        inputHash,
        outcome,
        templateSource: { intention: anchor.intentionText, startingContext },
      }),
    };
  }

  /**
   * Revises a route. For a draft (not yet saved) the client sends its edited
   * route; for an active Chart the server reads the route itself and reached
   * waypoints are passed as locked history the model may not rewrite.
   */
  async adjust(
    userId: string,
    input: {
      idempotencyKey: string;
      anchorId: string;
      reason: ChartAdjustmentReason;
      detail?: string | null;
      courseId?: string | null;
      draft?: ChartDraftRoute | null;
      startingContext?: string | null;
    }
  ): Promise<ChartPlanResponse> {
    const key = scopedKey(userId, 'adjust', input.idempotencyKey);
    const replay = await prisma.aIPlanProposal.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      if (replay.userId !== userId) {
        throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
      }
      return { status: 'proposal', proposal: this.toProposal(replay) };
    }

    const { anchor, vision } = await this.loadAnchorContext(userId, input.anchorId);
    let destination: string;
    let route: ChartRouteWaypointContext[];
    let completedMoveCount = 0;
    let baseCourseVersion: number | null = null;
    let startingContext = input.startingContext?.trim() || null;
    let hasReached = false;

    if (input.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: input.courseId, userId, deletedAt: null, anchorId: anchor.id },
        include: { waypoints: { orderBy: { position: 'asc' } } },
      });
      if (!course) throw new AppError('Chart not found', 404, 'COURSE_NOT_FOUND');
      if (course.status !== 'ACTIVE') throw new AppError('Chart is not active', 409, 'COURSE_NOT_ACTIVE');
      destination = course.destinationText;
      startingContext = startingContext ?? course.startingContext;
      baseCourseVersion = course.version;
      const live = course.waypoints.filter(waypoint => !waypoint.cancelledAt && !waypoint.skippedAt);
      route = live.map(waypoint => toWaypointContext(waypoint, course.currentWaypointId));
      hasReached = route.some(waypoint => waypoint.state === 'REACHED');
      completedMoveCount = await prisma.move.count({ where: { courseId: course.id, status: 'COMPLETED' } });
    } else if (input.draft) {
      destination = input.draft.destination;
      route = input.draft.waypoints.slice(0, 12).map(waypoint => ({
        title: waypoint.title,
        state: 'UPCOMING' as const,
        metric:
          typeof waypoint.metricTarget === 'number'
            ? `${waypoint.metricTarget}${waypoint.metricLabel ? ` ${waypoint.metricLabel}` : ''}`
            : null,
      }));
    } else {
      throw new AppError('A route to adjust is required', 400, 'VALIDATION_ERROR');
    }

    const context: ChartPlanningContext = {
      intention: anchor.intentionText,
      category: anchor.category,
      startingContext,
      vision: vision && (vision.title || vision.description) ? { title: vision.title, description: vision.description } : null,
      followUp: null,
      adjustment: {
        reason: input.reason,
        detail: input.detail?.trim() || null,
        destination,
        route,
        completedMoveCount,
      },
    };
    const minWaypoints = hasReached ? 1 : 2;
    const outcome = await this.runChain<ChartGenerationResult>('route', (provider, timeoutMs) =>
      provider
        .generateJson({
          schemaName: 'chart_route',
          jsonSchema: GENERATION_JSON_SCHEMA as unknown as Record<string, unknown>,
          system: CHART_PLANNER_SYSTEM,
          user: buildPlanningUserMessage(context, { allowFollowUp: false }),
          timeoutMs,
          temperature: 0.4,
        })
        .then(raw => normalizeGenerationResult(raw, { allowFollowUp: false, minWaypoints }))
    );

    if (!outcome.ok) {
      // An adjustment has no honest deterministic equivalent: rewriting the
      // user's route into a generic outline would lose their work. Surface it.
      throw new AppError(
        'We couldn’t revise the route right now. Your route is unchanged — you can edit it directly.',
        503,
        'CHART_ADJUST_UNAVAILABLE'
      );
    }

    const inputHash = digest(
      JSON.stringify({ reason: input.reason, detail: input.detail ?? null, route, destination })
    );
    return {
      status: 'proposal',
      proposal: await this.persist(userId, {
        idempotencyKey: key,
        kind: 'ADJUST',
        anchorId: anchor.id,
        courseId: input.courseId ?? null,
        baseCourseVersion,
        startingContext,
        inputHash,
        outcome,
        templateSource: null,
      }),
    };
  }

  /** AI-suggested Moves for one waypoint. Empty (not an error) when unavailable. */
  async suggestMoves(
    userId: string,
    courseId: string,
    waypointId: string
  ): Promise<{ moves: PlannedMove[]; available: boolean }> {
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId, deletedAt: null },
      include: {
        waypoints: { where: { id: waypointId } },
        moves: { where: { waypointId, status: { in: ['ACTIVE', 'COMPLETED', 'SUGGESTED'] } } },
        anchor: { select: { intentionText: true, category: true } },
      },
    });
    const waypoint = course?.waypoints[0];
    if (!course || !waypoint) throw new AppError('Waypoint not found', 404, 'WAYPOINT_NOT_FOUND');
    const existing = course.moves.map(move => move.title);
    const message = buildMoveSuggestionMessage({
      intention: course.anchor?.intentionText ?? course.destinationText,
      category: course.anchor?.category ?? 'custom',
      destination: course.destinationText,
      startingContext: course.startingContext,
      waypoint: {
        title: waypoint.title,
        rationale: waypoint.description,
        metric:
          waypoint.metricTarget !== null
            ? `${waypoint.metricTarget}${waypoint.metricLabel ? ` ${waypoint.metricLabel}` : ''}`
            : null,
      },
      existingMoves: existing,
    });
    const outcome = await this.runChain<PlannedMove[]>('moves', (provider, timeoutMs) =>
      provider
        .generateJson({
          schemaName: 'chart_moves',
          jsonSchema: MOVE_SUGGESTIONS_JSON_SCHEMA as unknown as Record<string, unknown>,
          system: MOVE_SUGGESTION_SYSTEM,
          user: message,
          timeoutMs: Math.min(timeoutMs, 15_000),
          temperature: 0.5,
        })
        .then(raw => normalizeMoveSuggestions(raw, existing))
    );
    return outcome.ok ? { moves: outcome.value, available: true } : { moves: [], available: false };
  }

  async get(userId: string, proposalId: string): Promise<ChartProposal> {
    const row = await prisma.aIPlanProposal.findFirst({ where: { id: proposalId, userId } });
    if (!row) throw new AppError('Proposal is unavailable', 404, 'PROPOSAL_UNAVAILABLE');
    return this.toProposal(row);
  }

  private async persist(
    userId: string,
    input: {
      idempotencyKey: string;
      kind: 'CREATE' | 'ADJUST';
      anchorId: string;
      courseId: string | null;
      baseCourseVersion: number | null;
      startingContext: string | null;
      inputHash: string;
      outcome: ChainOutcome<ChartGenerationResult>;
      templateSource: { intention: string; startingContext: string | null } | null;
    }
  ): Promise<ChartProposal> {
    let destination: string;
    let complexity: ChartComplexity;
    let waypoints: PlannedWaypoint[];
    let suggestedOneMove: PlannedMove | null = null;
    let guidance: string | null = null;
    let generationSource: string;
    let modelVersion: string;
    let fallbackReason: string | null = null;

    if (input.outcome.ok && !input.outcome.value.needsMoreContext) {
      const plan = input.outcome.value;
      destination = plan.destination;
      complexity = plan.complexity;
      waypoints = plan.waypoints;
      suggestedOneMove = plan.suggestedOneMove;
      guidance = plan.personalizedGuidance;
      generationSource = input.outcome.provider.name;
      modelVersion = input.outcome.provider.model;
      fallbackReason = input.outcome.fallbackUsed ? 'primary_failed' : null;
    } else {
      if (!input.templateSource) {
        throw new AppError('Route generation is unavailable', 503, 'CHART_ADJUST_UNAVAILABLE');
      }
      const template = buildTemplateRoute(input.templateSource);
      destination = template.destination;
      complexity = template.complexity;
      waypoints = template.waypoints;
      generationSource = template.needsNaming ? 'template_outline' : 'template_metric';
      modelVersion = 'deterministic-v2';
      fallbackReason = input.outcome.ok ? 'unexpected_follow_up' : input.outcome.reason;
    }

    const persistedWaypoints: ChartProposalWaypoint[] = waypoints.map(waypoint => ({
      clientKey: randomUUID(),
      ...waypoint,
    }));
    const createdAt = new Date();
    try {
      const row = await prisma.aIPlanProposal.create({
        data: {
          userId,
          courseId: input.courseId,
          anchorId: input.anchorId,
          kind: input.kind,
          baseCourseVersion: input.baseCourseVersion,
          plannerVersion: CHART_PLANNER_VERSION,
          modelVersion,
          inputHash: input.inputHash,
          destinationInterpretation: destination.slice(0, 280),
          startingContext: input.startingContext?.slice(0, 500) ?? null,
          complexity,
          suggestedOneMove: (suggestedOneMove ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          guidance,
          waypoints: persistedWaypoints as unknown as Prisma.InputJsonValue,
          generationSource,
          fallbackReason,
          status: 'PENDING',
          createdAt,
          expiresAt: new Date(createdAt.getTime() + PROPOSAL_TTL_MS),
          idempotencyKey: input.idempotencyKey,
        },
      });
      return this.toProposal(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await prisma.aIPlanProposal.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (replay && replay.userId === userId) return this.toProposal(replay);
      }
      throw error;
    }
  }

  toProposal(row: {
    id: string;
    kind: string;
    anchorId: string | null;
    courseId: string | null;
    baseCourseVersion: number | null;
    destinationInterpretation: string;
    complexity: string | null;
    waypoints: Prisma.JsonValue;
    suggestedOneMove: Prisma.JsonValue;
    guidance: string | null;
    generationSource: string;
    fallbackReason: string | null;
    createdAt: Date;
    expiresAt: Date;
  }): ChartProposal {
    const waypoints = parsePersistedWaypoints(row.waypoints);
    const isTemplate = row.generationSource.startsWith('template');
    const oneMove = row.suggestedOneMove as { title?: unknown; rationale?: unknown } | null;
    return {
      proposalId: row.id,
      kind: row.kind === 'ADJUST' ? 'ADJUST' : 'CREATE',
      anchorId: row.anchorId,
      courseId: row.courseId,
      baseCourseVersion: row.baseCourseVersion,
      destination: row.destinationInterpretation,
      complexity: (row.complexity as ChartComplexity | null) ?? 'SIMPLE',
      waypoints,
      suggestedOneMove:
        oneMove && typeof oneMove.title === 'string'
          ? { title: oneMove.title, rationale: typeof oneMove.rationale === 'string' ? oneMove.rationale : null }
          : null,
      guidance: row.guidance,
      generation: {
        source: isTemplate ? 'template' : 'ai',
        fallbackUsed: !isTemplate && row.fallbackReason !== null,
        needsNaming: row.generationSource === 'template_outline',
      },
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  }
}

export const chartPlannerService = new ChartPlannerService();
