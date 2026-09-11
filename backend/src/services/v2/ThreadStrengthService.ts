import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type ThreadPracticeType = 'focus' | 'deep_prime' | 'visualize' | 'release';
export type ThreadAuthorityMode = 'shadow' | 'authoritative';

export type ThreadMovement = {
  beforeStrength: number;
  afterStrength: number;
  delta: number;
  reason: 'practice_completed';
  idempotent: boolean;
};

const LEGACY_V1_DEFAULT_GAIN: Record<ThreadPracticeType, number> = {
  focus: 25,
  deep_prime: 40,
  visualize: 40,
  release: 25,
};
const STARTING_STRENGTH = 50;

function calendarDaysBetween(first: Date, second: Date): number {
  const firstDay = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
  const secondDay = Date.UTC(second.getUTCFullYear(), second.getUTCMonth(), second.getUTCDate());
  return Math.max(0, Math.floor((secondDay - firstDay) / 86_400_000));
}

// This is the current mobile default: balanced sensitivity, no rest days,
// build-on-rest policy. Per-user preference replication is intentionally a
// later migration; this service does not manufacture a new progression rule.
function applyLegacyDefaultDecay(strength: number, previous: Date | null, current: Date): number {
  if (!previous) return strength;
  const days = calendarDaysBetween(previous, current);
  let next = strength;
  for (let day = 1; day <= days; day += 1) {
    if (day < 2) continue;
    const penalty = day === 2 ? 30 : 15;
    next = Math.max(day === 2 ? 10 : 5, next - penalty);
  }
  return next;
}

function isThreadPracticeType(value: string): value is ThreadPracticeType {
  return (
    value === 'focus' || value === 'deep_prime' || value === 'visualize' || value === 'release'
  );
}

export class ThreadStrengthService {
  /** Replays persisted movement facts to compare current strength with seven days ago. */
  async getDelta7d(input: { userId: string; anchorId: string; asOf?: Date }): Promise<number | null> {
    const asOf = input.asOf ?? new Date();
    const anchor = await prisma.anchor.findFirst({
      where: { id: input.anchorId, userId: input.userId, isArchived: false },
      select: { createdAt: true },
    });
    if (!anchor) return null;
    const windowStart = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (anchor.createdAt > windowStart) return null;
    const movements = await prisma.threadV2Movement.findMany({
      where: { userId: input.userId, anchorId: input.anchorId, completedAt: { lte: asOf } },
      orderBy: [{ completedAt: 'asc' }, { sessionId: 'asc' }],
      select: { practiceType: true, completedAt: true },
    });
    if (!movements.length) return null;
    const strengthAt = (cutoff: Date): number => {
      let strength = STARTING_STRENGTH;
      let previous: Date | null = null;
      for (const movement of movements) {
        if (movement.completedAt > cutoff) break;
        strength = applyLegacyDefaultDecay(strength, previous, movement.completedAt);
        const gain = LEGACY_V1_DEFAULT_GAIN[movement.practiceType as ThreadPracticeType];
        if (gain === undefined) continue;
        strength = Math.min(100, strength + gain);
        previous = movement.completedAt;
      }
      return applyLegacyDefaultDecay(strength, previous, cutoff);
    };
    return strengthAt(asOf) - strengthAt(windowStart);
  }

  async calculatePracticeCompletion(input: {
    userId: string;
    anchorId: string;
    practiceType: ThreadPracticeType;
    completedAt: Date;
    sessionId: string;
    mode: ThreadAuthorityMode;
  }): Promise<ThreadMovement> {
    return prisma.$transaction(tx => this.calculateInTransaction(tx, input), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async calculateForPracticeSession(input: {
    userId: string;
    sessionId: string;
    mode: ThreadAuthorityMode;
  }): Promise<ThreadMovement | null> {
    const session = await prisma.practiceSession.findFirst({
      where: { id: input.sessionId, userId: input.userId },
      select: { id: true, anchorId: true, practiceMode: true, completedAt: true },
    });
    if (!session || !session.anchorId || !isThreadPracticeType(session.practiceMode)) return null;
    return this.calculatePracticeCompletion({
      userId: input.userId,
      anchorId: session.anchorId,
      practiceType: session.practiceMode,
      completedAt: session.completedAt,
      sessionId: session.id,
      mode: input.mode,
    });
  }

  private async calculateInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      anchorId: string;
      practiceType: ThreadPracticeType;
      completedAt: Date;
      sessionId: string;
      mode: ThreadAuthorityMode;
    }
  ): Promise<ThreadMovement> {
    const duplicate = await tx.threadV2Movement.findUnique({
      where: { sessionId: input.sessionId },
    });
    if (duplicate) {
      if (duplicate.userId !== input.userId || duplicate.anchorId !== input.anchorId) {
        throw new Error('Thread movement session ownership conflict');
      }
      return {
        beforeStrength: duplicate.beforeStrength,
        afterStrength: duplicate.afterStrength,
        delta: duplicate.delta,
        reason: 'practice_completed',
        idempotent: true,
      };
    }

    await tx.threadV2State.upsert({
      where: { userId_anchorId: { userId: input.userId, anchorId: input.anchorId } },
      create: { userId: input.userId, anchorId: input.anchorId, strength: STARTING_STRENGTH },
      update: {},
    });
    await tx.threadV2Movement.create({
      data: {
        userId: input.userId,
        anchorId: input.anchorId,
        sessionId: input.sessionId,
        practiceType: input.practiceType,
        completedAt: input.completedAt,
        beforeStrength: 0,
        afterStrength: 0,
        delta: 0,
        reason: 'practice_completed',
      },
    });

    // Recompose every movement in completion order so delayed/offline sessions
    // cannot double-award or distort the final authoritative state.
    const movements = await tx.threadV2Movement.findMany({
      where: { userId: input.userId, anchorId: input.anchorId },
      orderBy: [{ completedAt: 'asc' }, { sessionId: 'asc' }],
    });
    let strength = STARTING_STRENGTH;
    let previous: Date | null = null;
    let requested: ThreadMovement | null = null;
    for (const movement of movements) {
      strength = applyLegacyDefaultDecay(strength, previous, movement.completedAt);
      const beforeStrength = strength;
      const gain = LEGACY_V1_DEFAULT_GAIN[movement.practiceType as ThreadPracticeType];
      const afterStrength = Math.min(100, beforeStrength + gain);
      const delta = afterStrength - beforeStrength;
      await tx.threadV2Movement.update({
        where: { id: movement.id },
        data: { beforeStrength, afterStrength, delta },
      });
      if (movement.sessionId === input.sessionId)
        requested = {
          beforeStrength,
          afterStrength,
          delta,
          reason: 'practice_completed',
          idempotent: false,
        };
      strength = afterStrength;
      previous = movement.completedAt;
    }
    const latest = movements[movements.length - 1];
    await tx.threadV2State.update({
      where: { userId_anchorId: { userId: input.userId, anchorId: input.anchorId } },
      data: { strength, lastCompletedAt: latest?.completedAt ?? null },
    });
    if (!requested) throw new Error('Thread movement was not persisted');
    // Append the canonical fact in the same transaction as the authoritative
    // movement. Presentation consumers never infer this from local progress.
    await tx.threadEventLedger.upsert({
      where: { idempotencyKey: `practice-thread-event:${input.sessionId}` },
      create: {
        userId: input.userId,
        anchorId: input.anchorId,
        eventType: 'THREAD_STRENGTHENED',
        significance: requested.afterStrength >= 100 ? 'HIGH' : 'MEDIUM',
        sourceKind: 'PRACTICE_COMPLETION',
        sourceEntityId: input.sessionId,
        correlationId: input.sessionId,
        occurredAt: input.completedAt,
        idempotencyKey: `practice-thread-event:${input.sessionId}`,
        metadata: {
          beforeStrength: requested.beforeStrength,
          afterStrength: requested.afterStrength,
          delta: requested.delta,
        },
      },
      update: {},
    });
    return requested;
  }
}

export const threadStrengthService = new ThreadStrengthService();
