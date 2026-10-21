import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { deletePrivateImageAsset } from '../StorageService';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_GRACE_DAYS = 7;
const MAX_SESSIONS_PER_RUN = 50;

const retentionSessionSelect = {
  id: true,
  userId: true,
  expiresAt: true,
  draftReferences: true,
  rounds: {
    select: {
      candidates: { select: { assetId: true } },
      references: { select: { assetId: true } },
    },
  },
} satisfies Prisma.VisionCreationSessionSelect;
type RetentionSession = Prisma.VisionCreationSessionGetPayload<{
  select: typeof retentionSessionSelect;
}>;
type RetentionDb = Pick<
  Prisma.TransactionClient,
  | 'visionCreationSession'
  | 'asset'
  | 'visionScene'
  | 'visionGenerationCandidate'
  | 'visionAppearanceReference'
  | 'visionGenerationReference'
  | 'visionGeneration'
>;

export type VisionConversationRetentionResult = {
  dryRun: boolean;
  cutoffAt: string;
  sessionsExamined: number;
  purgedSessionIds: string[];
  candidateAssetIdsEligible: string[];
  candidateAssetIdsDeleted: string[];
  retainedReferenceAssetIds: string[];
  storageCleanupRequested: string[];
};

function idsFromDraft(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item =>
    item && typeof item === 'object' && 'assetId' in item && typeof item.assetId === 'string'
      ? [item.assetId]
      : []
  );
}

function sessionAssetIds(session: RetentionSession): {
  candidates: string[];
  references: string[];
} {
  const candidates = [
    ...new Set(
      session.rounds.flatMap(round =>
        round.candidates
          .map(candidate => candidate.assetId)
          .filter((id): id is string => Boolean(id))
      )
    ),
  ];
  const references = [
    ...new Set([
      ...session.rounds.flatMap(round => round.references.map(reference => reference.assetId)),
      ...idsFromDraft(session.draftReferences),
    ]),
  ];
  return { candidates, references };
}

async function eligibleSessions(
  cutoffAt: Date,
  take = MAX_SESSIONS_PER_RUN
): Promise<RetentionSession[]> {
  return prisma.visionCreationSession.findMany({
    where: { expiresAt: { lte: cutoffAt } },
    orderBy: { expiresAt: 'asc' },
    take,
    select: retentionSessionSelect,
  });
}

async function draftReferencesBySession(
  db: RetentionDb,
  userId: string
): Promise<Map<string, Set<string>>> {
  // PostgreSQL array containment won't find reference objects with additional keys, so parse drafts.
  const sessions = await db.visionCreationSession.findMany({
    where: { userId },
    select: { id: true, draftReferences: true },
  });
  return new Map(
    sessions.map(session => [session.id, new Set(idsFromDraft(session.draftReferences))])
  );
}

async function unsharedCandidateAsset(
  db: RetentionDb,
  sessionId: string,
  userId: string,
  assetId: string,
  draftReferences: Map<string, Set<string>>
): Promise<{ id: string; storageKey: string } | null> {
  const asset = await db.asset.findFirst({
    where: { id: assetId, userId },
    select: { id: true, storageKey: true },
  });
  if (!asset) return null;

  const outsideSession = {
    OR: [{ generation: { sessionId: null } }, { generation: { sessionId: { not: sessionId } } }],
  };
  const [scene, candidate, appearance, reference, source, draftReference] = await Promise.all([
    db.visionScene.findFirst({ where: { assetId }, select: { id: true } }),
    db.visionGenerationCandidate.findFirst({
      where: { assetId, ...outsideSession },
      select: { id: true },
    }),
    db.visionAppearanceReference.findFirst({ where: { assetId }, select: { id: true } }),
    db.visionGenerationReference.findFirst({
      where: { assetId, ...outsideSession },
      select: { id: true },
    }),
    db.visionGeneration.findFirst({ where: { startAssetId: assetId }, select: { id: true } }),
    Promise.resolve(
      [...draftReferences].some(
        ([otherId, references]) => otherId !== sessionId && references.has(assetId)
      )
    ),
  ]);
  return scene || candidate || appearance || reference || source || draftReference ? null : asset;
}

async function inspectSessionAssets(
  db: RetentionDb,
  session: RetentionSession,
  draftReferences: Map<string, Set<string>>
): Promise<{
  candidates: string[];
  references: string[];
  candidateAssetIdsEligible: string[];
}> {
  const { candidates, references } = sessionAssetIds(session);
  const candidateAssetIdsEligible: string[] = [];
  for (const id of candidates) {
    if (references.includes(id)) continue;
    const asset = await unsharedCandidateAsset(db, session.id, session.userId, id, draftReferences);
    if (!asset) continue;
    candidateAssetIdsEligible.push(id);
  }
  return { candidates, references, candidateAssetIdsEligible };
}

/**
 * Removes conversation sessions after their expiry plus a seven-day recovery grace period.
 * Dry-run is the default. Only generated candidate assets that remain unreferenced after
 * cascading the session are eligible for row deletion; reference uploads stay under the
 * existing account asset-retention policy.
 */
export async function purgeExpiredVisionConversations(
  options: { apply?: boolean; now?: Date } = {}
): Promise<VisionConversationRetentionResult> {
  const apply = options.apply === true;
  const now = options.now ?? new Date();
  const cutoffAt = new Date(now.getTime() - RETENTION_GRACE_DAYS * DAY_MS);
  const sessions = await eligibleSessions(cutoffAt);
  const result: VisionConversationRetentionResult = {
    dryRun: !apply,
    cutoffAt: cutoffAt.toISOString(),
    sessionsExamined: sessions.length,
    purgedSessionIds: [],
    candidateAssetIdsEligible: [],
    candidateAssetIdsDeleted: [],
    retainedReferenceAssetIds: [],
    storageCleanupRequested: [],
  };

  if (!apply) {
    const draftReferences = new Map<string, Set<string>>();
    for (const userId of new Set(sessions.map(session => session.userId))) {
      for (const [sessionId, refs] of await draftReferencesBySession(prisma, userId)) {
        draftReferences.set(sessionId, refs);
      }
    }
    for (const session of sessions) {
      const assets = await inspectSessionAssets(prisma, session, draftReferences);
      result.candidateAssetIdsEligible.push(...assets.candidateAssetIdsEligible);
      result.retainedReferenceAssetIds.push(...assets.references);
    }
    result.candidateAssetIdsEligible = [...new Set(result.candidateAssetIdsEligible)];
    result.retainedReferenceAssetIds = [...new Set(result.retainedReferenceAssetIds)];
    return result;
  }

  for (const listed of sessions) {
    let purged: {
      sessionId: string;
      references: string[];
      candidateAssetIdsEligible: string[];
      deletedIds: string[];
      rows: Array<{ id: string; storageKey: string }>;
    } | null;
    try {
      purged = await prisma.$transaction(
        async tx => {
          await tx.$queryRaw`SELECT id FROM vision_creation_sessions WHERE id = ${listed.id} FOR UPDATE`;
          const session = await tx.visionCreationSession.findUnique({
            where: { id: listed.id },
            select: retentionSessionSelect,
          });
          if (!session || session.expiresAt.getTime() > cutoffAt.getTime()) return null;

          const assets = sessionAssetIds(session);
          await tx.visionCreationSession.delete({ where: { id: session.id } });
          const draftReferences = await draftReferencesBySession(tx, session.userId);
          const rows: Array<{ id: string; storageKey: string }> = [];
          const deletedIds: string[] = [];
          const candidateAssetIdsEligible: string[] = [];
          for (const assetId of assets.candidates) {
            if (assets.references.includes(assetId)) continue;
            await tx.$queryRaw`SELECT id FROM assets WHERE id = ${assetId} AND user_id = ${session.userId} FOR UPDATE`;
            const asset = await unsharedCandidateAsset(
              tx,
              session.id,
              session.userId,
              assetId,
              draftReferences
            );
            if (!asset) continue;
            candidateAssetIdsEligible.push(assetId);
            const deleted = await tx.asset.deleteMany({
              where: {
                id: assetId,
                userId: session.userId,
                visionScenes: { none: {} },
                visionCandidates: { none: {} },
                visionAppearanceReferences: { none: {} },
                visionGenerationReferences: { none: {} },
              },
            });
            if (deleted.count === 1) {
              deletedIds.push(assetId);
              rows.push(asset);
            }
          }
          return {
            sessionId: session.id,
            references: assets.references,
            candidateAssetIdsEligible,
            deletedIds,
            rows,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        }
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
        throw new Error(
          'Vision conversation retention conflicted with concurrent writes. Review the dry-run and retry the purge.'
        );
      }
      throw error;
    }
    if (!purged) continue;
    result.purgedSessionIds.push(purged.sessionId);
    result.candidateAssetIdsEligible.push(...purged.candidateAssetIdsEligible);
    result.candidateAssetIdsDeleted.push(...purged.deletedIds);
    result.retainedReferenceAssetIds.push(...purged.references);
    for (const row of purged.rows) {
      // StorageService is best-effort; this reports a cleanup request, not physical confirmation.
      try {
        await deletePrivateImageAsset(row.storageKey);
        result.storageCleanupRequested.push(row.id);
      } catch (error) {
        console.warn('[VisionConversationRetention] Storage cleanup request failed', {
          assetId: row.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  result.candidateAssetIdsEligible = [...new Set(result.candidateAssetIdsEligible)];
  result.candidateAssetIdsDeleted = [...new Set(result.candidateAssetIdsDeleted)];
  result.retainedReferenceAssetIds = [...new Set(result.retainedReferenceAssetIds)];
  result.storageCleanupRequested = [...new Set(result.storageCleanupRequested)];
  return result;
}
