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

/**
 * Caller holds this account's quota-owner row lock. Never infer abandoned legacy generations.
 * Saved evidence is live Anchors (including archived ones) plus hard-deleted "burned" Anchors,
 * excluding any saved through the ledger (those are already counted as sessions).
 */
export async function countHistoricalCreationBaseline(
  tx: Prisma.TransactionClient,
  userId: string,
  since?: Date
): Promise<number> {
  if (!since) return 0;
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    SELECT (
      (SELECT COUNT(*) FROM anchors a
        WHERE a."userId" = ${userId} AND a."createdAt" >= ${since}
          AND NOT EXISTS (SELECT 1 FROM anchor_creation_sessions s WHERE s.saved_anchor_id = a.id))
      +
      (SELECT COUNT(*) FROM burned_anchors b
        WHERE b."userId" = ${userId} AND b."createdAt" >= ${since}
          AND NOT EXISTS (SELECT 1 FROM anchor_creation_sessions s WHERE s.saved_anchor_id = b."originalAnchorId"))
    )::int AS count`;
  return rows[0]?.count ?? 0;
}

/** True when this account has ever saved an Anchor, even if the row was later burned. */
export async function hasSavedAnchorHistory(
  tx: Prisma.TransactionClient,
  userId: string,
  counter: number
): Promise<boolean> {
  if (counter >= 1) return true;
  if ((await tx.anchor.count({ where: { userId } })) > 0) return true;
  return (await tx.burnedAnchor.count({ where: { userId } })) > 0;
}
