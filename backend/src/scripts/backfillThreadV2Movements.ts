import { prisma } from '../lib/prisma';
import { threadStrengthService, ThreadPracticeType } from '../services/v2/ThreadStrengthService';

function normalizePracticeMode(mode: string): ThreadPracticeType | null {
  if (mode === 'focus') return 'focus';
  if (mode === 'deep_prime' || mode === 'prime' || mode === 'deep') return 'deep_prime';
  if (mode === 'visualize' || mode === 'visual') return 'visualize';
  if (mode === 'release') return 'release';
  return null;
}

async function main() {
  console.log('Starting Thread V2 Movements backfill...');
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  for (const user of users) {
    console.log(`\nProcessing user ${user.email} (${user.id})...`);
    const anchors = await prisma.anchor.findMany({
      where: { userId: user.id },
      select: { id: true, intentionText: true },
    });

    for (const anchor of anchors) {
      const sessions = await prisma.practiceSession.findMany({
        where: {
          userId: user.id,
          anchorId: anchor.id,
          completionStatus: 'completed',
        },
        orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
      });

      if (sessions.length === 0) {
        continue;
      }

      console.log(`  Anchor "${anchor.intentionText}" (${anchor.id}): ${sessions.length} completed sessions`);

      for (const session of sessions) {
        const normalizedMode = normalizePracticeMode(session.practiceMode);
        if (!normalizedMode) {
          console.log(`    Skipping unknown mode: ${session.practiceMode}`);
          continue;
        }

        const existing = await prisma.threadV2Movement.findUnique({
          where: { sessionId: session.id },
        });

        if (!existing) {
          console.log(`    Backfilling session ${session.id} (${normalizedMode} at ${session.completedAt.toISOString()})...`);
          await threadStrengthService.calculatePracticeCompletion({
            userId: user.id,
            anchorId: anchor.id,
            practiceType: normalizedMode,
            completedAt: session.completedAt,
            sessionId: session.id,
            mode: 'authoritative',
          });
        }
      }

      const state = await threadStrengthService.getAnchorThreadState(user.id, anchor.id);
      console.log(`    -> Final State: strength=${state.strength}, delta7d=${state.delta7d}, lastCompleted=${state.lastCompletedAt?.toISOString()}`);
    }
  }

  console.log('\nBackfill completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
