/**
 * Prisma adapters for WeeklyRecapService. Every query is scoped to `userId` and bounded by a time range; none of them
 * writes. Canonical sources:
 *   practice   PracticeSession (completionStatus 'completed')      waypoint  Waypoint.reachedAt
 *   move       Move (status COMPLETED, completedAt)                 destination  Course.completedAt
 *   completed  Anchor.intentionCompletedAt     released  Anchor.releasedAt (archivedAt alone is NOT a release)
 *   milestone  AnchorMilestone.earnedAt        vision    Vision.firstCommittedAt / boardCompletedAt
 * CourseEvent and ThreadEventLedger rows describe the same actions and are deliberately not read.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { WeeklyRecapV2 } from '../../domain/v2/weeklyRecap';
import type { RecapReader, SnapshotRow, SnapshotStore } from './WeeklyRecapService';

const range = (from: Date, to: Date) => ({ gte: from, lt: to });

export const prismaRecapReader: RecapReader = {
  async hasAnyHistory(userId) {
    const [practice, move, waypoint, milestone] = await Promise.all([
      prisma.practiceSession.findFirst({ where: { userId }, select: { id: true } }),
      prisma.move.findFirst({ where: { userId, status: 'COMPLETED' }, select: { id: true } }),
      prisma.waypoint.findFirst({
        where: { reachedAt: { not: null }, course: { userId, deletedAt: null } },
        select: { id: true },
      }),
      prisma.anchorMilestone.findFirst({ where: { userId }, select: { id: true } }),
    ]);
    return Boolean(practice || move || waypoint || milestone);
  },

  async practices(userId, from, to) {
    const rows = await prisma.practiceSession.findMany({
      where: { userId, completionStatus: 'completed', completedAt: range(from, to) },
      select: {
        id: true,
        anchorId: true,
        anchorServerIdSnapshot: true,
        localDateKey: true,
        practiceMode: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'asc' },
    });
    return rows.map(r => ({
      id: r.id,
      anchorId: r.anchorId ?? r.anchorServerIdSnapshot ?? null,
      localDateKey: r.localDateKey,
      mode: r.practiceMode,
      completedAt: r.completedAt,
    }));
  },

  async priorPracticeAt(userId, before) {
    const row = await prisma.practiceSession.findFirst({
      where: { userId, completionStatus: 'completed', completedAt: { lt: before } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });
    return row?.completedAt ?? null;
  },

  async chart(userId, from, to) {
    // Archived-by-release waypoints keep their original reachedAt and still count; cancelled/skipped never do.
    const reached = await prisma.waypoint.findMany({
      where: {
        reachedAt: range(from, to),
        cancelledAt: null,
        skippedAt: null,
        course: { userId, deletedAt: null },
      },
      select: {
        id: true,
        courseId: true,
        title: true,
        reachedAt: true,
        course: { select: { anchorId: true } },
      },
      orderBy: { reachedAt: 'asc' },
    });
    const completedCourses = await prisma.course.findMany({
      where: { userId, deletedAt: null, completedAt: range(from, to) },
      select: { id: true },
    });
    const courseIds = [
      ...new Set([...reached.map(w => w.courseId), ...completedCourses.map(c => c.id)]),
    ];
    const courses = courseIds.length
      ? await prisma.course.findMany({
          where: { id: { in: courseIds }, userId },
          select: {
            id: true,
            anchorId: true,
            destinationText: true,
            completedAt: true,
            routeScope: true,
            waypoints: {
              where: { cancelledAt: null, skippedAt: null },
              select: { id: true, position: true, reachedAt: true },
              orderBy: { position: 'asc' },
            },
          },
        })
      : [];
    return {
      waypoints: reached.map(w => ({
        id: w.id,
        courseId: w.courseId,
        anchorId: w.course.anchorId,
        title: w.title,
        reachedAt: w.reachedAt!,
      })),
      courses: courses.map(c => ({
        id: c.id,
        anchorId: c.anchorId,
        destination: c.destinationText,
        waypointTotal: c.waypoints.length,
        waypointsReached: c.waypoints.filter(w => w.reachedAt && w.reachedAt < to).length,
        finalWaypointId: c.waypoints.length ? c.waypoints[c.waypoints.length - 1].id : null,
        completedAt: c.completedAt,
        routeScope: c.routeScope,
      })),
    };
  },

  async moves(userId, from, to) {
    const rows = await prisma.move.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        completedAt: range(from, to),
        course: { deletedAt: null },
      },
      select: {
        id: true,
        courseId: true,
        waypointId: true,
        title: true,
        completedAt: true,
        course: { select: { anchorId: true } },
      },
      orderBy: { completedAt: 'asc' },
    });
    return rows.map(m => ({
      id: m.id,
      courseId: m.courseId,
      waypointId: m.waypointId,
      anchorId: m.course.anchorId,
      title: m.title,
      completedAt: m.completedAt!,
    }));
  },

  async completions(userId, from, to) {
    const rows = await prisma.anchor.findMany({
      where: { userId, intentionCompletedAt: range(from, to) },
      select: { id: true, intentionCompletedAt: true },
    });
    return rows.map(a => ({ anchorId: a.id, at: a.intentionCompletedAt! }));
  },

  async releases(userId, from, to) {
    const rows = await prisma.anchor.findMany({
      where: { userId, releasedAt: range(from, to) },
      select: { id: true, releasedAt: true },
    });
    return rows.map(a => ({ anchorId: a.id, at: a.releasedAt! }));
  },

  async milestones(userId, from, to) {
    const rows = await prisma.anchorMilestone.findMany({
      where: { userId, earnedAt: range(from, to) },
      select: {
        id: true,
        anchorId: true,
        definitionId: true,
        earnedAt: true,
        sourceEntityId: true,
      },
    });
    return rows;
  },

  async visions(userId, from, to) {
    const rows = await prisma.vision.findMany({
      where: {
        userId,
        OR: [{ firstCommittedAt: range(from, to) }, { boardCompletedAt: range(from, to) }],
      },
      select: { id: true, anchorId: true, firstCommittedAt: true, boardCompletedAt: true },
    });
    const out: Array<{ id: string; kind: 'FIRST' | 'BOARD'; anchorId: string | null; at: Date }> =
      [];
    for (const v of rows) {
      if (v.firstCommittedAt && v.firstCommittedAt >= from && v.firstCommittedAt < to)
        out.push({ id: v.id, kind: 'FIRST', anchorId: v.anchorId, at: v.firstCommittedAt });
      if (v.boardCompletedAt && v.boardCompletedAt >= from && v.boardCompletedAt < to)
        out.push({ id: v.id, kind: 'BOARD', anchorId: v.anchorId, at: v.boardCompletedAt });
    }
    return out;
  },

  async anchors(userId, ids) {
    if (!ids.length) return [];
    // Archived and released Anchors are included: their history must stay readable.
    const rows = await prisma.anchor.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true, intentionText: true, category: true, releasedAt: true },
    });
    return rows.map(a => ({
      id: a.id,
      intention: a.intentionText,
      categoryKey: a.category,
      isReleased: a.releasedAt != null,
    }));
  },
};

const toRow = (r: {
  id: string;
  userId: string;
  weekKey: string | null;
  timeZone: string | null;
  status: string;
  provenance: string;
  snapshot: Prisma.JsonValue;
  feedback: string | null;
  finalizedAt: Date | null;
  updatedAt: Date;
}): SnapshotRow => ({
  id: r.id,
  userId: r.userId,
  weekKey: r.weekKey!,
  timeZone: r.timeZone ?? 'UTC',
  status: r.status === 'FINAL' ? 'FINAL' : 'DRAFT',
  provenance: r.provenance === 'RECONSTRUCTED' ? 'RECONSTRUCTED' : 'LIVE',
  snapshot: r.snapshot as unknown as WeeklyRecapV2,
  feedback: r.feedback,
  finalizedAt: r.finalizedAt,
  updatedAt: r.updatedAt,
});

const V2_GLOBAL = { scopeKey: 'GLOBAL', schemaVersion: 2 } as const;

export const prismaSnapshotStore: SnapshotStore = {
  async find(userId, weekKey) {
    const row = await prisma.weeklyInsightSnapshot.findUnique({
      where: { userId_scopeKey_weekKey: { userId, scopeKey: 'GLOBAL', weekKey } },
    });
    return row && row.schemaVersion === 2 ? toRow(row) : null;
  },

  async create({ userId, weekKey, timeZone, startUtc, endUtc, recap }) {
    try {
      const row = await prisma.weeklyInsightSnapshot.create({
        data: {
          userId,
          anchorId: null,
          ...V2_GLOBAL,
          weekKey,
          timeZone,
          weekStart: startUtc,
          weekEnd: endUtc,
          snapshot: recap as unknown as Prisma.InputJsonValue,
          status: recap.status,
          provenance: recap.provenance,
          finalizedAt: recap.status === 'FINAL' ? new Date() : null,
        },
      });
      return toRow(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return null;
      throw error;
    }
  },

  async updateDraft(id, recap) {
    const result = await prisma.weeklyInsightSnapshot.updateMany({
      where: { id, status: 'DRAFT' },
      data: { snapshot: recap as unknown as Prisma.InputJsonValue },
    });
    return result.count === 1;
  },

  async finalize(id, recap, at) {
    const result = await prisma.weeklyInsightSnapshot.updateMany({
      where: { id, status: 'DRAFT' },
      data: {
        snapshot: recap as unknown as Prisma.InputJsonValue,
        status: 'FINAL',
        finalizedAt: at,
      },
    });
    return result.count === 1;
  },

  async list(userId, { before, limit }) {
    const rows = await prisma.weeklyInsightSnapshot.findMany({
      where: {
        userId,
        scopeKey: 'GLOBAL',
        schemaVersion: 2,
        ...(before ? { weekKey: { lt: before } } : {}),
      },
      orderBy: { weekKey: 'desc' },
      take: limit,
    });
    return rows.map(toRow);
  },
};
