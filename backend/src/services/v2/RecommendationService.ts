import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';
import { visionService } from './VisionService';
import { threadStrengthService } from './ThreadStrengthService';
import {
  RecommendationContextResponse,
  RecommendationSignal,
  DestinationReachedSignal,
  WaypointReachedSignal,
  IntentionCompletedSignal,
  RecommendationEvaluation,
} from '../../domain/v2/recommendation';

function stablePart(value: string): string {
  return encodeURIComponent(value);
}

export function buildCourseSignalKey(params: {
  userId: string;
  courseEventId: string;
  courseId: string;
  waypointId?: string | null;
  signalType: 'destination_reached' | 'waypoint_reached';
}): string {
  return [
    `user=${stablePart(params.userId)}`,
    `course=${stablePart(params.courseId)}`,
    `event=${stablePart(params.courseEventId)}`,
    `waypointPresent=${params.waypointId == null ? '0' : '1'}`,
    `waypoint=${params.waypointId == null ? '' : stablePart(params.waypointId)}`,
    `type=${stablePart(params.signalType)}`,
  ].join('&');
}

export function buildIntentionSignalKey(userId: string, anchorId: string): string {
  return `user=${stablePart(userId)}&anchor=${stablePart(anchorId)}&type=intention_completed`;
}

export class RecommendationService {
  /**
   * Evaluates the recommended today projection for an Anchor without consuming any signals.
   */
  async getRecommendationContext(
    userId: string,
    anchorId: string,
    clientTimeZone: string = 'UTC'
  ): Promise<RecommendationContextResponse> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: {
        id: true,
        intentionText: true,
        category: true,
        intentionCompletedAt: true,
        createdAt: true,
      },
    });

    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // 1. Resolve pending Completion Signals (CCR-1 and CCR-2)
    const completionSignal = await this.getPendingCompletionSignal(userId, anchor);

    // 2. Resolve Vision Context
    const vision = await visionService.getAnchorVision(userId, anchorId, clientTimeZone);
    const visionContext = {
      exists: Boolean(vision && vision.status === 'ACTIVE'),
      seenToday: Boolean(vision && vision.status === 'ACTIVE' && vision.seenToday),
      visionId: vision?.id ?? null,
    };

    // 3. Resolve Thread Context from the persisted, server-owned movement ledger.
    const delta7d = await threadStrengthService.getDelta7d({ userId, anchorId });
    const threadContext =
      delta7d === null
        ? {
            delta7d: null,
            delta7dStatus: 'UNAVAILABLE' as const,
            status: 'UNAVAILABLE' as const,
            blockerReason: 'THREAD_DELTA7D_UNAVAILABLE: insufficient persisted Thread movement evidence.',
          }
        : {
            delta7d,
            delta7dStatus: 'AVAILABLE' as const,
            status: 'AVAILABLE' as const,
          };

    // 4. First-match-wins evaluation
    const recommendation = this.evaluateFirstMatchRecommendation(
      completionSignal,
      visionContext,
      threadContext.delta7d
    );

    return {
      anchorId: anchor.id,
      completionSignal,
      vision: {
        exists: visionContext.exists,
        seenToday: visionContext.seenToday,
        visionId: visionContext.visionId,
      },
      thread: threadContext,
      recommendation,
    };
  }

  /**
   * Finds the highest priority pending (unacknowledged) completion signal.
   * All completion signal types are the same highest-priority context and
   * resolve to Release; destination is selected before waypoint before
   * intention when multiple pending completion signals coexist.
   */
  private async getPendingCompletionSignal(
    userId: string,
    anchor: {
      id: string;
      intentionText: string;
      intentionCompletedAt: Date | null;
      createdAt: Date;
    }
  ): Promise<RecommendationSignal | null> {
    // Collect all acknowledged signal keys for this user
    const acks = await prisma.recommendationSignalAck.findMany({
      where: { userId },
      select: { signalKey: true },
    });
    const ackSet = new Set(acks.map(a => a.signalKey));

    // Find linked active courses
    const links = await prisma.courseAnchorLink.findMany({
      where: {
        userId,
        anchorId: anchor.id,
        unlinkedAt: null,
      },
      include: {
        course: {
          include: {
            events: {
              where: {
                eventType: { in: ['COURSE_COMPLETED', 'WAYPOINT_REACHED'] },
              },
              orderBy: { occurredAt: 'desc' },
              include: {
                waypoint: true,
              },
            },
          },
        },
      },
    });

    let destinationSignal: DestinationReachedSignal | null = null;
    let waypointSignal: WaypointReachedSignal | null = null;

    for (const link of links) {
      for (const event of link.course.events) {
        // Skip events that occurred before the anchor was linked to this course
        if (event.occurredAt < link.linkedAt) {
          continue;
        }

        const signalType =
          event.eventType === 'COURSE_COMPLETED' ? 'destination_reached' : 'waypoint_reached';
        const signalKey = buildCourseSignalKey({
          userId,
          courseEventId: event.id,
          courseId: link.courseId,
          waypointId: event.waypointId,
          signalType,
        });
        if (ackSet.has(signalKey)) {
          continue;
        }

        if (event.eventType === 'COURSE_COMPLETED' && !destinationSignal) {
          destinationSignal = {
            id: signalKey,
            type: 'destination_reached',
            courseId: link.courseId,
            destinationTitle: link.course.destinationText,
            occurredAt: event.occurredAt.toISOString(),
          };
        } else if (event.eventType === 'WAYPOINT_REACHED' && !waypointSignal) {
          // Verify snapshot waypointTitle or waypoint relation
          const snapshot = event.snapshot as Record<string, unknown> | null;
          const title =
            (snapshot?.waypointTitle as string) || event.waypoint?.title || 'Waypoint reached';

          waypointSignal = {
            id: signalKey,
            type: 'waypoint_reached',
            courseId: link.courseId,
            waypointId: event.waypointId || '',
            waypointTitle: title,
            occurredAt: event.occurredAt.toISOString(),
          };
        }
      }
    }

    if (destinationSignal) {
      return destinationSignal;
    }

    if (waypointSignal) {
      return waypointSignal;
    }

    // Check intention_completed signal
    if (anchor.intentionCompletedAt) {
      const intentionSignalKey = buildIntentionSignalKey(userId, anchor.id);
      if (!ackSet.has(intentionSignalKey)) {
        const intentionSignal: IntentionCompletedSignal = {
          id: intentionSignalKey,
          type: 'intention_completed',
          anchorId: anchor.id,
          intentionText: anchor.intentionText,
          occurredAt: anchor.intentionCompletedAt.toISOString(),
        };
        return intentionSignal;
      }
    }

    return null;
  }

  /**
   * First-Match-Wins recommendation evaluator:
   * 1. completion context -> Release
   * 2. Vision exists + unseen today -> Visualize
   * 3. delta7d < 0 -> Deep Prime
   * 4. otherwise -> Focus
   */
  evaluateFirstMatchRecommendation(
    completionSignal: RecommendationSignal | null,
    vision: { exists: boolean; seenToday: boolean },
    delta7d: number | null
  ): RecommendationEvaluation {
    if (completionSignal) {
      return {
        action: 'Release',
        reason: completionSignal.type,
      };
    }

    if (vision.exists && !vision.seenToday) {
      return {
        action: 'Visualize',
        reason: 'unseen_vision',
      };
    }

    if (delta7d !== null && delta7d < 0) {
      return {
        action: 'Deep Prime',
        reason: 'thread_decay',
      };
    }

    return {
      action: 'Focus',
      reason: 'daily_focus',
    };
  }

  /**
   * Acknowledges/consumes a recommendation signal so it does not reappear.
   */
  async acknowledgeSignal(
    userId: string,
    signalKey: string,
    signalType: string = 'signal'
  ): Promise<{ success: boolean; signalKey: string; acknowledgedAt: string }> {
    const existing = await prisma.recommendationSignalAck.findUnique({
      where: {
        userId_signalKey: {
          userId,
          signalKey,
        },
      },
    });

    if (existing) {
      return {
        success: true,
        signalKey: existing.signalKey,
        acknowledgedAt: existing.acknowledgedAt.toISOString(),
      };
    }

    let created: { signalKey: string; acknowledgedAt: Date };
    try {
      created = await prisma.recommendationSignalAck.create({
        data: {
          id: randomUUID(),
          userId,
          signalKey,
          signalType,
        },
      });
    } catch (error) {
      // A concurrent duplicate ACK is a successful idempotent replay, not a
      // user-visible failure. The unique constraint is the final arbiter.
      if ((error as { code?: string }).code !== 'P2002') {
        throw error;
      }

      const concurrent = await prisma.recommendationSignalAck.findUnique({
        where: {
          userId_signalKey: {
            userId,
            signalKey,
          },
        },
      });
      if (!concurrent) {
        throw error;
      }
      return {
        success: true,
        signalKey: concurrent.signalKey,
        acknowledgedAt: concurrent.acknowledgedAt.toISOString(),
      };
    }

    return {
      success: true,
      signalKey: created.signalKey,
      acknowledgedAt: created.acknowledgedAt.toISOString(),
    };
  }
}

export const recommendationService = new RecommendationService();
