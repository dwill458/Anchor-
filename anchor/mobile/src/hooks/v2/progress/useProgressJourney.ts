import { useMemo } from 'react';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2Vision } from '@/hooks/v2/vision/useV2Vision';
import {
  resolveJourneyState,
  type JourneyState,
  type JourneyVisionStatus,
} from '@/adapters/v2/progress/journeyAdapter';
import type { V2ProgressRouteSummary } from '@/adapters/v2/progress/types';
import type { JourneyVisionData } from '@/components/v2/progress/V2JourneySection';

export interface ProgressJourney {
  state: JourneyState;
  vision: JourneyVisionData | null;
}

/**
 * Which Journey layout the selected Anchor gets, from its own Chart and Vision reads (both cached
 * per Anchor, so switching Anchors does not refetch what is already known). Switching to an Anchor
 * whose reads are not yet known resolves to `loading`, never to a stale or guessed layout.
 */
export function useProgressJourney(
  anchorId: string | null | undefined,
  route: V2ProgressRouteSummary | null | undefined,
): ProgressJourney {
  const id = anchorId ?? '';
  const chart = useAnchorChart(id || null);
  const vision = useV2Vision(id);

  const visionStatus: JourneyVisionStatus = !id ? 'none' : vision.state.state;
  const state = resolveJourneyState({ chartLoading: Boolean(id) && chart.loading, route, visionStatus });

  const data = useMemo<JourneyVisionData | null>(() => {
    if (vision.state.state !== 'ready') return null;
    return {
      tiles: vision.state.tiles,
      featuredTileId: vision.state.featuredTileId,
      statement: vision.state.description || vision.state.title || undefined,
    };
  }, [vision.state]);

  return { state, vision: data };
}
