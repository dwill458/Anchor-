import { apiClient } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import type { Anchor, SigilVariationStyle } from '@/types';
import type { AnchorCandidate, CreationDraft } from '@/stores/v2/creationStore';

type Envelope<T> = { success: boolean; data: T };

/** V2 creates visibility only from the canonical /api/anchors response. */
export async function createV2Anchor(draft: CreationDraft, candidate: AnchorCandidate, idempotencyKey: string): Promise<{ anchorId: string }> {
  const structureVariant: SigilVariationStyle = draft.structureType === 'raw' ? 'minimal' : draft.structureType === 'contained' ? 'dense' : 'balanced';
  const response = await apiClient.post<Envelope<Anchor>>('/api/anchors', {
    intentionText: draft.intention, category: draft.category ?? 'career', distilledLetters: draft.distilledLetters ?? [],
    baseSigilSvg: candidate.structureSvg, structureVariant,
    classifierMeta: { v2Expression: candidate.expression, v2StructureType: draft.structureType ?? null, v2SelectedCandidateId: candidate.id },
    idempotencyKey,
  });
  if (!response.data.success || !response.data.data?.id) throw new Error('Anchor creation did not return a canonical Anchor.');
  const anchor = response.data.data;
  useAnchorStore.getState().addAnchor(anchor);
  return { anchorId: anchor.id };
}
