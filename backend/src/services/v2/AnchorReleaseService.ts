import { Prisma } from '@prisma/client';
import { AppError } from '../../api/middleware/errorHandler';
import { prisma } from '../../lib/prisma';

export type AnchorReleaseResult = {
  anchorId: string;
  releasedAt: string;
  lifecycleState: 'released';
  archivedCourseCount: number;
  archivedWaypointCount: number;
  remindersStopped: true;
};

/** Server-owned, non-destructive release. No historical row is deleted. */
export class AnchorReleaseService {
  async release(
    userId: string,
    anchorId: string,
    idempotencyKey: string
  ): Promise<AnchorReleaseResult> {
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new AppError('A valid idempotencyKey is required.', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    return prisma.$transaction(
      async tx => {
        const anchor = await tx.anchor.findFirst({ where: { id: anchorId, userId } });
        if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');

        // A release is terminal. Replay returns the original server timestamp even
        // when a client lost its response and retries after a crash.
        const releasedAt = anchor.releasedAt ?? anchor.archivedAt;
        if (releasedAt) return this.result(anchorId, releasedAt, 0, 0);

        const now = new Date();
        const claimed = await tx.anchor.updateMany({
          where: { id: anchorId, userId, releasedAt: null, archivedAt: null },
          data: {
            isArchived: true,
            archivedAt: now,
            releasedAt: now,
            releaseIdempotencyKey: idempotencyKey,
          },
        });
        if (claimed.count === 0) {
          const persisted = await tx.anchor.findFirst({ where: { id: anchorId, userId } });
          if (!persisted?.releasedAt && !persisted?.archivedAt)
            throw new AppError('Release conflict', 409, 'ANCHOR_RELEASE_CONFLICT');
          return this.result(anchorId, persisted.releasedAt ?? persisted.archivedAt!, 0, 0);
        }

        const linkedCourses = await tx.course.findMany({
          where: {
            userId,
            archivedAt: null,
            anchorLinks: { some: { anchorId, unlinkedAt: null } },
          },
          select: { id: true },
        });
        const courseIds = linkedCourses.map(course => course.id);
        const courses = courseIds.length
          ? await tx.course.updateMany({
              where: { id: { in: courseIds }, userId, archivedAt: null },
              data: { archivedAt: now, status: 'ARCHIVED' },
            })
          : { count: 0 };
        const waypoints = courseIds.length
          ? await tx.waypoint.updateMany({
              where: { userId, courseId: { in: courseIds }, archivedAt: null },
              data: { archivedAt: now },
            })
          : { count: 0 };
        // Unlinking stops future Course-driven reminders while retaining the
        // immutable link snapshot and all Course/Waypoint history.
        await tx.courseAnchorLink.updateMany({
          where: { userId, anchorId, unlinkedAt: null },
          data: { unlinkedAt: now },
        });
        await tx.threadEventLedger.upsert({
          where: { idempotencyKey: `anchor-release:${anchorId}` },
          create: {
            userId,
            anchorId,
            eventType: 'ANCHOR_RELEASED',
            significance: 'MAJOR',
            sourceKind: 'ANCHOR_LIFECYCLE',
            sourceEntityId: anchorId,
            correlationId: `anchor-release:${anchorId}`,
            occurredAt: now,
            idempotencyKey: `anchor-release:${anchorId}`,
            metadata: { releasedAt: now.toISOString(), remindersStopped: true },
          },
          update: {},
        });
        return this.result(anchorId, now, courses.count, waypoints.count);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private result(
    anchorId: string,
    releasedAt: Date,
    archivedCourseCount: number,
    archivedWaypointCount: number
  ): AnchorReleaseResult {
    return {
      anchorId,
      releasedAt: releasedAt.toISOString(),
      lifecycleState: 'released',
      archivedCourseCount,
      archivedWaypointCount,
      remindersStopped: true,
    };
  }
}

export const anchorReleaseService = new AnchorReleaseService();
