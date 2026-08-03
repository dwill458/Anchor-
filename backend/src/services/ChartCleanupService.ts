import { prisma } from '../lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChartPurgeResult = {
  coursesDeleted: number;
  reflectionsDetached: number;
  proposalsDeleted: number;
};

/**
 * Purges only data whose frozen retention windows have elapsed.
 *
 * Reflections are journal data, not course structure. Detach them before the
 * course delete so the Course/Waypoint cascade cannot erase private writing.
 */
export async function purgeExpiredChartData(now = new Date()): Promise<ChartPurgeResult> {
  const courseCutoff = new Date(now.getTime() - 30 * DAY_MS);
  const proposalCutoff = new Date(now.getTime() - 7 * DAY_MS);

  return prisma.$transaction(async tx => {
    const expiredCourses = await tx.course.findMany({
      where: { deletedAt: { lt: courseCutoff } },
      select: { id: true },
    });
    const courseIds = expiredCourses.map(course => course.id);

    let reflectionsDetached = 0;
    if (courseIds.length > 0) {
      const waypoints = await tx.waypoint.findMany({
        where: { courseId: { in: courseIds } },
        select: { id: true },
      });
      const waypointIds = waypoints.map(waypoint => waypoint.id);
      const detached = await tx.reflection.updateMany({
        where: {
          OR: [
            { courseId: { in: courseIds } },
            ...(waypointIds.length > 0 ? [{ waypointId: { in: waypointIds } }] : []),
          ],
        },
        data: { courseId: null, waypointId: null },
      });
      reflectionsDetached = detached.count;

      await tx.course.deleteMany({ where: { id: { in: courseIds } } });
    }

    const proposals = await tx.aIPlanProposal.deleteMany({
      where: { expiresAt: { lt: proposalCutoff } },
    });

    return {
      coursesDeleted: courseIds.length,
      reflectionsDetached,
      proposalsDeleted: proposals.count,
    };
  });
}
