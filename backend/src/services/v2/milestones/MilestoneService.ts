import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../api/middleware/errorHandler';
import { logger } from '../../../utils/logger';
import { evaluateMilestones, type MilestoneFacts } from './registry';
import { ACTION_WINDOW_MS, belongsToAction, milestoneActionKey, RECONCILIATION_VERSION, type MilestoneAction } from './celebrationPolicy';

export interface MilestoneRecord {
  id: string;
  anchorId: string;
  definitionId: string;
  definitionVersion: number;
  earnedAt: string;
  sourceKind: string;
  sourceEntityId: string | null;
  metadata: unknown;
  /** Actual acknowledged playback only; silence/backfill never fabricates this receipt. */
  celebratedAt: string | null;
  backfillVersion?: number | null;
}

type Row = Prisma.AnchorMilestoneGetPayload<Record<string, never>>;

const toRecord = (row: Row): MilestoneRecord => ({
  id: row.id,
  anchorId: row.anchorId,
  definitionId: row.definitionId,
  definitionVersion: row.definitionVersion,
  earnedAt: row.earnedAt.toISOString(),
  sourceKind: row.sourceKind,
  sourceEntityId: row.sourceEntityId,
  metadata: row.metadata,
  celebratedAt: row.celebratedAt ? row.celebratedAt.toISOString() : null,
  backfillVersion: row.backfillVersion,
});

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class MilestoneService {
  /** Loads the persisted facts the rules read. Strength comes from the server ledger, never the client. */
  async loadFacts(userId: string, anchorId: string): Promise<MilestoneFacts | null> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId },
      select: { id: true, intentionCompletedAt: true },
    });
    if (!anchor) return null;

    const [sessions, movements, courses, visions] = await Promise.all([
      prisma.practiceSession.findMany({
        where: { userId, anchorId, completionStatus: 'completed' },
        select: { id: true, completedAt: true, completedDurationSeconds: true, practiceMode: true, metadata: true },
      }),
      prisma.threadV2Movement.findMany({
        where: { userId, anchorId },
        select: { sessionId: true, completedAt: true, afterStrength: true },
      }),
      prisma.course.findMany({
        where: { userId, anchorId, deletedAt: null },
        select: {
          id: true,
          routeScope: true,
          status: true,
          completedAt: true,
          waypoints: {
            select: { id: true, reachedAt: true, cancelledAt: true, skippedAt: true, archivedAt: true },
          },
        },
      }),
      prisma.vision.findMany({
        where: { userId, anchorId },
        select: { id: true, firstCommittedAt: true, boardCompletedAt: true },
      }),
    ]);

    return {
      sessions: sessions.map(s => {
        const metadata = s.metadata && typeof s.metadata === 'object' && !Array.isArray(s.metadata) ? s.metadata : {};
        return { id: s.id, completedAt: s.completedAt, seconds: s.completedDurationSeconds,
          guidedVisualize: s.practiceMode === 'visualize' && metadata.guided_visualize_version === 1 &&
            visions.some(v => v.id === metadata.vision_id),
        };
      }),
      visions,
      movements,
      courses,
      intentionCompletedAt: anchor.intentionCompletedAt,
    };
  }

  /** Capture saved content and board evidence inside the image transaction, before presentation. */
  async captureVisionCommit(userId: string, anchorId: string, visionId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? prisma;
    const vision = await db.vision.findFirst({
      where: { id: visionId, userId, anchorId },
      select: { id: true,
        scenes: { where: { assetId: { not: null } }, select: { assetId: true, createdAt: true, isArchived: true }, orderBy: { createdAt: 'asc' } },
        notes: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    if (!vision) return;
    const first = [...vision.scenes, ...vision.notes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (first) await db.vision.updateMany({ where: { id: visionId, userId, firstCommittedAt: null }, data: { firstCommittedAt: first.createdAt } });
    if (new Set(vision.scenes.filter(s => !s.isArchived).map(s => s.assetId)).size >= 8) {
      await db.vision.updateMany({ where: { id: visionId, userId, boardCompletedAt: null }, data: { boardCompletedAt: new Date() } });
    }
    if (!tx) await this.evaluateQuietly(userId, anchorId, { kind: 'vision', sourceEntityId: visionId });
  }

  /**
   * Awards every milestone the Anchor's persisted history qualifies for and returns only the ones
   * recorded by THIS call. Idempotent: the unique key on (user, anchor, definition) means a repeat,
   * a race or a second device records nothing new, and an existing award is never rewritten.
   */
  async evaluateAndAward(userId: string, anchorId: string, now: Date = new Date(), action?: MilestoneAction): Promise<MilestoneRecord[]> {
    const facts = await this.loadFacts(userId, anchorId);
    if (!facts) return [];

    const awards = evaluateMilestones(facts);
    if (awards.length === 0) return [];

    const existing = new Set(
      (await prisma.anchorMilestone.findMany({ where: { userId, anchorId }, select: { definitionId: true } })).map(
        row => row.definitionId
      )
    );

    const created: MilestoneRecord[] = [];
    for (const award of awards) {
      const age = now.getTime() - award.earnedAt.getTime();
      const chart = action?.kind === 'chart' ? facts.courses.find(c => c.id === action.sourceEntityId) : null;
      const reached = chart?.waypoints.find(w => w.id === action?.eventId)?.reachedAt;
      const matches = action && belongsToAction(award, action) &&
        (action.kind !== 'chart' || Boolean(chart && reached &&
          (award.sourceEntityId === action.eventId || award.earnedAt.getTime() === reached.getTime() ||
            (award.definitionId === 'journey.destination' && award.sourceEntityId === chart.id &&
              reached.getTime() === Math.max(...chart.waypoints.map(w => w.reachedAt?.getTime() ?? 0))))));
      const historical = !matches || age < 0 || age > ACTION_WINDOW_MS;
      const promote = async () => {
        if (historical || !action) return;
        // Repair a classification race with a quiet read using identical recent
        // evidence only. Never rewrite earn dates or real acknowledgment.
        await prisma.anchorMilestone.updateMany({
          where: { userId, anchorId, definitionId: award.definitionId,
            sourceKind: award.sourceKind, sourceEntityId: award.sourceEntityId,
            earnedAt: award.earnedAt, backfillVersion: RECONCILIATION_VERSION,
            automaticEventKey: null, automaticReservedAt: null, celebratedAt: null },
          data: { backfillVersion: null, automaticEventKey: milestoneActionKey(action) },
        });
      };
      if (existing.has(award.definitionId)) { await promote(); continue; }
      try {
        const row = await prisma.anchorMilestone.create({
          data: {
            userId,
            anchorId,
            definitionId: award.definitionId,
            definitionVersion: award.definitionVersion,
            earnedAt: award.earnedAt,
            sourceKind: award.sourceKind,
            sourceEntityId: award.sourceEntityId,
            metadata: award.metadata,
            celebratedAt: null,
            backfillVersion: historical ? RECONCILIATION_VERSION : null,
            automaticEventKey: historical || !action ? null : milestoneActionKey(action),
          },
        });
        created.push(toRecord(row));
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        await promote();
      }
    }
    return created;
  }

  /**
   * For the write paths (practice, chart, completion). Awarding must never break the action that
   * triggered it, and the next evaluation or Progress read catches up, so failures are logged only.
   */
  async evaluateQuietly(userId: string, anchorId: string | null | undefined, action?: MilestoneAction): Promise<MilestoneRecord[]> {
    if (!anchorId) return [];
    try {
      return await this.evaluateAndAward(userId, anchorId, new Date(), action);
    } catch (error) {
      logger.error('Milestone evaluation failed', error);
      return [];
    }
  }

  async list(userId: string, anchorId: string): Promise<MilestoneRecord[]> {
    const rows = await prisma.anchorMilestone.findMany({
      where: { userId, anchorId },
      orderBy: [{ earnedAt: 'desc' }, { definitionId: 'asc' }],
    });
    return rows.map(toRecord);
  }

  /** Reconciles first (catches offline or pre-existing history), then returns the permanent record. */
  async reconcileAndList(
    userId: string,
    anchorId: string
  ): Promise<{ milestones: MilestoneRecord[]; created: MilestoneRecord[] }> {
    const anchor = await prisma.anchor.findFirst({ where: { id: anchorId, userId }, select: { id: true } });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    const created = await this.evaluateAndAward(userId, anchorId);
    return { milestones: await this.list(userId, anchorId), created };
  }

  /** Presentation receipt only. Setting it never changes ownership, and it is set once. */
  async markCelebrated(userId: string, milestoneId: string, now: Date = new Date()): Promise<MilestoneRecord> {
    const row = await prisma.anchorMilestone.findFirst({ where: { id: milestoneId, userId } });
    if (!row) throw new AppError('Milestone not found', 404, 'MILESTONE_NOT_FOUND');
    if (row.celebratedAt) return toRecord(row);
    await prisma.anchorMilestone.updateMany({
      where: { id: milestoneId, userId, celebratedAt: null },
      data: { celebratedAt: now },
    });
    const updated = await prisma.anchorMilestone.findFirst({ where: { id: milestoneId, userId } });
    return toRecord(updated ?? row);
  }
}

export const milestoneService = new MilestoneService();
