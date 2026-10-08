import { useCallback, useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import {
  resolveAnchorCreationPaywall,
  type V2AnchorCreationGateResult,
} from '@/adapters/v2/paywall';
import { useV2TrialState } from './useV2TrialState';

export type V2AnchorCreationGate = {
  /** Current decision for a *non-onboarding* creation attempt. */
  result: V2AnchorCreationGateResult;
  /** Decision for a specific attempt; onboarding attempts are always allowed. */
  evaluate: (options?: { isOnboarding?: boolean }) => V2AnchorCreationGateResult;
};

/**
 * Presentation-layer gate for "create another Anchor". It returns a decision
 * only — wiring the `SECOND_ANCHOR` paywall into a flow is the caller's job and
 * happens through the exported route/callback contracts, not here.
 */
export function useV2AnchorCreationGate(): V2AnchorCreationGate {
  const anchors = useAnchorStore((s) => s.anchors);
  const { hasEntitlement } = useV2TrialState();

  const activeAnchorCount = useMemo(
    () => anchors.filter((anchor) => !anchor.isReleased && !anchor.archivedAt).length,
    [anchors],
  );

  const evaluate = useCallback(
    (options?: { isOnboarding?: boolean }) =>
      resolveAnchorCreationPaywall({
        activeAnchorCount,
        isOnboarding: options?.isOnboarding ?? false,
        hasEntitlement,
      }),
    [activeAnchorCount, hasEntitlement],
  );

  return useMemo(() => ({ result: evaluate(), evaluate }), [evaluate]);
}
