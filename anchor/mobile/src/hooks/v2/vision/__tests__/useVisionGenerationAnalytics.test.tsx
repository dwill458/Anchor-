import { renderHook } from '@testing-library/react-native';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useVisionGenerationAnalytics } from '../useVisionGenerationAnalytics';
import type { VisionGenerationJob } from '../useV2VisionGeneration';
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
it('reports terminal results once per attempt, without descriptions or reference data', () => {
  const job = { id: 'job', anchorId: 'anchor', status: 'COMPLETE', retryCount: 0, candidates: [] } as unknown as VisionGenerationJob;
  const view = renderHook(({ value }) => useVisionGenerationAnalytics('anchor', value), { initialProps: { value: job } });
  view.rerender({ value: { ...job } });
  expect(AnalyticsService.track).toHaveBeenCalledTimes(1);
  view.rerender({ value: { ...job, retryCount: 1, status: 'FAILED' } });
  expect(AnalyticsService.track).toHaveBeenLastCalledWith('vision_image_generation_failed', {
    anchor_id: 'anchor', job_id: 'job', retry_count: 1, candidate_count: 0,
  });
  expect(AnalyticsService.track).toHaveBeenCalledTimes(2);
});
