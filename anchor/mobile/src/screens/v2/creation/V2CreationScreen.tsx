import React from 'react';

import { V2CreationFlow, type CreationSaveAdapter, type V2CreationFlowProps } from '@/components/v2/creation/V2CreationFlow';
import type { AnchorCandidate, CreationContinuation, CreationDraft } from '@/stores/v2/creationStore';

export type V2CreationScreenProps = {
  /**
   * Required. The integration branch passes the existing Anchor persistence adapter. It MUST honour
   * `idempotencyKey` (retries reuse the same key) and resolve with the authoritative Anchor id.
   */
  saveAnchor: CreationSaveAdapter;
  /**
   * Required. The integration branch turns the post-save intent into navigation:
   * `home` → Anchor detail/home, `vision` → Vision creation, `chart` → Chart creation (no Vision),
   * `vision_and_chart` → Vision then Chart. All four carry the saved `anchorId`.
   */
  onContinue: (continuation: CreationContinuation) => void;
  /** Optional. A remote provider that returns exactly two candidates sharing one structure SVG. */
  generateCandidates?: (draft: CreationDraft) => Promise<AnchorCandidate[]>;
};

/**
 * UI-C entry point. This is the single component the integration branch registers under
 * `CREATION_ROUTE_NAME` ('V2Creation'). It owns no backend contract and no central-navigation edit;
 * it only adapts the integration-supplied props onto {@link V2CreationFlow}.
 */
export function V2CreationScreen({ saveAnchor, onContinue, generateCandidates }: V2CreationScreenProps) {
  const props: V2CreationFlowProps = { saveAnchor, onContinue, generateCandidates };
  return <V2CreationFlow {...props} />;
}

export type { AnchorCandidate, CreationContinuation, CreationDraft };
