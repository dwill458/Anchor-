import { prefetchV2RecommendationContext } from '@/adapters/v2/practice/recommendationClient';
import { hydrateV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { loadAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { prefetchV2Vision } from '@/hooks/v2/vision/useV2Vision';
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';

/** Start independent, read-only Home dependencies as soon as the selected ID is known. */
export function prefetchHomeStartupData(anchorId: string | null | undefined): void {
  if (!anchorId) return;
  HomeStartupProfiler.mark('home_prefetch_started', { anchorId });
  // Disk restore and network revalidation run independently; neither delays
  // Vision or Chart reads, and the persisted value can seed Home on mount.
  void hydrateV2RecommendationContext(anchorId).catch(() => null);
  void prefetchV2RecommendationContext(anchorId).catch(() => undefined);
  void prefetchV2Vision(anchorId).catch(() => undefined);
  void loadAnchorChart(anchorId).catch(() => undefined);
}
