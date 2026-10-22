import { useEffect, useRef } from 'react';
import { AnalyticsService } from '@/services/AnalyticsService';
import type { VisionGenerationJob } from './useV2VisionGeneration';

/** Polls and re-renders do not repeat terminal events; a retry is a new attempt. */
export function useVisionGenerationAnalytics(anchorId: string, job: VisionGenerationJob | null) {
  const reported = useRef(new Set<string>());
  useEffect(() => {
    if (!job || (job.status !== 'COMPLETE' && job.status !== 'FAILED')) return;
    const key = `${job.id}:${job.retryCount}:${job.status}`;
    if (reported.current.has(key)) return;
    reported.current.add(key);
    AnalyticsService.track(job.status === 'COMPLETE' ? 'vision_image_generation_completed' : 'vision_image_generation_failed', {
      anchor_id: anchorId, job_id: job.id, retry_count: job.retryCount,
      candidate_count: job.candidates.length,
    });
  }, [anchorId, job]);
}
