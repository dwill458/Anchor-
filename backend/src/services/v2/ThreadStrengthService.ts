import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';

export type ThreadPracticeType = 'focus' | 'deep_prime' | 'visualize' | 'release';
export type ThreadAuthorityMode = 'shadow' | 'authoritative';

export type ThreadStrengthStatus =
  | 'unestablished'
  | 'active'
  | 'grace'
  | 'decaying'
  | 'dormant';

export type ThreadMovement = {
  beforeStrength: number;
  afterStrength: number;
  delta: number;
  reason: 'practice_completed';
  idempotent: boolean;
};

export type AnchorThreadState = {
  anchorId: string;
  strength: number | null;
  status: ThreadStrengthStatus;
  delta7d: number | null;
  delta7dStatus: 'AVAILABLE' | 'UNAVAILABLE';
  lastCompletedAt: Date | null;
  ruleVersion: string;
};

export const BASE_PRACTICE_GAINS: Record<ThreadPracticeType, number> = {
  focus: 7,
  deep_prime: 11,
  visualize: 9,
  release: 0,
};

export const INITIAL_ESTABLISHED_BASE = 15;
export const GRACE_DAYS = 2;
export const DAILY_DECAY = 3;
export const DORMANT_FLOOR = 10;

export function calculateEffectivePracticeGain(
  currentStrength: number | null,
  practiceType: ThreadPracticeType
): { beforeStrength: number; afterStrength: number; delta: number } {
  const baseGain = BASE_PRACTICE_GAINS[practiceType];
  if (currentStrength === null) {
    if (baseGain === 0) {
      return { beforeStrength: 0, afterStrength: 0, delta: 0 };
    }
    const effectiveGain = Math.max(1, Math.round(baseGain * (1 - INITIAL_ESTABLISHED_BASE / 120)));
    const afterStrength = INITIAL_ESTABLISHED_BASE + effectiveGain;
    return { beforeStrength: 0, afterStrength, delta: afterStrength };
  }
  if (baseGain === 0) {
    return { beforeStrength: currentStrength, afterStrength: currentStrength, delta: 0 };
  }
  const effectiveGain = Math.max(1, Math.round(baseGain * (1 - currentStrength / 120)));
  const afterStrength = Math.min(100, currentStrength + effectiveGain);
  const delta = afterStrength - currentStrength;
  return { beforeStrength: currentStrength, afterStrength, delta };
}

export function calculateThreadDecay(missedDays: number): number {
  const normalized = Math.max(0, Math.floor(missedDays));
  if (normalized <= GRACE_DAYS) return 0;
  return (normalized - GRACE_DAYS) * DAILY_DECAY;
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
  score: number | null,
  missedDays: number
): number | null {
  if (score === null) return null;
  const decayAmount = calculateThreadDecay(missedDays);
  if (decayAmount <= 0) return score;
  return Math.max(DORMANT_FLOOR, score - decayAmount);
}

export function determineThreadStatus(
  hasMovements: boolean,
  strength: number | null,
  daysSinceLastPractice: number
): ThreadStrengthStatus {
  if (!hasMovements || strength === null) {
    return 'unestablished';
  }
  if (daysSinceLastPractice <= 1) {
    return 'active';
  }
  if (daysSinceLastPractice <= GRACE_DAYS) {
    return 'grace';
  }
  if (strength <= DORMANT_FLOOR) {
    return 'dormant';
  }
  return 'decaying';
}

export function normalizeThreadPracticeType(value: string): ThreadPracticeType | null {
  if (value === 'focus') return 'focus';
  if (value === 'deep_prime' || value === 'prime' || value === 'deep') return 'deep_prime';
  if (value === 'visualize' || value === 'visual') return 'visualize';
  if (value === 'release') return 'release';
  return null;
}

export function isThreadPracticeType(value: string): value is ThreadPracticeType {
  return normalizeThreadPracticeType(value) !== null;
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
    if (!session || !session.anchorId) return null;
    const practiceType = normalizeThreadPracticeType(session.practiceMode);
    if (!practiceType) return null;
    return this.calculatePracticeCompletion({
      userId: input.userId,
      anchorId: session.anchorId,
      practiceType,
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
      create: { userId: input.userId, anchorId: input.anchorId, strength: 0 },
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
    let strength: number | null = null;
    let previous: Date | null = null;
    let requested: ThreadMovement | null = null;
    for (const movement of movements) {
      if (previous) {
        const missedDays = countDecayEligibleDays(previous, movement.completedAt);
        strength = applyDecay(strength, missedDays);
      }
      const { beforeStrength, afterStrength, delta } = calculateEffectivePracticeGain(
        strength,
        movement.practiceType as ThreadPracticeType
      );
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
      data: { strength: strength ?? 0, lastCompletedAt: latest?.completedAt ?? null },
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
   * Automatically synchronizes any completed practice sessions for an anchor
   * that do not yet have corresponding Thread V2 movements.
   */
  async syncMissingMovementsForAnchor(userId: string, anchorId: string): Promise<void> {
    const sessions = await prisma.practiceSession.findMany({
      where: {
        userId,
        anchorId,
        completionStatus: 'completed',
      },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
    });

    if (sessions.length === 0) return;

    const existingMovements = await prisma.threadV2Movement.findMany({
      where: { userId, anchorId },
      select: { sessionId: true },
    });
    const existingSessionIds = new Set(existingMovements.map(m => m.sessionId));

    for (const session of sessions) {
      if (existingSessionIds.has(session.id)) continue;
      const normalizedType = normalizeThreadPracticeType(session.practiceMode);
      if (!normalizedType) continue;

      await this.calculatePracticeCompletion({
        userId,
        anchorId,
        practiceType: normalizedType,
        completedAt: session.completedAt,
        sessionId: session.id,
        mode: 'authoritative',
      });
    }
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

    await this.syncMissingMovementsForAnchor(userId, anchorId);

    const movements = await prisma.threadV2Movement.findMany({
      where: { userId, anchorId },
      orderBy: [{ completedAt: 'asc' }, { sessionId: 'asc' }],
    });

    if (movements.length === 0) {
      return {
        anchorId,
        strength: null,
        status: 'unestablished',
        delta7d: null,
        delta7dStatus: 'AVAILABLE',
        lastCompletedAt: null,
        ruleVersion: 'v2-authoritative',
      };
    }

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

    const delta7d =
      currentStrength !== null && pastStrength !== null ? currentStrength - pastStrength : null;
    const latest = movements[movements.length - 1];

    // Ensure ThreadV2State table is synced with the latest authoritative strength
    await prisma.threadV2State.upsert({
      where: { userId_anchorId: { userId, anchorId } },
      create: {
        userId,
        anchorId,
        strength: currentStrength ?? 0,
        lastCompletedAt: latest?.completedAt ?? null,
      },
      update: {
        strength: currentStrength ?? 0,
        lastCompletedAt: latest?.completedAt ?? null,
      },
    });

    const daysSinceLastPractice = latest
      ? Math.max(0, Math.floor((asOfDate.getTime() - latest.completedAt.getTime()) / 86_400_000))
      : 999;
    const status = determineThreadStatus(true, currentStrength, daysSinceLastPractice);

    return {
      anchorId,
      strength: currentStrength,
      status,
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
    _createdAt: Date,
    movements: Array<{ practiceType: string; completedAt: Date }>,
    targetDate: Date,
    restDays: readonly number[] = []
  ): number | null {
    if (movements.length === 0) return null;

    let strength: number | null = null;
    let cursor: Date | null = null;

    for (const movement of movements) {
      if (movement.completedAt > targetDate) break;

      if (cursor) {
        const missedDays = countDecayEligibleDays(cursor, movement.completedAt, restDays);
        strength = applyDecay(strength, missedDays);
      }

      const { afterStrength } = calculateEffectivePracticeGain(
        strength,
        movement.practiceType as ThreadPracticeType
      );
      strength = afterStrength;
      cursor = movement.completedAt;
    }

    if (cursor && targetDate > cursor) {
      const missedDays = countDecayEligibleDays(cursor, targetDate, restDays);
      strength = applyDecay(strength, missedDays);
    }

    return strength !== null ? Math.max(0, Math.min(100, Math.round(strength))) : null;
  }
}

export const threadStrengthService = new ThreadStrengthService();
