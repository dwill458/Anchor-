/**
 * The server writes behind Anchor creation.
 *
 * Creation makes exactly one Anchor write: `POST /api/anchors`, carrying the draft's stable
 * idempotency key. The server owns the record, the first-Anchor rule and its row lock
 * (`assertCanCreateAnchor`); this module never decides eligibility and never touches the
 * trial. A local copy is written only after the server has confirmed the record, so a failed
 * save leaves nothing half-created on the device.
 */
import { Image } from 'react-native';
import { apiClient, ApiClientError, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { CATEGORY_TO_TIER, type Anchor, type ApiResponse } from '@/types';
import { normalizeExpression } from '@/components/v2/anchor/anchorExpressions';
import type { CreationDraft, SaveFailure } from '@/stores/v2/creationStore';
import { flushCreationDraft } from '@/stores/v2/creationStore';
import type { AnchorExpression } from '@/constants/v2/creation';
import type { GeneratedAnchorCandidate } from '@/constants/v2/creation';
import { generationStyleFor } from '@/components/v2/creation/expressionOptions';
import { logger } from '@/utils/logger';
import { DEVELOPER_MASTER_ACCOUNT_ID } from '@/utils/developerMasterAccount';
import { AuthService } from '@/services/AuthService';
import { generateAuthorizedAnchor } from '@/services/AnchorCreationSession';
import { captureCreationAuthContext } from '@/services/CreationAuthContext';

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
  if (/session expired|sign in|authentication context changed/i.test(message)) return 'auth';
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
  const selected = draft.generatedCandidates?.[draft.selectedCandidateIndex];
  const originalSessionId = draft.expression === 'original' && typeof draft.enhancementMetadata?.creationSessionId === 'string'
    ? draft.enhancementMetadata.creationSessionId : undefined;
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
    ...(draft.expression !== 'original' && draft.enhancedImageUrl ? { enhancedImageUrl: draft.enhancedImageUrl } : {}),
    ...(draft.enhancementMetadata ? { enhancementMetadata: draft.enhancementMetadata } : {}),
    ...(originalSessionId ? { creationSessionId: originalSessionId, keepOriginal: true } : selected?.creationSessionId && selected.optionId ? {
      creationSessionId: selected.creationSessionId, selectedOptionId: selected.optionId,
    } : {}),
    idempotencyKey,
  };
}

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
    const context = captureCreationAuthContext();
    await flushCreationDraft(draft.draftId);
    context.assertCurrent();
    const data = await generateAuthorizedAnchor({
      sigilSvg: draft.structureSvg,
      styleChoice,
      intentionText: draft.normalizedIntention ?? draft.intention.trim(),
      generationAttempt,
      validateStructure: true,
      variationCount: wanted,
    }, `${draft.draftId}:${styleChoice}:${draft.generationRound ?? 0}`);
    const candidates = (data.variations ?? [])
      .filter((variation) => variation.structurePreserved === true && typeof variation.imageUrl === 'string' && variation.imageUrl.length > 0)
      .slice(0, 2)
      .map((variation) => ({
        imageUrl: variation.imageUrl as string,
        variationId: variation.variationId,
        optionId: variation.optionId,
        creationSessionId: variation.creationSessionId ?? data.creationSessionId,
        structureMatchScore: variation.structureMatchScore,
        structurePreserved: variation.structurePreserved,
        classification: variation.classification,
        provider: data.provider,
        model: data.model,
      }));
    if (candidates.length === 0) throw new CreationSaveError('server', 'The expression did not return a finished interpretation.');
    return {
      candidates,
      metadata: {
        creationSessionId: data.creationSessionId,
        styleApplied: styleChoice,
        modelUsed: data.model ?? 'unknown-model',
        provider: data.provider ?? 'unknown',
        controlMethod: data.controlMethod ?? 'lineart',
        generationTimeMs: typeof data.generationTime === 'number' ? data.generationTime * 1000 : 0,
        promptUsed: data.prompt ?? '',
        negativePrompt: data.negativePrompt ?? '',
        reuseRequestId: data.reuseRequestId,
        appliedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const isDevMaster = __DEV__ && useAuthStore.getState().user?.id === DEVELOPER_MASTER_ACCOUNT_ID;
    if (isDevMaster) {
      logger.warn('[creationPersistence] Dev fallback for expression candidates', error);
      const FIXTURES = [
        require('@/assets/vision/vision-future-desk.jpg'),
        require('@/assets/vision/vision-future-window.jpg'),
      ];
      const candidates: GeneratedAnchorCandidate[] = FIXTURES.slice(0, wanted).map((source, index) => {
        const resolved = Image.resolveAssetSource(source);
        if (!resolved) throw new Error('Unable to resolve the bundled development fixture image.');
        return {
        imageUrl: resolved.uri,
        variationId: `dev-variation-${index}`,
        structureMatchScore: 0.96,
        structurePreserved: true,
        classification: 'focused',
        provider: 'gemini',
        model: 'dev-fixture',
      };
      });
      return {
        candidates,
        metadata: {
          styleApplied: styleChoice,
          modelUsed: 'dev-fixture',
          provider: 'local-dev',
          controlMethod: 'lineart',
          generationTimeMs: 400,
          promptUsed: 'dev prompt',
          negativePrompt: '',
          appliedAt: new Date().toISOString(),
        },
      };
    }
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
  const context = captureCreationAuthContext();
  const isDevMaster = __DEV__ && auth.user?.id === DEVELOPER_MASTER_ACCOUNT_ID;
  await flushCreationDraft(draft.draftId);
  context.assertCurrent();
  const identity = await AuthService.ensureGuestSession();
  context.assertIdentity(identity.user.id, identity.isAnonymous);
  const userId = auth.user?.id ?? identity.user.id;

  let created: Anchor | undefined;
  try {
    const config: AccountBoundRequestConfig = {
      anchorAuthToken: identity.token,
      anchorAuthGuard: context.isCurrent,
    };
    const response = await apiClient.post<ApiResponse<Anchor>>('/api/anchors', buildCreatePayload(draft, idempotencyKey), config);
    context.assertCurrent();
    created = response.data?.data;
    if (!response.data?.success || !created?.id) throw new CreationSaveError('server', 'The server did not return the Anchor.');
  } catch (error) {
    context.assertCurrent();
    if (isDevMaster) {
      logger.warn('[creationPersistence] Dev fallback for anchor persistence', error);
      created = {
        id: `dev-anchor-${draft.draftId}`,
        localId: draft.draftId,
        userId: userId ?? DEVELOPER_MASTER_ACCOUNT_ID,
        intentionText: draft.normalizedIntention ?? draft.intention.trim(),
        category: draft.category ?? 'desire',
        distilledLetters: draft.distilledLetters ?? ['A', 'N', 'C', 'H', 'O', 'R'],
        baseSigilSvg: draft.structureSvg ?? '',
        structureVariant: 'balanced',
        planetaryTier: CATEGORY_TO_TIER[draft.category ?? 'desire'] ?? 'tier_1',
        isCharged: true,
        activationCount: 1,
        chargeCount: 1,
        threadStrength: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      throw error instanceof CreationSaveError ? error : new CreationSaveError(classifySaveFailure(error), error instanceof Error ? error.message : undefined);
    }
  }

  // A replayed key returns the record as first written. If the expression changed between
  // attempts, record the one the user actually kept.
  const storedExpression = normalizeExpression(created.classifierMeta?.v2Expression);
  if (storedExpression !== draft.expression) {
    try {
      const config: AccountBoundRequestConfig = { anchorAuthToken: identity.token, anchorAuthGuard: context.isCurrent };
      await apiClient.put(`/api/anchors/${encodeURIComponent(created.id)}`, { expression: draft.expression }, config);
      context.assertCurrent();
    } catch (error) {
      logger.warn('[creationPersistence] Expression could not be updated after an idempotent replay', error);
    }
  }

  const record: Anchor = withExpression(
    {
      ...created,
      localId: draft.draftId,
      userId: auth.isAuthenticated ? created.userId ?? userId : 'guest',
      createdAt: toDate(created.createdAt) ?? new Date(),
      updatedAt: toDate(created.updatedAt) ?? new Date(),
    },
    draft.expression,
  );
  context.assertCurrent();
  upsertLocal(record, draft.draftId);
  return { anchorId: record.id, anchor: record };
}
