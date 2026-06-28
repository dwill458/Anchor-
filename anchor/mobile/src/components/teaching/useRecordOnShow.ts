/**
 * useRecordOnShow
 *
 * Shared helper for MicroTeach render components. When a resolved teaching
 * becomes visible for the first time, records the show in the teaching store
 * (driving lifetime exhaustion) and fires the `teaching_shown` analytics event.
 *
 * Records at most once per mounted instance.
 */
import { useEffect, useRef } from 'react';
import type { TeachingContent } from '@/constants/teaching';
import { useTeachingStore } from '@/stores/teachingStore';
import { AnalyticsService } from '@/services/AnalyticsService';

export function useRecordOnShow(
  teaching: TeachingContent | null,
  screenId: string,
): void {
  const recordShown = useTeachingStore((s) => s.recordShown);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!teaching || recordedRef.current) return;
    recordedRef.current = true;

    recordShown(teaching.teachingId, teaching.pattern, teaching.maxShows);
    AnalyticsService.track('teaching_shown', {
      teaching_id: teaching.teachingId,
      pattern: teaching.pattern,
      screen: teaching.screen,
      trigger: teaching.trigger,
      guide_mode: teaching.guideOnly,
    });
  }, [teaching, recordShown]);
}
