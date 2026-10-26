import { prisma } from '../lib/prisma';
import {
  threadStrengthService,
  normalizeThreadPracticeType,
  getThreadStrengthLevel,
  ThreadPracticeType,
} from '../services/v2/ThreadStrengthService';

export interface RecalculationResult {
  anchorId: string;
  intention: string;
  completedSessions: number;
  totalDurationSeconds: number;
  oldStrength: number | null;
  newStrength: number | null;
  newLevel: string;
  delta7d: number | null;
}

export async function recalculateAnchorStrength(
  userId: string,
  anchorId: string
): Promise<RecalculationResult | null> {
  const anchor = await prisma.anchor.findFirst({
    where: { id: anchorId, userId },
    select: { id: true, intentionText: true },
  });
  if (!anchor) return null;

  const existingState = await prisma.threadV2State.findUnique({
    where: { userId_anchorId: { userId, anchorId } },
    select: { strength: true, legacyBaselineAppliedAt: true, activationStatus: true },
  });
  // Deleting movements would discard rows a protected legacy baseline / activation
  // award depends on. Thread Strength 2.1 anchors must never be re-derived from scratch.
  if (existingState?.legacyBaselineAppliedAt || existingState?.activationStatus) return null;
  const oldStrength = existingState?.strength ?? null;

  const sessions = await prisma.practiceSession.findMany({
    where: {
      userId,
      anchorId,
      completionStatus: 'completed',
    },
    select: {
      id: true,
      practiceMode: true,
      completedDurationSeconds: true,
      completedAt: true,
      localDateKey: true,
      timeZone: true,
    },
    orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
  });

  const totalDurationSeconds = sessions.reduce(
    (sum, s) => sum + (s.completedDurationSeconds ?? 0),
    0
  );

  // Remove stale movements for this anchor so they can be re-derived with 2.0 scoring rules
  await prisma.threadV2Movement.deleteMany({
    where: { userId, anchorId },
  });

  for (const session of sessions) {
    const practiceType = normalizeThreadPracticeType(session.practiceMode);
    if (!practiceType) continue;

    await threadStrengthService.calculatePracticeCompletion({
      userId,
      anchorId,
      practiceType,
      durationSeconds: session.completedDurationSeconds,
      completedAt: session.completedAt,
      sessionId: session.id,
      localDateKey: session.localDateKey,
      timeZone: session.timeZone,
      mode: 'authoritative',
    });
  }

  const newState = await threadStrengthService.getAnchorThreadState(userId, anchorId);
  const newLevel = getThreadStrengthLevel(newState.strength);

  return {
    anchorId,
    intention: anchor.intentionText,
    completedSessions: sessions.length,
    totalDurationSeconds,
    oldStrength,
    newStrength: newState.strength,
    newLevel,
    delta7d: newState.delta7d,
  };
}

export async function runRecalculation(): Promise<RecalculationResult[]> {
  console.log('Starting Thread Strength 2.0 Historical Migration...');
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const results: RecalculationResult[] = [];

  for (const user of users) {
    const anchors = await prisma.anchor.findMany({
      where: { userId: user.id, isArchived: false },
      select: { id: true },
    });

    for (const anchor of anchors) {
      const res = await recalculateAnchorStrength(user.id, anchor.id);
      if (res) {
        results.push(res);
        console.log(
          `User ${user.email} | Anchor "${res.intention}" (${res.anchorId}): ` +
            `Old Strength: ${res.oldStrength} -> New Strength: ${res.newStrength} (${res.newLevel}) | ` +
            `Sessions: ${res.completedSessions}, Duration: ${Math.round(res.totalDurationSeconds / 60)}m`
        );
      }
    }
  }

  console.log(`\nThread Strength 2.0 Migration complete. ${results.length} anchors migrated.`);
  return results;
}

if (require.main === module) {
  runRecalculation()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
