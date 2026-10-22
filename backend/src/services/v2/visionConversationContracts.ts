import type { Prisma } from '@prisma/client';
import { resolveStorageKeyUrl } from '../StorageService';
import { readDevImagePlan } from '../image/devImageModels';

export const conversationRoundInclude = {
  candidates: { orderBy: { sortOrder: 'asc' as const }, include: { asset: true } },
  references: { orderBy: { sortOrder: 'asc' as const }, include: { asset: true } },
} satisfies Prisma.VisionGenerationInclude;
type StoredRound = Prisma.VisionGenerationGetPayload<{ include: typeof conversationRoundInclude }>;

export async function privatePreview(storageKey?: string | null): Promise<string | null> {
  if (!storageKey) return null;
  try {
    return await resolveStorageKeyUrl(storageKey);
  } catch {
    return null;
  }
}

export async function serializeVisionRound(job: StoredRound) {
  return {
    id: job.id,
    kind: job.kind,
    visionId: job.visionId,
    anchorId: job.anchorId,
    setNumber: job.setNumber,
    retryCount: job.retryCount,
    status: job.status,
    stage: job.stage,
    error: job.error,
    sessionId: job.sessionId ?? null,
    roundNumber: job.roundNumber ?? null,
    operation: job.operation ?? 'CREATE',
    parentCandidateId: job.parentCandidateId ?? null,
    description: job.description,
    ...(readDevImagePlan(job.plan).devImageModel
      ? { devImageModel: readDevImagePlan(job.plan).devImageModel }
      : {}),
    references: await Promise.all(
      (job.references ?? []).map(async ref => ({
        assetId: ref.assetId,
        role: ref.role,
        ...(ref.label ? { label: ref.label } : {}),
        imageUrl: await privatePreview(ref.asset?.storageKey),
      }))
    ),
    candidates: await Promise.all(
      job.candidates.map(async candidate => ({
        id: candidate.id,
        assetId: candidate.assetId,
        role: candidate.role,
        prompt: candidate.prompt,
        sortOrder: candidate.sortOrder,
        status: candidate.status,
        imageUrl: await privatePreview(candidate.asset?.storageKey),
      }))
    ),
  };
}
