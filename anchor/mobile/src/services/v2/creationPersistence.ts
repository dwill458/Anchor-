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
      source: 'v2_creation',
    },
    idempotencyKey,
  };
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

/**
 * Destination is the Anchor's Vision description — the future state the intention points at.
 * Creating a description-only Vision is idempotent server-side (an existing active Vision is
 * updated), is not premium-gated, and shows nothing on Home until the Vision has images.
 */
export async function persistDestination({ anchorId, description }: { anchorId: string; description: string }): Promise<void> {
  await apiClient.post(`/api/v2/anchors/${encodeURIComponent(anchorId)}/vision`, { description: description.trim() });
}
