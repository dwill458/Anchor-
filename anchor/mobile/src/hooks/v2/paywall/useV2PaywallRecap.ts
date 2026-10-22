import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';
import type { V2PaywallRecap } from '@/components/v2/paywall';

/**
 * Read-only personal history for the trial-ended state. Real counts only — it
 * writes nothing and invents nothing.
 */
export function useV2PaywallRecap(): V2PaywallRecap {
  const anchors = useAnchorStore((s) => s.anchors);
  const practiceHistory = useSessionStore((s) => s.practiceHistory);
  const primingHistory = useSessionStore((s) => s.primingHistory);
  const scenes = useVisualizationSceneStore((s) => s.scenes);

  return useMemo(
    () => ({
      anchors: anchors.length,
      practices: practiceHistory.length + primingHistory.length,
      visions: Object.keys(scenes).length,
    }),
    [anchors.length, practiceHistory.length, primingHistory.length, scenes],
  );
}
