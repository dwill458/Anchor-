import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';

export type ThreadPracticeType = 'focus' | 'deep_prime' | 'visualize' | 'release';
export type ThreadAuthorityMode = 'shadow' | 'authoritative';

export type ThreadStrengthStatus = 'unestablished' | 'active' | 'grace' | 'decaying' | 'dormant';
export type ThreadStrengthSensitivity = 'lenient' | 'balanced' | 'strict';
export type ThreadStrengthLevel = 'Surface' | 'Grounded' | 'Rooted' | 'Embedded' | 'Sovereign';

export type DecayPreferenceHistoryEntry = {
  sensitivity: ThreadStrengthSensitivity;
  effectiveFromLocalDateKey: string;
  createdAt: string;
};

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
  delta7dStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'FIRST_WEEK';
  lastCompletedAt: Date | null;
  ruleVersion: string;
};

// Thread Strength 2.0 locked scoring constants
export const DAILY_RETURN_BONUS = 1.5;
export const POINTS_PER_MINUTE = 0.5;
export const DAILY_DURATION_CAP_SECONDS = 600; // 10 minutes max earning
export const DAILY_DECAY = 3;
export const MIN_STRENGTH = 0;
export const MAX_STRENGTH = 100;

export const SENSITIVITY_GRACE_DAYS: Record<ThreadStrengthSensitivity, number> = {
  lenient: 2,
  balanced: 1,
  strict: 0,
};

export const THREAD_STRENGTH_LEVELS: ReadonlyArray<{
  level: ThreadStrengthLevel;
  minStrength: number;
  maxStrength: number;
}> = [
  { level: 'Surface', minStrength: 0, maxStrength: 19 },
  { level: 'Grounded', minStrength: 20, maxStrength: 39 },
  { level: 'Rooted', minStrength: 40, maxStrength: 59 },
  { level: 'Embedded', minStrength: 60, maxStrength: 79 },
  { level: 'Sovereign', minStrength: 80, maxStrength: 100 },
];

export function getThreadStrengthLevel(strength: number | null | undefined): ThreadStrengthLevel {
  if (strength === null || strength === undefined) return 'Surface';
  const clamped = Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, Math.round(strength)));
  if (clamped >= 80) return 'Sovereign';
  if (clamped >= 60) return 'Embedded';
  if (clamped >= 40) return 'Rooted';
  if (clamped >= 20) return 'Grounded';
  return 'Surface';
}

export function roundToPrecision(val: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export function resolveLocalDateKeyFromDate(date: Date, timeZone: string = 'UTC'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find(p => p.type === type)?.value || '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function calendarDaysBetweenDateKeys(
  fromLocalDateKey: string,
  toLocalDateKey: string
): number {
  const [fromY, fromM, fromD] = fromLocalDateKey.split('-').map(Number);
  const [toY, toM, toD] = toLocalDateKey.split('-').map(Number);
  const fromUtc = Date.UTC(fromY, fromM - 1, fromD);
  const toUtc = Date.UTC(toY, toM - 1, toD);
  return Math.max(0, Math.round((toUtc - fromUtc) / 86_400_000));
}

export function countDecayEligibleDaysBetweenDateKeys(
  fromExclusiveLocalDateKey: string,
  toExclusiveLocalDateKey: string,
  restDays: readonly number[] = []
): number {
  const rest = new Set(restDays);
  const days = calendarDaysBetweenDateKeys(fromExclusiveLocalDateKey, toExclusiveLocalDateKey);
  if (days <= 1) return 0;
  const [fromY, fromM, fromD] = fromExclusiveLocalDateKey.split('-').map(Number);
  const fromUtc = Date.UTC(fromY, fromM - 1, fromD);
  let count = 0;
  for (let offset = 1; offset < days; offset += 1) {
    const d = new Date(fromUtc + offset * 86_400_000);
    if (!rest.has(d.getUTCDay())) {
      count += 1;
    }
  }
  return count;
}

export function calculateSessionEarning(input: {
  practiceType: ThreadPracticeType;
  durationSeconds: number;
  isFirstSessionToday: boolean;
  priorEligibleSecondsToday: number;
}): {
  dailyBonus: number;
  durationPoints: number;
  delta: number;
  newEligibleSecondsToday: number;
} {
  if (input.practiceType === 'release') {
    return {
      dailyBonus: 0,
      durationPoints: 0,
      delta: 0,
      newEligibleSecondsToday: input.priorEligibleSecondsToday,
    };
  }

  const dailyBonus = input.isFirstSessionToday ? DAILY_RETURN_BONUS : 0;
  const safeDuration = Math.max(0, input.durationSeconds);
  const clampedPrior = Math.max(
    0,
    Math.min(DAILY_DURATION_CAP_SECONDS, input.priorEligibleSecondsToday)
  );
  const newEligible = Math.min(DAILY_DURATION_CAP_SECONDS, clampedPrior + safeDuration);
  const deltaSeconds = Math.max(0, newEligible - clampedPrior);
  const durationPoints = (deltaSeconds / 60) * POINTS_PER_MINUTE;
  const delta = dailyBonus + durationPoints;

  return {
    dailyBonus,
    durationPoints,
    delta,
    newEligibleSecondsToday: newEligible,
  };
}

export function calculateEffectivePracticeGain(
  currentStrength: number | null,
  practiceType: ThreadPracticeType,
  sameDaySessionCount: number = 1,
  durationSeconds: number = 300
): { beforeStrength: number; afterStrength: number; delta: number } {
  const isFirstSessionToday = sameDaySessionCount <= 1;
  const priorEligibleSecondsToday = isFirstSessionToday
    ? 0
    : Math.min(DAILY_DURATION_CAP_SECONDS, (sameDaySessionCount - 1) * durationSeconds);
  const earning = calculateSessionEarning({
    practiceType,
    durationSeconds,
    isFirstSessionToday,
    priorEligibleSecondsToday,
  });
  const beforeStrength = currentStrength !== null ? roundToPrecision(currentStrength, 4) : 0;
  const afterStrength = roundToPrecision(
    Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, beforeStrength + earning.delta)),
    4
  );
  const delta = roundToPrecision(afterStrength - beforeStrength, 4);
  return { beforeStrength, afterStrength, delta };
}

export function calculateThreadDecay(
  missedDays: number,
  sensitivity: ThreadStrengthSensitivity = 'balanced'
): number {
  const normalized = Math.max(0, Math.floor(missedDays));
  const grace = SENSITIVITY_GRACE_DAYS[sensitivity] ?? 1;
  if (normalized <= grace) return 0;
  return (normalized - grace) * DAILY_DECAY;
}

export function applyDecay(
  score: number | null,
  missedDays: number,
  sensitivity: ThreadStrengthSensitivity = 'balanced'
): number | null {
  if (score === null) return null;
  const decayAmount = calculateThreadDecay(missedDays, sensitivity);
  if (decayAmount <= 0) return score;
  return roundToPrecision(Math.max(MIN_STRENGTH, score - decayAmount), 4);
}

export function resolveSensitivityForDateKey(
  dateKey: string,
  currentSensitivity: ThreadStrengthSensitivity = 'balanced',
  history?: DecayPreferenceHistoryEntry[] | null
): ThreadStrengthSensitivity {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return currentSensitivity;
  }
  const sorted = [...history].sort((a, b) =>
    a.effectiveFromLocalDateKey.localeCompare(b.effectiveFromLocalDateKey)
  );
  let resolved = currentSensitivity;
  for (const entry of sorted) {
    if (entry.effectiveFromLocalDateKey <= dateKey) {
      resolved = entry.sensitivity;
    }
  }
  return resolved;
}

export function applyMultiDayDecay(
  startingStrength: number,
  fromExclusiveLocalDateKey: string,
  toExclusiveLocalDateKey: string,
  restDays: readonly number[] = [],
  currentSensitivity: ThreadStrengthSensitivity = 'balanced',
  history?: DecayPreferenceHistoryEntry[] | null,
  consecutiveMissedDaysOffset: number = 0
): { strength: number; consecutiveMissedDays: number } {
  const days = calendarDaysBetweenDateKeys(fromExclusiveLocalDateKey, toExclusiveLocalDateKey);
  if (days <= 1) {
    return { strength: startingStrength, consecutiveMissedDays: consecutiveMissedDaysOffset };
  }

  const [fromY, fromM, fromD] = fromExclusiveLocalDateKey.split('-').map(Number);
  const fromUtc = Date.UTC(fromY, fromM - 1, fromD);
  const rest = new Set(restDays);

  let strength = startingStrength;
  let consecutiveMissedDays = consecutiveMissedDaysOffset;

  for (let offset = 1; offset < days; offset += 1) {
    const d = new Date(fromUtc + offset * 86_400_000);
    if (rest.has(d.getUTCDay())) {
      continue;
    }
    consecutiveMissedDays += 1;
    const dateKey = d.toISOString().slice(0, 10);
    const sensitivity = resolveSensitivityForDateKey(dateKey, currentSensitivity, history);
    const grace = SENSITIVITY_GRACE_DAYS[sensitivity] ?? 1;

    if (consecutiveMissedDays > grace) {
      strength = Math.max(MIN_STRENGTH, strength - DAILY_DECAY);
    }
  }

  return { strength: roundToPrecision(strength, 4), consecutiveMissedDays };
}

export function determineThreadStatus(
  hasMovements: boolean,
  strength: number | null,
  daysSinceLastPractice: number,
  sensitivity: ThreadStrengthSensitivity = 'balanced'
): ThreadStrengthStatus {
  if (!hasMovements || strength === null) {
    return 'unestablished';
  }
  const grace = SENSITIVITY_GRACE_DAYS[sensitivity] ?? 1;
  if (daysSinceLastPractice <= 1) {
    return 'active';
  }
  if (daysSinceLastPractice <= grace + 1) {
    return 'grace';
  }
  if (strength <= MIN_STRENGTH) {
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
    durationSeconds?: number;
    completedAt: Date;
    sessionId: string;
    localDateKey?: string;
    timeZone?: string;
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
      select: {
        id: true,
        anchorId: true,
        practiceMode: true,
        completedDurationSeconds: true,
        completedAt: true,
        localDateKey: true,
        timeZone: true,
      },
    });
    if (!session || !session.anchorId) return null;
    const practiceType = normalizeThreadPracticeType(session.practiceMode);
    if (!practiceType) return null;
    return this.calculatePracticeCompletion({
      userId: input.userId,
      anchorId: session.anchorId,
      practiceType,
      durationSeconds: session.completedDurationSeconds,
      completedAt: session.completedAt,
      sessionId: session.id,
      localDateKey: session.localDateKey,
      timeZone: session.timeZone,
      mode: input.mode,
    });
  }

  private async calculateInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      anchorId: string;
      practiceType: ThreadPracticeType;
      durationSeconds?: number;
      completedAt: Date;
      sessionId: string;
      localDateKey?: string;
      timeZone?: string;
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
      create: {
        userId: input.userId,
        anchorId: input.anchorId,
        strength: 0,
        ruleVersion: 'v2.0-authoritative',
      },
      update: {},
    });

    const userSettings = await tx.userSettings.findUnique({
      where: { userId: input.userId },
      select: { threadStrengthSensitivity: true, decayPreferencesHistory: true, restDays: true },
    });
    const sensitivity =
      (userSettings?.threadStrengthSensitivity as ThreadStrengthSensitivity) || 'balanced';
    const preferenceHistory =
      (userSettings?.decayPreferencesHistory as DecayPreferenceHistoryEntry[] | null) || null;
    const restDays = userSettings?.restDays || [];

    const priorMovements = await tx.threadV2Movement.findMany({
      where: { userId: input.userId, anchorId: input.anchorId },
      orderBy: [{ completedAt: 'asc' }, { sessionId: 'asc' }],
    });

    const sessionIds = [...priorMovements.map(m => m.sessionId), input.sessionId];
    const sessions =
      sessionIds.length > 0 && typeof tx.practiceSession?.findMany === 'function'
        ? await tx.practiceSession.findMany({
            where: { id: { in: sessionIds } },
            select: {
              id: true,
              localDateKey: true,
              timeZone: true,
              completedAt: true,
              completedDurationSeconds: true,
            },
          })
        : [];
    const dateMap = new Map<string, string>();
    const durationMap = new Map<string, number>();
    for (const s of sessions) {
      dateMap.set(s.id, s.localDateKey || resolveLocalDateKeyFromDate(s.completedAt, s.timeZone));
      durationMap.set(s.id, s.completedDurationSeconds ?? 0);
    }
    const resolvedInputDateKey =
      input.localDateKey || resolveLocalDateKeyFromDate(input.completedAt, input.timeZone || 'UTC');
    dateMap.set(input.sessionId, resolvedInputDateKey);
    if (typeof input.durationSeconds === 'number') {
      durationMap.set(input.sessionId, input.durationSeconds);
    }

    const newMovementPlaceholder = await tx.threadV2Movement.create({
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

    const newMovementRecord = {
      id: newMovementPlaceholder?.id || `movement-${input.sessionId}`,
      userId: input.userId,
      anchorId: input.anchorId,
      sessionId: input.sessionId,
      practiceType: input.practiceType,
      completedAt: input.completedAt,
      beforeStrength: 0,
      afterStrength: 0,
      delta: 0,
      reason: 'practice_completed',
    };

    // Replay in chronological order
    const allMovements = [
      ...priorMovements.filter(m => m.sessionId !== input.sessionId),
      newMovementRecord,
    ].sort((a, b) => {
      const aTime = a.completedAt?.getTime?.() ?? new Date(a.completedAt).getTime();
      const bTime = b.completedAt?.getTime?.() ?? new Date(b.completedAt).getTime();
      const timeDiff = aTime - bTime;
      return timeDiff !== 0 ? timeDiff : a.sessionId.localeCompare(b.sessionId);
    });

    let strength: number | null = null;
    let cursorDateKey: string | null = null;
    let requested: ThreadMovement | null = null;
    const dailyEligibleSeconds = new Map<string, number>();
    const dailyFirstSessionAwarded = new Set<string>();
    let consecutiveMissedDays = 0;

    for (const movement of allMovements) {
      const mDateKey =
        dateMap.get(movement.sessionId) ||
        resolveLocalDateKeyFromDate(movement.completedAt, input.timeZone || 'UTC');
      const durationSeconds = durationMap.get(movement.sessionId) ?? 300;
      const practiceType = movement.practiceType as ThreadPracticeType;

      if (cursorDateKey && mDateKey > cursorDateKey) {
        const decayResult = applyMultiDayDecay(
          strength ?? 0,
          cursorDateKey,
          mDateKey,
          restDays,
          sensitivity,
          preferenceHistory,
          consecutiveMissedDays
        );
        strength = decayResult.strength;
        consecutiveMissedDays = 0;
      }

      const priorSecondsToday = dailyEligibleSeconds.get(mDateKey) ?? 0;
      const isFirstToday = !dailyFirstSessionAwarded.has(mDateKey);

      const earning = calculateSessionEarning({
        practiceType,
        durationSeconds,
        isFirstSessionToday: isFirstToday,
        priorEligibleSecondsToday: priorSecondsToday,
      });

      if (practiceType !== 'release') {
        dailyFirstSessionAwarded.add(mDateKey);
      }
      dailyEligibleSeconds.set(mDateKey, earning.newEligibleSecondsToday);

      const beforeStrength = strength !== null ? roundToPrecision(strength, 4) : 0;
      const afterStrength = roundToPrecision(
        Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, (strength ?? 0) + earning.delta)),
        4
      );
      const delta = roundToPrecision(afterStrength - beforeStrength, 4);

      if (
        movement.id === newMovementPlaceholder.id ||
        movement.beforeStrength !== beforeStrength ||
        movement.afterStrength !== afterStrength ||
        movement.delta !== delta
      ) {
        await tx.threadV2Movement.update({
          where: { id: movement.id },
          data: { beforeStrength, afterStrength, delta },
        });
      }

      if (movement.sessionId === input.sessionId) {
        requested = {
          beforeStrength,
          afterStrength,
          delta,
          reason: 'practice_completed',
          idempotent: false,
        };
      }

      strength = afterStrength;
      cursorDateKey = mDateKey;
    }

    const latest = allMovements[allMovements.length - 1];
    await tx.threadV2State.update({
      where: { userId_anchorId: { userId: input.userId, anchorId: input.anchorId } },
      data: {
        strength: strength ?? 0,
        lastCompletedAt: latest?.completedAt ?? null,
        ruleVersion: 'v2.0-authoritative',
      },
    });

    if (!requested) throw new Error('Thread movement was not persisted');

    await tx.threadEventLedger.upsert({
      where: { idempotencyKey: `practice-thread-event:${input.sessionId}` },
      create: {
        userId: input.userId,
        anchorId: input.anchorId,
        eventType: 'THREAD_STRENGTHENED',
        significance: requested.afterStrength >= 80 ? 'HIGH' : 'MEDIUM',
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
        durationSeconds: session.completedDurationSeconds,
        completedAt: session.completedAt,
        sessionId: session.id,
        localDateKey: session.localDateKey,
        timeZone: session.timeZone,
        mode: 'authoritative',
      });
    }
  }

  async getAnchorThreadState(
    userId: string,
    anchorId: string,
    asOfDate: Date = new Date(),
    clientTimeZone: string = 'UTC',
    restDaysOverride: readonly number[] = []
  ): Promise<AnchorThreadState> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId, isArchived: false },
      select: { id: true, createdAt: true },
    });
    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { threadStrengthSensitivity: true, decayPreferencesHistory: true, restDays: true },
    });
    const sensitivity =
      (userSettings?.threadStrengthSensitivity as ThreadStrengthSensitivity) || 'balanced';
    const preferenceHistory =
      (userSettings?.decayPreferencesHistory as DecayPreferenceHistoryEntry[] | null) || null;
    const restDays = restDaysOverride.length > 0 ? restDaysOverride : userSettings?.restDays || [];

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
        delta7dStatus: 'FIRST_WEEK',
        lastCompletedAt: null,
        ruleVersion: 'v2.0-authoritative',
      };
    }

    const sessionIds = movements.map(m => m.sessionId);
    const sessions =
      sessionIds.length > 0 && typeof prisma.practiceSession?.findMany === 'function'
        ? await prisma.practiceSession.findMany({
            where: { id: { in: sessionIds } },
            select: {
              id: true,
              localDateKey: true,
              timeZone: true,
              completedAt: true,
              completedDurationSeconds: true,
            },
          })
        : [];
    const sessionDateMap = new Map<string, string>();
    const sessionDurationMap = new Map<string, number>();
    for (const s of sessions) {
      sessionDateMap.set(
        s.id,
        s.localDateKey || resolveLocalDateKeyFromDate(s.completedAt, s.timeZone || clientTimeZone)
      );
      sessionDurationMap.set(s.id, s.completedDurationSeconds ?? 0);
    }

    const currentStrength = this.calculateStrengthAtDate(
      anchor.createdAt,
      movements,
      asOfDate,
      restDays,
      clientTimeZone,
      sessionDateMap,
      sessionDurationMap,
      sensitivity,
      preferenceHistory
    );

    const isFirstWeek = anchor.createdAt
      ? asOfDate.getTime() - new Date(anchor.createdAt).getTime() < 7 * 86_400_000
      : false;
    let delta7d: number | null = null;
    let delta7dStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'FIRST_WEEK' = 'UNAVAILABLE';

    if (isFirstWeek) {
      delta7d = null;
      delta7dStatus = 'FIRST_WEEK';
    } else {
      const sevenDaysAgo = new Date(asOfDate.getTime() - 7 * 86_400_000);
      const pastStrength = this.calculateStrengthAtDate(
        anchor.createdAt,
        movements,
        sevenDaysAgo,
        restDays,
        clientTimeZone,
        sessionDateMap,
        sessionDurationMap,
        sensitivity,
        preferenceHistory
      );
      delta7d =
        currentStrength !== null && pastStrength !== null
          ? roundToPrecision(currentStrength - pastStrength)
          : null;
      delta7dStatus = delta7d !== null ? 'AVAILABLE' : 'UNAVAILABLE';
    }

    const latest = movements[movements.length - 1];

    await prisma.threadV2State.upsert({
      where: { userId_anchorId: { userId, anchorId } },
      create: {
        userId,
        anchorId,
        strength: currentStrength ?? 0,
        lastCompletedAt: latest?.completedAt ?? null,
        ruleVersion: 'v2.0-authoritative',
      },
      update: {
        strength: currentStrength ?? 0,
        lastCompletedAt: latest?.completedAt ?? null,
        ruleVersion: 'v2.0-authoritative',
      },
    });

    const daysSinceLastPractice = latest
      ? Math.max(0, Math.floor((asOfDate.getTime() - latest.completedAt.getTime()) / 86_400_000))
      : 999;
    const status = determineThreadStatus(true, currentStrength, daysSinceLastPractice, sensitivity);

    return {
      anchorId,
      strength: currentStrength,
      status,
      delta7d,
      delta7dStatus,
      lastCompletedAt: latest?.completedAt ?? null,
      ruleVersion: 'v2.0-authoritative',
    };
  }

  calculateStrengthAtDate(
    _createdAt: Date,
    movements: Array<{ practiceType: string; completedAt: Date; sessionId?: string }>,
    targetDate: Date,
    restDays: readonly number[] = [],
    timeZone: string = 'UTC',
    sessionDateMap?: Map<string, string>,
    sessionDurationMap?: Map<string, number>,
    sensitivity: ThreadStrengthSensitivity = 'balanced',
    preferenceHistory?: DecayPreferenceHistoryEntry[] | null
  ): number | null {
    if (movements.length === 0) return null;

    const applicableMovements = movements
      .filter(m => new Date(m.completedAt).getTime() <= targetDate.getTime())
      .sort((a, b) => {
        const aTime = new Date(a.completedAt).getTime();
        const bTime = new Date(b.completedAt).getTime();
        const diff = aTime - bTime;
        return diff !== 0 ? diff : (a.sessionId ?? '').localeCompare(b.sessionId ?? '');
      });

    if (applicableMovements.length === 0) return null;

    let strength: number | null = null;
    let cursorDateKey: string | null = null;
    const dailyEligibleSeconds = new Map<string, number>();
    const dailyFirstSessionAwarded = new Set<string>();
    let consecutiveMissedDays = 0;

    for (const movement of applicableMovements) {
      const mDateKey =
        (movement.sessionId ? sessionDateMap?.get(movement.sessionId) : null) ||
        resolveLocalDateKeyFromDate(movement.completedAt, timeZone);
      const durationSeconds =
        (movement.sessionId ? sessionDurationMap?.get(movement.sessionId) : null) ?? 300;
      const practiceType = movement.practiceType as ThreadPracticeType;

      if (cursorDateKey && mDateKey > cursorDateKey) {
        const decayResult = applyMultiDayDecay(
          strength ?? 0,
          cursorDateKey,
          mDateKey,
          restDays,
          sensitivity,
          preferenceHistory,
          consecutiveMissedDays
        );
        strength = decayResult.strength;
        consecutiveMissedDays = 0;
      }

      const priorSecondsToday = dailyEligibleSeconds.get(mDateKey) ?? 0;
      const isFirstToday = !dailyFirstSessionAwarded.has(mDateKey);

      const earning = calculateSessionEarning({
        practiceType,
        durationSeconds,
        isFirstSessionToday: isFirstToday,
        priorEligibleSecondsToday: priorSecondsToday,
      });

      if (practiceType !== 'release') {
        dailyFirstSessionAwarded.add(mDateKey);
      }
      dailyEligibleSeconds.set(mDateKey, earning.newEligibleSecondsToday);

      const beforeStrength = strength !== null ? roundToPrecision(strength, 4) : 0;
      const afterStrength = roundToPrecision(
        Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, beforeStrength + earning.delta)),
        4
      );
      strength = afterStrength;
      cursorDateKey = mDateKey;
    }

    if (cursorDateKey) {
      const targetDateKey = resolveLocalDateKeyFromDate(targetDate, timeZone);
      if (targetDateKey > cursorDateKey) {
        const decayResult = applyMultiDayDecay(
          strength ?? 0,
          cursorDateKey,
          targetDateKey,
          restDays,
          sensitivity,
          preferenceHistory,
          consecutiveMissedDays
        );
        strength = decayResult.strength;
      }
    }

    return strength !== null
      ? roundToPrecision(Math.max(MIN_STRENGTH, Math.min(MAX_STRENGTH, strength)), 2)
      : null;
  }
}

export const threadStrengthService = new ThreadStrengthService();
