import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../api/middleware/errorHandler';
import {
  ACTION_WINDOW_MS,
  featureMilestone,
  milestoneActionKey,
  RECONCILIATION_VERSION,
  type MilestoneAction,
} from './celebrationPolicy';
import { milestoneService } from './MilestoneService';

export class MilestonePresentationService {
  async reserve(userId: string, anchorId: string, action: MilestoneAction, now = new Date()) {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId },
      select: { id: true },
    });
    if (!anchor) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    // Recovery after a lost action response uses the same persisted facts and source boundary.
    await milestoneService.evaluateQuietly(userId, anchorId, action);
    return prisma.$transaction(async tx => {
      // Serialize across devices AND Anchors for this user's one welcome-back opportunity.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), 21102026)`;
      const sourceKey = milestoneActionKey(action);
      let evidenceKey = sourceKey;
      let visualize = false;
      if (action.kind === 'practice') {
        const session = await tx.practiceSession.findFirst({
          where: { id: action.sourceEntityId, userId, anchorId, completionStatus: 'completed' },
        });
        if (
          !session ||
          now.getTime() - session.completedAt.getTime() < 0 ||
          now.getTime() - session.completedAt.getTime() > ACTION_WINDOW_MS
        )
          return null;
        visualize = session.practiceMode === 'visualize';
      } else if (action.kind === 'chart') {
        const chart = await tx.course.findFirst({
          where: { id: action.sourceEntityId, userId, anchorId },
          select: {
            id: true,
            waypoints: { where: { id: action.eventId }, select: { id: true, reachedAt: true } },
          },
        });
        const waypoint = chart?.waypoints.find(w => w.id === action.eventId);
        if (
          !action.eventId ||
          !waypoint?.reachedAt ||
          now.getTime() - waypoint.reachedAt.getTime() > ACTION_WINDOW_MS ||
          waypoint.reachedAt > now
        )
          return null;
      } else if (action.kind === 'vision') {
        const vision = await tx.vision.findFirst({
          where: { id: action.sourceEntityId, userId, anchorId },
          select: {
            id: true,
            scenes: {
              where: { assetId: { not: null } },
              select: { id: true, createdAt: true },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
            },
            notes: {
              select: { id: true, createdAt: true },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
            },
          },
        });
        if (!vision) return null;
        const commit = [...vision.scenes, ...vision.notes].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)
        )[0];
        if (
          !commit ||
          commit.createdAt > now ||
          now.getTime() - commit.createdAt.getTime() > ACTION_WINDOW_MS
        )
          return null;
        evidenceKey = `${sourceKey}:${commit.id}`;
      } else if (action.sourceEntityId !== anchorId) return null;

      const records = await tx.anchorMilestone.findMany({ where: { userId, anchorId } });
      const fresh = records.filter(
        r =>
          r.automaticEventKey === sourceKey &&
          !r.automaticReservedAt &&
          !r.celebratedAt &&
          r.earnedAt.getTime() <= now.getTime() &&
          now.getTime() - r.earnedAt.getTime() <= ACTION_WINDOW_MS
      );
      const historical = records.filter(
        r =>
          r.backfillVersion === RECONCILIATION_VERSION && !r.automaticReservedAt && !r.celebratedAt
      );
      let featured = featureMilestone(fresh, action, visualize);
      // Persist the actual action identity, not which subset of awards happened to be evaluated first.
      const eventKey = evidenceKey;
      const existing = await tx.milestonePresentation.findFirst({ where: { userId, eventKey } });
      if (existing) return null;
      if (action.kind !== 'practice' && !featured) return null;

      const expiresAt = new Date(now.getTime() + 90_000);
      if (action.kind === 'practice' && historical.length) {
        const welcome = await tx.milestonePresentation.findFirst({
          where: { userId, eventKey: `welcome:v${RECONCILIATION_VERSION}` },
        });
        if (!welcome) {
          // Consume this single opportunity even if new progress takes priority today.
          if (!featured) featured = featureMilestone(historical, action, visualize);
          await tx.milestonePresentation.create({
            data: { userId, anchorId, eventKey: `welcome:v${RECONCILIATION_VERSION}`, expiresAt },
          });
        }
      }
      const presentation = await tx.milestonePresentation.create({
        data: { userId, anchorId, eventKey, milestoneId: featured?.id ?? null, expiresAt },
      });
      // Every simultaneous award remains earned, but the others never become a cinematic backlog.
      const consumed = fresh.map(r => r.id);
      if (featured && !consumed.includes(featured.id)) consumed.push(featured.id);
      if (consumed.length)
        await tx.anchorMilestone.updateMany({
          where: { userId, anchorId, id: { in: consumed }, automaticReservedAt: null },
          data: { automaticReservedAt: now },
        });
      if (!featured) return null;
      return {
        presentationId: presentation.id,
        expiresAt: expiresAt.toISOString(),
        record: {
          id: featured.id,
          anchorId,
          definitionId: featured.definitionId,
          definitionVersion: featured.definitionVersion,
          earnedAt: featured.earnedAt.toISOString(),
          sourceKind: featured.sourceKind,
          sourceEntityId: featured.sourceEntityId,
          metadata: featured.metadata,
          celebratedAt: featured.celebratedAt?.toISOString() ?? null,
          backfillVersion: featured.backfillVersion,
        },
      };
    });
  }

  async acknowledge(userId: string, milestoneId: string, presentationId: string, now = new Date()) {
    return prisma.$transaction(async tx => {
      const presentation = await tx.milestonePresentation.findFirst({
        where: { id: presentationId, userId, milestoneId },
      });
      if (!presentation)
        throw new AppError('Presentation not found', 404, 'MILESTONE_PRESENTATION_NOT_FOUND');
      await tx.milestonePresentation.updateMany({
        where: { id: presentationId, userId, acknowledgedAt: null },
        data: { acknowledgedAt: now },
      });
      await tx.anchorMilestone.updateMany({
        where: { id: milestoneId, userId, celebratedAt: null },
        data: { celebratedAt: now },
      });
    });
  }
}

export const milestonePresentationService = new MilestonePresentationService();
