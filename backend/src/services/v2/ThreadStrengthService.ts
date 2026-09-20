import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';

export type ThreadPracticeType = 'focus' | 'deep_prime' | 'visualize' | 'release';
export type ThreadAuthorityMode = 'shadow' | 'authoritative';

export type ThreadMovement = {
  beforeStrength: number;
  afterStrength: number;
  delta: number;
  reason: 'practice_completed';
  idempotent: boolean;
};

export type AnchorThreadState = {
  anchorId: string;
  strength: number;
  delta7d: number;
  delta7dStatus: 'AVAILABLE';
  lastCompletedAt: Date | null;
  ruleVersion: string;
};

const LEGACY_V1_DEFAULT_GAIN: Record<ThreadPracticeType, number> = {
  focus: 25,
  deep_prime: 40,
  visualize: 40,
  release: 25,
};
const STARTING_STRENGTH = 50;

export function calculateThreadDecay(missedDays: number): number {
  const normalized = Math.max(0, Math.floor(missedDays));
  // Balanced sensitivity default: decay starts at day 2 (day 1 is grace period)
  if (normalized < 2) return 0;
  return 30 + (normalized - 2) * 15;
}

export function countDecayEligibleDays(
  fromExclusive: Date,
  toExclusive: Date,
  restDays: readonly number[] = []
): number {
  const rest = new Set(restDays);
  const fromUtc = Date.UTC(
    fromExclusive.getUTCFullYear(),
    fromExclusive.getUTCMonth(),
    fromExclusive.getUTCDate()
  );
  const toUtc = Date.UTC(
    toExclusive.getUTCFullYear(),
    toExclusive.getUTCMonth(),
    toExclusive.getUTCDate()
  );
  const days = Math.max(0, Math.floor((toUtc - fromUtc) / 86_400_000));
  let count = 0;
  for (let offset = 1; offset < days; offset += 1) {
    const d = new Date(fromUtc + offset * 86_400_000);
    if (!rest.has(d.getUTCDay())) {
      count += 1;
    }
  }
  return count;
}

export function applyDecay(
  score: number,
  missedDays: number
): number {
  let next = score;
  for (let day = 1; day <= missedDays; day += 1) {
    const delta = calculateThreadDecay(day) - calculateThreadDecay(day - 1);
    if (delta > 0) {
      next = Math.max(5, next - delta);
    }
  }
  return next;
}

function isThreadPracticeType(value: string): value is ThreadPracticeType {
  return (
    value === 'focus' || value === 'deep_prime' || value === 'visualize' || value === 'release'
  );
}

export class ThreadStrengthService {
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
      if (previous) {
        const missedDays = countDecayEligibleDays(previous, movement.completedAt);
        strength = applyDecay(strength, missedDays);
      }
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

  /**
   * Evaluates authoritative Thread Strength and delta7d for an anchor as of a given timestamp.
   */
  async getAnchorThreadState(
    userId: string,
    anchorId: string,
    asOfDate: Date = new Date(),
    _clientTimeZone: string = 'UTC',
    restDays: readonly number[] = []
  ): Promise<AnchorThreadState> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true, createdAt: true },
    });
    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    const movements = await prisma.threadV2Movement.findMany({
      where: { userId, anchorId },
      orderBy: [{ completedAt: 'asc' }, { sessionId: 'asc' }],
    });

    const currentStrength = this.calculateStrengthAtDate(
      anchor.createdAt,
      movements,
      asOfDate,
      restDays
    );

    const sevenDaysAgo = new Date(asOfDate.getTime() - 7 * 86_400_000);
    const pastStrength = this.calculateStrengthAtDate(
      anchor.createdAt,
      movements,
      sevenDaysAgo,
      restDays
    );

    const delta7d = currentStrength - pastStrength;
    const latest = movements[movements.length - 1];

    // Ensure ThreadV2State table is synced with the latest authoritative strength
    await prisma.threadV2State.upsert({
      where: { userId_anchorId: { userId, anchorId } },
      create: {
        userId,
        anchorId,
        strength: currentStrength,
        lastCompletedAt: latest?.completedAt ?? null,
      },
      update: {
        strength: currentStrength,
        lastCompletedAt: latest?.completedAt ?? null,
      },
    });

    return {
      anchorId,
      strength: currentStrength,
      delta7d,
      delta7dStatus: 'AVAILABLE',
      lastCompletedAt: latest?.completedAt ?? null,
      ruleVersion: 'v2-authoritative',
    };
  }

  /**
   * Evaluates thread strength as of a target point in time based on historical movements and decay.
   */
  calculateStrengthAtDate(
    createdAt: Date,
    movements: Array<{ practiceType: string; completedAt: Date }>,
    targetDate: Date,
    restDays: readonly number[] = []
  ): number {
    let strength = STARTING_STRENGTH;
    let cursor = createdAt;

    for (const movement of movements) {
      if (movement.completedAt > targetDate) break;

      const missedDays = countDecayEligibleDays(cursor, movement.completedAt, restDays);
      strength = applyDecay(strength, missedDays);

      const gain = LEGACY_V1_DEFAULT_GAIN[movement.practiceType as ThreadPracticeType] ?? 25;
      strength = Math.min(100, strength + gain);
      cursor = movement.completedAt;
    }

    if (targetDate > cursor) {
      const missedDays = countDecayEligibleDays(cursor, targetDate, restDays);
      strength = applyDecay(strength, missedDays);
    }

    return Math.max(0, Math.min(100, Math.round(strength)));
  }
}

export const threadStrengthService = new ThreadStrengthService();
