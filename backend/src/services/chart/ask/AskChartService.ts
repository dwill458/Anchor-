import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../api/middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { getChartFeatureFlags } from '../../../config/chartFlags';
import { logger } from '../../../utils/logger';
import { readPrivateImageAsset } from '../../StorageService';
import type { CourseDetail } from '../../../types/chart';
import { chartService } from '../ChartService';
import { chartPlannerService } from '../ChartPlannerService';
import {
  ChartProviderError,
  resolveAskChartConfig,
  type AskChartConfig,
  type ChartModelImage,
  type ChartModelProvider,
  type ChartModelTurn,
} from '../chartModelProviders';
import {
  ASK_SKILLS,
  buildAgentSystem,
  loadChartAgent,
  type AskSkill,
  type ChartAgent,
} from './chartAgent';
import {
  ASK_TURN_JSON_SCHEMA,
  AskTurnInvalidError,
  extractStreamingReply,
  normalizeAskTurn,
  type AskTurn,
} from './askChartSchema';
import { loadAskContext, type AskContext } from './askChartContext';
import { buildAskUserMessage } from './askChartPrompt';
import {
  askChartStore,
  scopedMessageKey,
  toMessageDTO,
  type AskActionDTO,
  type AskMessageDTO,
} from './askChartStore';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const HISTORY_TURNS = 16;
const HISTORY_CHARS = 1200;
const MAX_ATTACHMENTS = 3;
const RETRY_WINDOW_MS = 4_000;
const DEADLINE_MS = 50_000;

export type AskTurnInput = {
  anchorId: string;
  idempotencyKey: string;
  text: string;
  /** The caller's own uploaded Asset ids (POST /api/v2/assets/upload). */
  attachments: string[];
  skill: AskSkill;
  /** Focus the turn on one move (e.g. "break this down"). Must belong to the Chart; otherwise ignored. */
  targetMoveId?: string | null;
  conversationId?: string | null;
  /**
   * The person has just opened Ask Chart and said nothing yet: Ask Chart greets them from what the app already
   * knows. No user message is saved. Only valid for an empty conversation.
   */
  opening?: boolean;
  requestId?: string;
};

export type AskTurnResult = {
  conversationId: string;
  mode: 'CREATE' | 'ONGOING';
  /** Null for an opening turn. */
  userMessage: AskMessageDTO | null;
  assistantMessage: AskMessageDTO;
  remembered: { key: string; value: string } | null;
  generation: { source: 'ai'; fallbackUsed: boolean };
  replayed: boolean;
};

export type AskTurnHooks = {
  /** The reply written so far (replaces, not appends). Only called when a provider streams. */
  onReply?: (text: string) => void;
  /** A real processing stage beyond the model call (e.g. preparing a route change). */
  onStage?: (stage: 'preparing_change') => void;
};

type RunOutcome = {
  turn: AskTurn;
  provider: ChartModelProvider;
  fallbackUsed: boolean;
  latencyMs: number;
};

function describeFailure(error: unknown): string {
  if (error instanceof ChartProviderError) return error.failure;
  if (error instanceof AskTurnInvalidError) return `invalid_${error.reason}`;
  return 'unknown';
}

/** What the model is told when there is no user message. The agent file explains it. */
const OPENING_MESSAGE =
  '(opening: the person has just opened Ask Chart and has not said anything yet)';

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export class AskChartService {
  private agentCache: ChartAgent | null = null;

  constructor(
    private readonly configFactory: () => AskChartConfig = () => resolveAskChartConfig()
  ) {}

  private get agent(): ChartAgent {
    return (this.agentCache ??= loadChartAgent());
  }

  /** PRIMARY → (retry once if fast + transient) → FALLBACK. Never a template: an unavailable coach says so. */
  private async run(
    request: {
      system: string;
      user: string;
      history: ChartModelTurn[];
      images: ChartModelImage[];
    },
    onReply?: (text: string) => void
  ): Promise<RunOutcome> {
    const config = this.configFactory();
    if (config.providers.length === 0)
      throw new AppError('Ask Chart is not available right now', 503, 'ASK_UNAVAILABLE');
    const deadline = Date.now() + DEADLINE_MS;
    let lastReason = 'unknown';
    for (const [index, provider] of config.providers.slice(0, 2).entries()) {
      const timeoutMs = index === 0 ? config.primaryTimeoutMs : config.fallbackTimeoutMs;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const started = Date.now();
        if (started >= deadline) throw new AppError('Ask Chart took too long', 504, 'ASK_TIMEOUT');
        try {
          let lastSent = '';
          const modelRequest = {
            schemaName: 'ask_chart_turn',
            jsonSchema: ASK_TURN_JSON_SCHEMA as unknown as Record<string, unknown>,
            system: request.system,
            user: request.user,
            history: request.history,
            ...(request.images.length ? { images: request.images } : {}),
            timeoutMs: Math.min(timeoutMs, deadline - started),
            temperature: 0.6,
          };
          const raw =
            onReply && provider.streamJson
              ? await provider.streamJson(modelRequest, accumulated => {
                  const { text } = extractStreamingReply(accumulated);
                  if (text && text !== lastSent) {
                    lastSent = text;
                    onReply(text);
                  }
                })
              : await provider.generateJson(modelRequest);
          const turn = normalizeAskTurn(raw);
          const latencyMs = Date.now() - started;
          logger.info('ask_chart_attempt', {
            provider: provider.name,
            model: provider.model,
            agentVersion: this.agent.version,
            outcome: 'success',
            fallback: index > 0,
            streamed: Boolean(onReply),
            latencyMs,
          });
          return { turn, provider, fallbackUsed: index > 0, latencyMs };
        } catch (error) {
          lastReason = describeFailure(error);
          const elapsed = Date.now() - started;
          logger.warn('ask_chart_attempt', {
            provider: provider.name,
            model: provider.model,
            agentVersion: this.agent.version,
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
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    throw new AppError('Ask Chart could not answer right now', 503, 'ASK_UNAVAILABLE', {
      reason: lastReason,
    });
  }

  /** The caller's own photos, read once for this request. Bytes are never stored or logged. */
  private async loadImages(userId: string, assetIds: string[]): Promise<ChartModelImage[]> {
    const images: ChartModelImage[] = [];
    for (const assetId of assetIds.slice(0, MAX_ATTACHMENTS)) {
      const asset = await prisma.asset.findFirst({
        where: { id: assetId, userId },
        select: { storageKey: true, mimeType: true },
      });
      if (!asset) throw new AppError('Photo not found', 404, 'ASSET_NOT_FOUND');
      if (!IMAGE_TYPES.includes(asset.mimeType))
        throw new AppError('Unsupported photo type', 400, 'VALIDATION_ERROR');
      try {
        images.push({
          mimeType: asset.mimeType,
          base64: (await readPrivateImageAsset(asset.storageKey)).toString('base64'),
        });
      } catch {
        throw new AppError(
          'That photo could not be read. Try attaching it again.',
          422,
          'ASSET_UNREADABLE'
        );
      }
    }
    return images;
  }

  /**
   * Checks a proposed action against the real Chart. Returns null for anything the Chart cannot support;
   * ids the model made up, finished waypoints and moves the person already has are all dropped here.
   */
  private async resolveAction(
    userId: string,
    anchorId: string,
    context: AskContext,
    turn: AskTurn,
    assistantMessageId: string,
    hooks: AskTurnHooks
  ): Promise<{ action: AskActionDTO | null; unavailable: boolean }> {
    const proposed = turn.action;
    const chart = context.chart;
    if (!proposed || !chart) return { action: null, unavailable: false };

    if (proposed.type === 'ADD_MOVES') {
      const waypoint =
        chart.waypoints.find(
          item => item.id === (proposed.waypointId ?? chart.currentWaypointId)
        ) ?? null;
      if (!waypoint || waypoint.state === 'REACHED') return { action: null, unavailable: true };
      const existing = new Set(waypoint.moves.map(move => normalizeTitle(move.title)));
      const fresh = proposed.moves.filter(move => {
        const key = normalizeTitle(move.title);
        if (!key || existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      if (fresh.length === 0) return { action: null, unavailable: false };
      return {
        action: {
          type: 'ADD_MOVES',
          status: 'PENDING',
          summary:
            proposed.summary ||
            `Add ${fresh.length === 1 ? 'a move' : `${fresh.length} moves`} to ${waypoint.title}`,
          waypointId: waypoint.id,
          waypointTitle: waypoint.title,
          moves: fresh,
          reason: null,
          detail: null,
          routeProposalId: null,
          routeTitles: null,
          baseCourseVersion: chart.version,
        },
        unavailable: false,
      };
    }

    // REVISE_ROUTE: build a real revision with the existing planner. A template result is not a personalised
    // revision, so it is never offered as one.
    hooks.onStage?.('preparing_change');
    try {
      const response = await chartPlannerService.adjust(userId, {
        anchorId,
        idempotencyKey: `ask-revise:${assistantMessageId}`,
        reason: proposed.reason ?? 'OTHER',
        detail: proposed.detail,
        courseId: chart.courseId,
      });
      if (response.status !== 'proposal' || response.proposal.generation.source !== 'ai') {
        return { action: null, unavailable: true };
      }
      const { proposal } = response;
      return {
        action: {
          type: 'REVISE_ROUTE',
          status: 'PENDING',
          summary: proposed.summary || 'Adjust your route',
          waypointId: null,
          waypointTitle: null,
          moves: [],
          reason: proposed.reason ?? 'OTHER',
          detail: proposed.detail,
          routeProposalId: proposal.proposalId,
          routeTitles: proposal.waypoints.map(waypoint => waypoint.title),
          baseCourseVersion: proposal.baseCourseVersion,
        },
        unavailable: false,
      };
    } catch (error) {
      logger.warn('ask_chart_revision_unavailable', { reason: describeFailure(error) });
      return { action: null, unavailable: true };
    }
  }

  async turn(
    userId: string,
    input: AskTurnInput,
    hooks: AskTurnHooks = {}
  ): Promise<AskTurnResult> {
    if (!getChartFeatureFlags().chart_ai_planner_enabled) {
      throw new AppError('Ask Chart is not available right now', 503, 'ASK_DISABLED');
    }
    const opening = Boolean(input.opening) && input.attachments.length === 0;
    const text = opening ? OPENING_MESSAGE : input.text.trim();
    if (!text && input.attachments.length === 0)
      throw new AppError('Say something or attach a photo', 400, 'VALIDATION_ERROR');

    const context = await loadAskContext(userId, input.anchorId);
    const mode: 'CREATE' | 'ONGOING' = context.chart ? 'ONGOING' : 'CREATE';
    const courseId = context.chart?.courseId ?? null;
    const skill: AskSkill = !ASK_SKILLS.includes(input.skill)
      ? 'FREE'
      : mode === 'CREATE'
        ? 'CREATION'
        : input.skill === 'CREATION'
          ? 'FREE'
          : input.skill;
    const messageKey = scopedMessageKey(userId, input.idempotencyKey);

    // A retried send returns the answer already given, or (if the model never answered) answers the stored message.
    const existing = await prisma.chartMessage.findUnique({
      where: { idempotencyKey: messageKey },
      select: { ...askChartStore.MESSAGE_SELECT, userId: true, conversationId: true, meta: true },
    });
    if (existing && existing.userId !== userId) {
      throw new AppError('Idempotency key has already been used', 409, 'IDEMPOTENCY_CONFLICT');
    }
    if (existing?.role === 'ASSISTANT') {
      // A replayed opening: the greeting is the message that carries the key.
      const meta = (existing.meta ?? {}) as { fallbackUsed?: boolean };
      return {
        conversationId: existing.conversationId,
        mode,
        userMessage: null,
        assistantMessage: toMessageDTO(existing),
        remembered: null,
        generation: { source: 'ai', fallbackUsed: Boolean(meta.fallbackUsed) },
        replayed: true,
      };
    }
    if (existing) {
      const reply = await prisma.chartMessage.findFirst({
        where: {
          conversationId: existing.conversationId,
          role: 'ASSISTANT',
          createdAt: { gt: existing.createdAt },
        },
        orderBy: { createdAt: 'asc' },
        select: { ...askChartStore.MESSAGE_SELECT, meta: true },
      });
      if (reply) {
        const meta = (reply.meta ?? {}) as { fallbackUsed?: boolean };
        return {
          conversationId: existing.conversationId,
          mode,
          userMessage: toMessageDTO(existing),
          assistantMessage: toMessageDTO(reply),
          remembered: null,
          generation: { source: 'ai', fallbackUsed: Boolean(meta.fallbackUsed) },
          replayed: true,
        };
      }
    }

    // Find (or adopt/create) the conversation for this Anchor's Chart.
    let conversation = input.conversationId
      ? await prisma.chartConversation.findFirst({
          where: { id: input.conversationId, userId, anchorId: input.anchorId },
          select: { id: true },
        })
      : await prisma.chartConversation.findFirst({
          where: { userId, anchorId: input.anchorId, courseId },
          orderBy: { lastMessageAt: 'desc' },
          select: { id: true },
        });
    if (input.conversationId && !conversation)
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    if (!conversation && courseId) {
      // The conversation that planned this Chart continues once the Chart exists.
      const planning = await prisma.chartConversation.findFirst({
        where: { userId, anchorId: input.anchorId, courseId: null },
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true },
      });
      if (planning) {
        await prisma.chartConversation.update({ where: { id: planning.id }, data: { courseId } });
        conversation = planning;
      }
    }
    if (!conversation) {
      conversation = await prisma.chartConversation.create({
        data: { userId, anchorId: input.anchorId, courseId, mode },
        select: { id: true },
      });
    }
    const conversationId = conversation.id;

    if (
      opening &&
      (await prisma.chartMessage.findFirst({ where: { conversationId }, select: { id: true } }))
    ) {
      throw new AppError('This conversation has already started', 409, 'ASK_ALREADY_OPEN');
    }

    const images = await this.loadImages(userId, input.attachments);

    const userRow = opening
      ? null
      : (existing ??
        (await prisma.chartMessage.create({
          data: {
            conversationId,
            userId,
            role: 'USER',
            text: text.slice(0, 4000),
            attachments: input.attachments.length
              ? (input.attachments.map(assetId => ({ assetId })) as Prisma.InputJsonValue)
              : Prisma.DbNull,
            skill: skill === 'FREE' ? null : skill,
            idempotencyKey: messageKey,
          },
          select: { ...askChartStore.MESSAGE_SELECT, userId: true, conversationId: true },
        })));

    const earlier = !userRow
      ? []
      : await prisma.chartMessage.findMany({
          where: { conversationId, userId, createdAt: { lt: userRow.createdAt } },
          orderBy: { createdAt: 'desc' },
          take: HISTORY_TURNS,
          select: { role: true, text: true },
        });
    const history: ChartModelTurn[] = earlier
      .reverse()
      .filter(row => row.text.trim())
      .map(row => ({
        role: row.role === 'ASSISTANT' ? 'assistant' : 'user',
        text: row.text.slice(0, HISTORY_CHARS),
      }));

    const focusMove =
      input.targetMoveId &&
      context.chart?.waypoints.some(w => w.moves.some(m => m.id === input.targetMoveId))
        ? input.targetMoveId
        : null;

    const outcome = await this.run(
      {
        system: buildAgentSystem(this.agent, context.style, skill),
        user: buildAskUserMessage({
          context,
          mode,
          skill,
          message: text || '(no text, photo only)',
          imageCount: images.length,
          targetMoveId: focusMove,
          now: new Date(),
        }),
        history,
        images,
      },
      hooks.onReply
    );
    const { turn } = outcome;

    // Two attempts at one message (a dropped stream retried while the first was still running) must leave one answer.
    const raced = opening
      ? await prisma.chartMessage.findUnique({
          where: { idempotencyKey: messageKey },
          select: { ...askChartStore.MESSAGE_SELECT, meta: true },
        })
      : userRow
        ? await prisma.chartMessage.findFirst({
            where: { conversationId, role: 'ASSISTANT', createdAt: { gt: userRow.createdAt } },
            orderBy: { createdAt: 'asc' },
            select: { ...askChartStore.MESSAGE_SELECT, meta: true },
          })
        : null;
    if (raced) {
      return {
        conversationId,
        mode,
        userMessage: userRow ? toMessageDTO(userRow) : null,
        assistantMessage: toMessageDTO(raced),
        remembered: null,
        generation: {
          source: 'ai',
          fallbackUsed: Boolean(((raced.meta ?? {}) as { fallbackUsed?: boolean }).fallbackUsed),
        },
        replayed: true,
      };
    }

    const assistantId = randomUUID();
    const resolved = await this.resolveAction(
      userId,
      input.anchorId,
      context,
      turn,
      assistantId,
      hooks
    );

    // Creation: hand the client exactly what POST /chart/plan needs. Where the model left it blank, fall back
    // to what the person actually wrote, never to anything invented.
    let planInput: AskMessageDTO['planInput'] = null;
    if (mode === 'CREATE' && turn.readyToPlan) {
      const written = await prisma.chartMessage.findMany({
        where: { conversationId, userId, role: 'USER' },
        orderBy: { createdAt: 'asc' },
        select: { text: true, attachments: true },
      });
      const said = written
        .map(row => row.text.trim())
        .filter(Boolean)
        .join(' ')
        .slice(0, 500);
      const photoAssetIds = written
        .flatMap(row =>
          Array.isArray(row.attachments) ? (row.attachments as Array<{ assetId?: string }>) : []
        )
        .map(item => item.assetId)
        .filter((id): id is string => typeof id === 'string')
        .slice(-MAX_ATTACHMENTS);
      planInput = {
        actualStartingPoint: turn.startingPoint ?? (said || context.anchor.intention.slice(0, 500)),
        startingContext: turn.context,
        photoAssetIds,
      };
    }

    const structured = {
      suggestions: turn.suggestions,
      requestPhoto: images.length ? null : turn.requestPhoto,
      readyToPlan: Boolean(planInput),
      planInput,
      action: resolved.action,
      actionUnavailable: resolved.unavailable,
    };
    // The reply carries a key derived from the message, so two attempts at one message can only ever save one answer.
    const replyKey = opening ? messageKey : `${messageKey}:reply`;
    const created = await prisma.chartMessage
      .create({
        data: {
          id: assistantId,
          conversationId,
          userId,
          role: 'ASSISTANT',
          text: turn.reply,
          idempotencyKey: replyKey,
          structured: structured as unknown as Prisma.InputJsonValue,
          skill: skill === 'FREE' ? null : skill,
          meta: {
            source: 'ai',
            agentVersion: this.agent.version,
            agentHash: this.agent.hash,
            provider: outcome.provider.name,
            model: outcome.provider.model,
            fallbackUsed: outcome.fallbackUsed,
            latencyMs: outcome.latencyMs,
          },
        },
        select: { ...askChartStore.MESSAGE_SELECT, meta: true },
      })
      .then(
        row => ({ row, lost: false as const }),
        async (error: { code?: string }) => {
          if (error?.code !== 'P2002') throw error;
          const winner = await prisma.chartMessage.findUnique({
            where: { idempotencyKey: replyKey },
            select: { ...askChartStore.MESSAGE_SELECT, meta: true },
          });
          if (!winner) throw error;
          return { row: winner, lost: true as const };
        }
      );
    if (created.lost) {
      return {
        conversationId,
        mode,
        userMessage: userRow ? toMessageDTO(userRow) : null,
        assistantMessage: toMessageDTO(created.row),
        remembered: null,
        generation: {
          source: 'ai',
          fallbackUsed: Boolean(
            ((created.row.meta ?? {}) as { fallbackUsed?: boolean }).fallbackUsed
          ),
        },
        replayed: true,
      };
    }
    const assistantRow = created.row;
    await prisma.chartConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    let remembered: AskTurnResult['remembered'] = null;
    if (turn.remember) {
      try {
        remembered = await askChartStore.upsertMemory(
          userId,
          input.anchorId,
          turn.remember.key,
          turn.remember.value,
          'CONVERSATION'
        );
      } catch (error) {
        logger.warn('ask_chart_memory_failed', { reason: describeFailure(error) });
      }
    }

    return {
      conversationId,
      mode,
      userMessage: userRow ? toMessageDTO(userRow) : null,
      assistantMessage: toMessageDTO(assistantRow),
      remembered,
      generation: { source: 'ai', fallbackUsed: outcome.fallbackUsed },
      replayed: false,
    };
  }

  /**
   * Applies an approved ADD_MOVES proposal through the same validated, idempotent path as the Add move button.
   * Moves are created exactly as stored on the message: the client sends no content, only its approval.
   */
  async approveMoves(
    userId: string,
    courseId: string,
    messageId: string
  ): Promise<{ chart: CourseDetail; added: number }> {
    const { id, structured, action } = await askChartStore.loadActionMessage(
      userId,
      courseId,
      messageId
    );
    if (action.type !== 'ADD_MOVES' || !action.waypointId) {
      throw new AppError('This proposal is not a set of moves', 409, 'PROPOSAL_UNAVAILABLE');
    }
    if (action.status === 'DISMISSED')
      throw new AppError('This proposal was dismissed', 409, 'PROPOSAL_UNAVAILABLE');
    let chart: CourseDetail | null = null;
    for (const [index, move] of action.moves.entries()) {
      try {
        chart = await chartService.addMove(userId, courseId, {
          waypointId: action.waypointId,
          title: move.title,
          rationale: move.rationale,
          source: 'AI',
          status: 'ACTIVE',
          makeCurrent: false,
          idempotencyKey: `ask-move:${id}:${index}`,
        });
      } catch (error) {
        if (error instanceof AppError && error.code === 'WAYPOINT_TRANSITION_INVALID') {
          throw new AppError(
            'That waypoint is already behind you, so these moves no longer apply',
            409,
            'PROPOSAL_STALE'
          );
        }
        throw error;
      }
    }
    if (!chart) throw new AppError('Nothing to apply', 409, 'PROPOSAL_UNAVAILABLE');
    // Only now, after every move is saved, does the proposal count as applied.
    await askChartStore.setActionStatus(id, structured, 'APPLIED');
    return { chart, added: action.moves.length };
  }

  async dismiss(userId: string, courseId: string, messageId: string): Promise<void> {
    const { id, structured, action } = await askChartStore.loadActionMessage(
      userId,
      courseId,
      messageId
    );
    if (action.status === 'APPLIED') return;
    await askChartStore.setActionStatus(id, structured, 'DISMISSED');
  }

  /**
   * REVISE_ROUTE is applied through the existing route flow (it references the proposal id). The message only
   * becomes APPLIED once the server has recorded that proposal as accepted; the client's word is not enough.
   */
  async confirmRouteApplied(userId: string, courseId: string, messageId: string): Promise<void> {
    const { id, structured, action } = await askChartStore.loadActionMessage(
      userId,
      courseId,
      messageId
    );
    if (action.type !== 'REVISE_ROUTE' || !action.routeProposalId) {
      throw new AppError('This proposal is not a route revision', 409, 'PROPOSAL_UNAVAILABLE');
    }
    const proposal = await prisma.aIPlanProposal.findFirst({
      where: { id: action.routeProposalId, userId, courseId },
      select: { acceptedAt: true },
    });
    if (!proposal?.acceptedAt)
      throw new AppError('That route change has not been applied', 409, 'PROPOSAL_NOT_APPLIED');
    await askChartStore.setActionStatus(id, structured, 'APPLIED');
  }
}

export const askChartService = new AskChartService();
