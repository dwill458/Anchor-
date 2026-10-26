import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../api/middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { COACH_STYLES, type CoachStyle } from './chartAgent';
import { deleteAskPhotos } from './askChartPhotos';
import { MEMORY_KEYS, type MemoryKey, type ReviseReason } from './askChartSchema';

export type AskActionStatus = 'PENDING' | 'APPLIED' | 'DISMISSED';

export type AskActionDTO = {
  type: 'ADD_MOVES' | 'REVISE_ROUTE';
  status: AskActionStatus;
  summary: string;
  waypointId: string | null;
  waypointTitle: string | null;
  moves: Array<{ title: string; rationale: string | null; detail?: string | null }>;
  reason: ReviseReason | null;
  detail: string | null;
  /** REVISE_ROUTE only: the AIPlanProposal the person reviews and applies through the existing route flow. */
  routeProposalId: string | null;
  /** Titles of the proposed route, for the in-chat summary. */
  routeTitles: string[] | null;
  baseCourseVersion: number | null;
};

export type AskMessageDTO = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  text: string;
  createdAt: string;
  attachments: Array<{ assetId: string }>;
  suggestions: string[];
  requestPhoto: { reason: string } | null;
  readyToPlan: boolean;
  /** Present when `readyToPlan`: exactly what to send to POST /chart/plan. */
  planInput: {
    actualStartingPoint: string;
    startingContext: string | null;
    photoAssetIds: string[];
  } | null;
  action: AskActionDTO | null;
  /** The reply promised a change that could not be prepared. Shown honestly, never as success. */
  actionUnavailable: boolean;
  skill: string | null;
};

type Structured = {
  suggestions?: string[];
  requestPhoto?: { reason: string } | null;
  readyToPlan?: boolean;
  planInput?: AskMessageDTO['planInput'];
  action?: AskActionDTO | null;
  actionUnavailable?: boolean;
};

export function scopedMessageKey(userId: string, key: string): string {
  return createHash('sha256').update(`ask-message:${userId}:${key}`).digest('hex');
}

export function toMessageDTO(row: {
  id: string;
  role: string;
  text: string;
  createdAt: Date;
  attachments: Prisma.JsonValue;
  structured: Prisma.JsonValue;
  skill: string | null;
}): AskMessageDTO {
  const structured = (row.structured ?? {}) as Structured;
  const attachments = Array.isArray(row.attachments)
    ? (row.attachments as Array<{ assetId?: unknown }>)
        .filter(item => typeof item?.assetId === 'string')
        .map(item => ({ assetId: item.assetId as string }))
    : [];
  return {
    id: row.id,
    role: row.role === 'ASSISTANT' ? 'ASSISTANT' : 'USER',
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    attachments,
    suggestions: structured.suggestions ?? [],
    requestPhoto: structured.requestPhoto ?? null,
    readyToPlan: Boolean(structured.readyToPlan),
    planInput: structured.planInput ?? null,
    action: structured.action ?? null,
    actionUnavailable: Boolean(structured.actionUnavailable),
    skill: row.skill,
  };
}

const MESSAGE_SELECT = {
  id: true,
  role: true,
  text: true,
  createdAt: true,
  attachments: true,
  structured: true,
  skill: true,
} as const;

export const askChartStore = {
  MESSAGE_SELECT,

  /** The conversation for this Anchor's current Chart (or the pre-Chart creation conversation), newest messages last. */
  async getConversation(userId: string, anchorId: string, courseId: string | null, limit = 60) {
    const conversation = await prisma.chartConversation.findFirst({
      where: { userId, anchorId, courseId },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true, mode: true },
    });
    if (!conversation) return { conversationId: null, messages: [] as AskMessageDTO[] };
    const rows = await prisma.chartMessage.findMany({
      where: { conversationId: conversation.id, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: MESSAGE_SELECT,
    });
    return { conversationId: conversation.id, messages: rows.reverse().map(toMessageDTO) };
  },

  /**
   * Deletes the conversation history for this Anchor's Chart, and any photos sent in it. Memories are separate and
   * untouched.
   */
  async clearConversation(
    userId: string,
    anchorId: string,
    courseId: string | null
  ): Promise<number> {
    const withPhotos = await prisma.chartMessage.findMany({
      where: {
        userId,
        attachments: { not: Prisma.DbNull },
        conversation: { userId, anchorId, courseId },
      },
      select: { attachments: true },
    });
    const photoIds = withPhotos
      .flatMap(row =>
        Array.isArray(row.attachments) ? (row.attachments as Array<{ assetId?: unknown }>) : []
      )
      .map(item => item.assetId)
      .filter((id): id is string => typeof id === 'string');
    await deleteAskPhotos(userId, photoIds).catch(() => 0);
    const result = await prisma.chartConversation.deleteMany({
      where: { userId, anchorId, courseId },
    });
    return result.count;
  },

  async getProfile(userId: string, anchorId: string) {
    const [profile, memories] = await Promise.all([
      prisma.chartCoachProfile.findUnique({ where: { userId }, select: { style: true } }),
      prisma.chartMemory.findMany({
        where: { userId, anchorId },
        orderBy: { updatedAt: 'desc' },
        select: { key: true, value: true, source: true, updatedAt: true },
      }),
    ]);
    return {
      style: (COACH_STYLES.find(style => style === profile?.style) ?? 'DRIVEN') as CoachStyle,
      memories: memories.map(memory => ({
        key: memory.key as MemoryKey,
        value: memory.value,
        source: memory.source,
        updatedAt: memory.updatedAt.toISOString(),
      })),
    };
  },

  async setStyle(userId: string, style: CoachStyle): Promise<CoachStyle> {
    await prisma.chartCoachProfile.upsert({
      where: { userId },
      create: { userId, style },
      update: { style },
    });
    return style;
  },

  /** Verifies the Anchor is the caller's before any memory is written. */
  async assertOwnsAnchor(userId: string, anchorId: string): Promise<void> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId },
      select: { id: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
  },

  async upsertMemory(
    userId: string,
    anchorId: string,
    key: MemoryKey,
    value: string,
    source: 'USER_EDITED' | 'CONVERSATION'
  ) {
    if (!MEMORY_KEYS.includes(key))
      throw new AppError('Unknown memory key', 400, 'VALIDATION_ERROR');
    const clean = value.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!clean) throw new AppError('A memory needs a value', 400, 'VALIDATION_ERROR');
    await this.assertOwnsAnchor(userId, anchorId);
    await prisma.chartMemory.upsert({
      where: { userId_anchorId_key: { userId, anchorId, key } },
      create: { userId, anchorId, key, value: clean, source },
      update: { value: clean, source },
    });
    return { key, value: clean };
  },

  async deleteMemory(userId: string, anchorId: string, key: MemoryKey): Promise<void> {
    await prisma.chartMemory.deleteMany({ where: { userId, anchorId, key } });
  },

  async deleteAllMemories(userId: string, anchorId: string): Promise<number> {
    return (await prisma.chartMemory.deleteMany({ where: { userId, anchorId } })).count;
  },

  /** Loads an assistant message that carries an action, only if it belongs to this user, Anchor and Chart. */
  async loadActionMessage(userId: string, courseId: string, messageId: string) {
    const row = await prisma.chartMessage.findFirst({
      where: { id: messageId, userId, role: 'ASSISTANT', conversation: { userId, courseId } },
      select: { id: true, structured: true, conversationId: true },
    });
    const structured = (row?.structured ?? null) as Structured | null;
    if (!row || !structured?.action) {
      throw new AppError('Proposal not found', 404, 'PROPOSAL_NOT_FOUND');
    }
    return { id: row.id, structured, action: structured.action };
  },

  async setActionStatus(
    messageId: string,
    structured: Structured,
    status: AskActionStatus
  ): Promise<void> {
    if (!structured.action) return;
    await prisma.chartMessage.update({
      where: { id: messageId },
      data: {
        structured: {
          ...structured,
          action: { ...structured.action, status },
        } as unknown as Prisma.InputJsonValue,
      },
    });
  },
};
