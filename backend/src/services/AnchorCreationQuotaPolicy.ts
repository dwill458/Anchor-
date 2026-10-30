import { Prisma } from '@prisma/client';

/** Window accounting also includes output inherited from a verified guest or previous plan. */
export function countCreationUsage(
  tx: Prisma.TransactionClient,
  ownerId: string,
  quotaScope: string,
  since?: Date,
  excludeSessionId?: string
) {
  return tx.anchorCreationSession.count({
    where: {
      ownerId,
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      status: { in: ['reserved', 'completed'] },
      OR: [
        { quotaScope },
        ...(since
          ? [
              { status: 'completed', completedAt: { gte: since } },
              { status: 'reserved', createdAt: { gte: since } },
            ]
          : []),
      ],
    },
  });
}

/** Caller holds this account's quota-owner row lock. Never infer abandoned legacy generations. */
export async function countHistoricalCreationBaseline(
  tx: Prisma.TransactionClient,
  userId: string,
  since?: Date
): Promise<number> {
  if (!since) return 0;
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM anchors a
    WHERE a."userId" = ${userId} AND a."createdAt" >= ${since}
      AND NOT EXISTS (SELECT 1 FROM anchor_creation_sessions s WHERE s.saved_anchor_id = a.id)`;
  return rows[0]?.count ?? 0;
}
