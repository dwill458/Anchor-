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
  RecommendationThreadContext,
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
    clientTimeZone: string = 'UTC',
    delta7d: number | null = null
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

    // 3. Resolve Thread Context
    let threadContext: RecommendationThreadContext;
    if (delta7d !== null) {
      threadContext = {
        delta7d,
        delta7dStatus: 'AVAILABLE' as const,
        status: 'AVAILABLE' as const,
      };
    } else {
      try {
        const threadState = await threadStrengthService.getAnchorThreadState(
          userId,
          anchorId,
          new Date(),
          clientTimeZone
        );
        threadContext = {
          strength: threadState.strength ?? undefined,
          delta7d: threadState.delta7d,
          delta7dStatus: 'AVAILABLE' as const,
          status: 'AVAILABLE' as const,
        };
      } catch {
        threadContext = {
          strength: 50,
          delta7d: 0,
          delta7dStatus: 'AVAILABLE' as const,
          status: 'AVAILABLE' as const,
        };
      }
    }

    // 4. First-match-wins evaluation
    const recommendation = this.evaluateFirstMatchRecommendation(
      completionSignal,
      visionContext,
      threadContext.delta7d,
      anchor.id
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
   * Evaluates recommendation for an Anchor:
   * 1. Completed Chart arc (destination reached) -> Release
   * 2. Vision exists -> Visualize
   * 3. delta7d < 0 -> Deep Prime
   * 4. Fallback rotation -> Deep Prime (65%) or Focus (35%)
   */
  evaluateFirstMatchRecommendation(
    completionSignal: RecommendationSignal | null,
    vision: { exists: boolean; seenToday: boolean },
    delta7d: number | null,
    anchorId?: string
  ): RecommendationEvaluation {
    if (completionSignal?.type === 'destination_reached') {
      return {
        action: 'Release',
        reason: completionSignal.type,
      };
    }

    if (vision.exists) {
      return {
        action: 'Visualize',
        reason: vision.seenToday ? 'vision_scene' : 'unseen_vision',
      };
    }

    if (delta7d !== null && delta7d < 0) {
      return {
        action: 'Deep Prime',
        reason: 'thread_decay',
      };
    }

    // Dynamic rotation between Deep Prime (~65%) and Focus (~35%) to avoid static Focus output
    let hashScore = 0;
    if (anchorId) {
      for (let i = 0; i < anchorId.length; i++) {
        hashScore = (hashScore * 31 + anchorId.charCodeAt(i)) | 0;
      }
      hashScore = Math.abs(hashScore);
    } else {
      hashScore = 0;
    }

    const isDeepPrime = (hashScore % 100) < 65;

    if (isDeepPrime) {
      return {
        action: 'Deep Prime',
        reason: 'deep_reinforcement',
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
