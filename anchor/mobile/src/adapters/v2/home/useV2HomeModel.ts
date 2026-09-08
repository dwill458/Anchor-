import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';
import { useV2SelectedAnchor } from '@/hooks/v2/home/useV2SelectedAnchor';
import { resolveGreeting } from '@/constants/v2/home';
import type { Anchor } from '@/types';
import { toThreadPresentation, type V2ThreadPresentation } from './threadAdapter';
import { toHomeVisionState, type HomeVisionState } from './visionAdapter';
import { toHomeChartState, type HomeChartState } from './chartAdapter';

export type V2HomeAnchorSummary = {
  anchor: Anchor;
  thread: V2ThreadPresentation;
  isSelected: boolean;
};

export type V2HomeModel = {
  greeting: string;
  hasAnchors: boolean;
  selectedAnchor: Anchor | null;
  thread: V2ThreadPresentation | null;
  anchorList: V2HomeAnchorSummary[];
  vision: HomeVisionState;
  chart: HomeChartState;
};

/**
 * Thin presentation aggregation for Home. It composes existing stores into one
 * read model; it is NOT a second domain authority and performs no progression,
 * entitlement, or course mutation.
 */
export function useV2HomeModel(): V2HomeModel {
  const { selectedAnchor, activeAnchors } = useV2SelectedAnchor();
  const displayName = useAuthStore((s) => s.user?.displayName ?? null);
  const scenes = useVisualizationSceneStore((s) => s.scenes);
  const activeCourse = useCourseStore((s) => s.activeCourse);

  return useMemo(() => {
    const anchorList = activeAnchors.map<V2HomeAnchorSummary>((anchor) => ({
      anchor,
      thread: toThreadPresentation(anchor),
      isSelected:
        !!selectedAnchor &&
        (anchor.id === selectedAnchor.id || anchor.localId === selectedAnchor.localId),
    }));

    const sceneForSelected = selectedAnchor
      ? scenes[selectedAnchor.id] ?? (selectedAnchor.localId ? scenes[selectedAnchor.localId] : undefined)
      : undefined;

    return {
      greeting: resolveGreeting(new Date(), displayName),
      hasAnchors: activeAnchors.length > 0,
      selectedAnchor,
      thread: selectedAnchor ? toThreadPresentation(selectedAnchor) : null,
      anchorList,
      vision: toHomeVisionState(sceneForSelected),
      chart: toHomeChartState(activeCourse),
    };
  }, [activeAnchors, selectedAnchor, displayName, scenes, activeCourse]);
}
