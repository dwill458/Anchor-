/**
 * The server writes behind Anchor creation.
 *
 * Creation makes exactly one Anchor write: `POST /api/anchors`, carrying the draft's stable
 * idempotency key. The server owns the record, the first-Anchor rule and its row lock
 * (`assertCanCreateAnchor`); this module never decides eligibility and never touches the
 * trial. A local copy is written only after the server has confirmed the record, so a failed
 * save leaves nothing half-created on the device.
 */
import { apiClient, ApiClientError } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { CATEGORY_TO_TIER, type Anchor, type ApiResponse } from '@/types';
import { normalizeExpression } from '@/components/v2/anchor/anchorExpressions';
import type { CreationDraft, SaveFailure } from '@/stores/v2/creationStore';
import type { AnchorExpression } from '@/constants/v2/creation';
import type { GeneratedAnchorCandidate } from '@/constants/v2/creation';
import { generationStyleFor } from '@/components/v2/creation/expressionOptions';
import { logger } from '@/utils/logger';

/** A save failure the flow can explain and route on. */
export class CreationSaveError extends Error {
  constructor(public readonly failure: SaveFailure, message?: string) {
    super(message ?? failure);
    this.name = 'CreationSaveError';
  }
}

/** Server error → what the user can do about it. */
export function classifySaveFailure(error: unknown): SaveFailure {
  if (error instanceof CreationSaveError) return error.failure;
  if (error instanceof ApiClientError) {
    if (error.code === 'CREATE_ANCHOR_FREE_LOCKED') return 'second_anchor';
    if (error.code === 'PRO_DAILY_ANCHOR_CAP_REACHED' || error.status === 429) return 'limit';
    if (error.status === 401) return 'auth';
    if (error.status === 403) return 'second_anchor';
    return 'server';
  }
  const message = error instanceof Error ? error.message : '';
  if (/network|timeout|connection/i.test(message)) return 'network';
  if (/session expired|sign in/i.test(message)) return 'auth';
  return 'server';
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The create payload. Everything here is derived from the draft; nothing is invented. */
export function buildCreatePayload(draft: CreationDraft, idempotencyKey: string) {
  if (!draft.structureSvg || !draft.distilledLetters?.length) {
    throw new CreationSaveError('server', 'The Anchor structure is not ready.');
  }
  const category = draft.category ?? 'custom';
  return {
    intentionText: draft.normalizedIntention ?? draft.intention.trim(),
    category,
    distilledLetters: draft.distilledLetters,
    baseSigilSvg: draft.structureSvg,
    // The focused structure is the generator's balanced variant.
    structureVariant: 'balanced' as const,
    // The grid the structure was actually drawn on. Omitting it made the server default
    // every Anchor to the 3×3 grid regardless of its category.
    planetaryTier: CATEGORY_TO_TIER[category],
    classifierVersion: 2,
    classifierMeta: {
      v2Expression: draft.expression,
      v2Structure: draft.structureType ?? 'focused',
      ...(draft.expression !== 'original' && draft.styleChoice ? { v2StyleChoice: draft.styleChoice } : {}),
      source: 'v2_creation',
    },
    ...(draft.enhancedImageUrl ? { enhancedImageUrl: draft.enhancedImageUrl } : {}),
    ...(draft.enhancementMetadata ? { enhancementMetadata: draft.enhancementMetadata } : {}),
    idempotencyKey,
  };
}

type EnhanceResponse = {
  variations?: Array<{
    imageUrl?: string;
    variationId?: string;
    structureMatchScore?: number;
    structurePreserved?: boolean;
    classification?: string;
  }>;
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  provider?: string;
  controlMethod?: string;
  generationTime?: number;
  reuseRequestId?: string;
};

/** Why a generation failed, which decides the copy the user sees. */
export type GenerationFailure = SaveFailure;

/**
 * Reuses the production enhancement endpoint. It is intentionally a user action adapter, not
 * an effect: mounting the Expression screen cannot spend an AI generation.
 *
 * `count` is how many interpretations are still needed. The answer may hold fewer — one
 * finished interpretation is returned rather than discarded, and the caller asks again only
 * for the one that is missing. Only an answer with none rejects.
 */
export async function generateExpressionCandidates({
  draft,
  generationAttempt = 1,
  count = 2,
}: {
  draft: CreationDraft;
  generationAttempt?: number;
  count?: number;
}): Promise<{ candidates: GeneratedAnchorCandidate[]; metadata: Record<string, unknown> }> {
  if (!draft.structureSvg || draft.expression === 'original') throw new CreationSaveError('server', 'Choose an expression first.');
  const styleChoice = generationStyleFor(draft);
  if (!styleChoice) throw new CreationSaveError('server', 'That expression is not available right now.');
  const wanted = Math.min(2, Math.max(1, Math.round(count)));

  try {
    const response = await apiClient.post<EnhanceResponse>('/api/ai/enhance', {
      sigilSvg: draft.structureSvg,
      styleChoice,
      intentionText: draft.normalizedIntention ?? draft.intention.trim(),
      anchorId: `temp-${draft.draftId}`,
      provider: 'gemini',
      tier: 'premium',
      generationAttempt,
      validateStructure: true,
      variationCount: wanted,
    }, { timeout: 180000 });
    const candidates = (response.data.variations ?? [])
      .filter((variation) => variation.structurePreserved === true && typeof variation.imageUrl === 'string' && variation.imageUrl.length > 0)
      .slice(0, wanted)
      .map((variation) => ({
        imageUrl: variation.imageUrl as string,
        variationId: variation.variationId,
        structureMatchScore: variation.structureMatchScore,
        structurePreserved: variation.structurePreserved,
        classification: variation.classification,
        provider: response.data.provider,
        model: response.data.model,
      }));
    if (candidates.length === 0) throw new CreationSaveError('server', 'The expression did not return a finished interpretation.');
    return {
      candidates,
      metadata: {
        styleApplied: styleChoice,
        modelUsed: response.data.model ?? 'unknown-model',
        provider: response.data.provider ?? 'unknown',
        controlMethod: response.data.controlMethod ?? 'lineart',
        generationTimeMs: typeof response.data.generationTime === 'number' ? response.data.generationTime * 1000 : 0,
        promptUsed: response.data.prompt ?? '',
        negativePrompt: response.data.negativePrompt ?? '',
        reuseRequestId: response.data.reuseRequestId,
        appliedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    throw error instanceof CreationSaveError ? error : new CreationSaveError(classifySaveFailure(error), error instanceof Error ? error.message : undefined);
  }
}

function withExpression(anchor: Anchor, expression: AnchorExpression): Anchor {
  return { ...anchor, classifierMeta: { ...(anchor.classifierMeta ?? {}), v2Expression: expression } };
}

/** Put the confirmed record in the local store exactly once, whether or not it is already there. */
function upsertLocal(record: Anchor, draftId: string): void {
  const store = useAnchorStore.getState();
  const existing = store.getAnchorById(record.id) ?? store.getAnchorById(draftId);
  if (existing) {
    store.applySyncedAnchor(existing.localId ?? existing.id, record);
  } else {
    store.addAnchor(record);
  }
}

/**
 * Persist the drafted Anchor. Safe to call again with the same key after any failure:
 * the server returns the Anchor it already created for that key instead of a second one.
 */
export async function persistCreatedAnchor({
  draft,
  idempotencyKey,
}: {
  draft: CreationDraft;
  idempotencyKey: string;
}): Promise<{ anchorId: string; anchor: Anchor }> {
  const auth = useAuthStore.getState();
  const userId = auth.user?.id;
  if (!auth.isAuthenticated || !userId) {
    throw new CreationSaveError('auth', 'A signed-in account is required to keep an Anchor.');
  }

  let created: Anchor | undefined;
  try {
    const response = await apiClient.post<ApiResponse<Anchor>>('/api/anchors', buildCreatePayload(draft, idempotencyKey));
    created = response.data?.data;
    if (!response.data?.success || !created?.id) throw new CreationSaveError('server', 'The server did not return the Anchor.');
  } catch (error) {
    throw error instanceof CreationSaveError ? error : new CreationSaveError(classifySaveFailure(error), error instanceof Error ? error.message : undefined);
  }

  // A replayed key returns the record as first written. If the expression changed between
  // attempts, record the one the user actually kept.
  const storedExpression = normalizeExpression(created.classifierMeta?.v2Expression);
  if (storedExpression !== draft.expression) {
    try {
      await apiClient.put(`/api/anchors/${encodeURIComponent(created.id)}`, { expression: draft.expression });
    } catch (error) {
      logger.warn('[creationPersistence] Expression could not be updated after an idempotent replay', error);
    }
  }

  const record: Anchor = withExpression(
    {
      ...created,
      // The server hands back a freshly signed URL for the same stored image. Home would have to
      // fetch it again, so the circle arrived blank; the URL the user just chose from is already
      // decoded and names the same object. The next sync replaces it with the server's own.
      ...(draft.enhancedImageUrl && created.enhancedImageUrl ? { enhancedImageUrl: draft.enhancedImageUrl } : {}),
      localId: draft.draftId,
      userId: created.userId ?? userId,
      createdAt: toDate(created.createdAt) ?? new Date(),
      updatedAt: toDate(created.updatedAt) ?? new Date(),
    },
    draft.expression,
  );
  upsertLocal(record, draft.draftId);
  return { anchorId: record.id, anchor: record };
}
