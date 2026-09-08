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
  return value === 'focus' || value === 'deep_prime' || value === 'visualize' || value === 'release';
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
    return prisma.$transaction(
      tx => this.calculateInTransaction(tx, input),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
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
      userId: string; anchorId: string; practiceType: ThreadPracticeType;
      completedAt: Date; sessionId: string; mode: ThreadAuthorityMode;
    }
  ): Promise<ThreadMovement> {
    const duplicate = await tx.threadV2Movement.findUnique({ where: { sessionId: input.sessionId } });
    if (duplicate) {
      if (duplicate.userId !== input.userId || duplicate.anchorId !== input.anchorId) {
        throw new Error('Thread movement session ownership conflict');
      }
      return { beforeStrength: duplicate.beforeStrength, afterStrength: duplicate.afterStrength, delta: duplicate.delta, reason: 'practice_completed', idempotent: true };
    }

    await tx.threadV2State.upsert({
      where: { userId_anchorId: { userId: input.userId, anchorId: input.anchorId } },
      create: { userId: input.userId, anchorId: input.anchorId, strength: STARTING_STRENGTH },
      update: {},
    });
    await tx.threadV2Movement.create({
      data: { userId: input.userId, anchorId: input.anchorId, sessionId: input.sessionId, practiceType: input.practiceType, completedAt: input.completedAt, beforeStrength: 0, afterStrength: 0, delta: 0, reason: 'practice_completed' },
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
      await tx.threadV2Movement.update({ where: { id: movement.id }, data: { beforeStrength, afterStrength, delta } });
      if (movement.sessionId === input.sessionId) requested = { beforeStrength, afterStrength, delta, reason: 'practice_completed', idempotent: false };
      strength = afterStrength;
      previous = movement.completedAt;
    }
    const latest = movements[movements.length - 1];
    await tx.threadV2State.update({
      where: { userId_anchorId: { userId: input.userId, anchorId: input.anchorId } },
      data: { strength, lastCompletedAt: latest?.completedAt ?? null },
    });
    if (!requested) throw new Error('Thread movement was not persisted');
    return requested;
  }
}

export const threadStrengthService = new ThreadStrengthService();
