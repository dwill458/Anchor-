import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../api/middleware/errorHandler';
import { logger } from '../../../utils/logger';
import { evaluateMilestones, type MilestoneFacts } from './registry';

/** An award earned this long before it was recorded is history being caught up, not news. */
const HISTORICAL_AFTER_MS = 48 * 60 * 60 * 1000;

export interface MilestoneRecord {
  id: string;
  anchorId: string;
  definitionId: string;
  definitionVersion: number;
  earnedAt: string;
  sourceKind: string;
  sourceEntityId: string | null;
  metadata: unknown;
  /** Null until the client reports the celebration finished. Historical awards start settled. */
  celebratedAt: string | null;
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
    if (!tx) await this.evaluateQuietly(userId, anchorId);
  }

  /**
   * Awards every milestone the Anchor's persisted history qualifies for and returns only the ones
   * recorded by THIS call. Idempotent: the unique key on (user, anchor, definition) means a repeat,
   * a race or a second device records nothing new, and an existing award is never rewritten.
   */
  async evaluateAndAward(userId: string, anchorId: string, now: Date = new Date()): Promise<MilestoneRecord[]> {
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
      if (existing.has(award.definitionId)) continue;
      const historical = now.getTime() - award.earnedAt.getTime() > HISTORICAL_AFTER_MS;
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
            celebratedAt: historical ? now : null,
          },
        });
        created.push(toRecord(row));
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    return created;
  }

  /**
   * For the write paths (practice, chart, completion). Awarding must never break the action that
   * triggered it, and the next evaluation or Progress read catches up, so failures are logged only.
   */
  async evaluateQuietly(userId: string, anchorId: string | null | undefined): Promise<MilestoneRecord[]> {
    if (!anchorId) return [];
    try {
      return await this.evaluateAndAward(userId, anchorId);
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
