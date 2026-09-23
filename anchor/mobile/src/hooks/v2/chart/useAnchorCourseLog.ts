import { useCallback, useEffect, useRef, useState } from 'react';
import { chartApiClient } from '@/services/ChartApiClient';
import type { CourseLogEntry } from '@/types/chart';
import { useAnchorChart } from './useAnchorChart';

/**
 * Chart evidence for ONE Anchor: the event log of its live route and its
 * earlier routes. Progress must never show another Anchor's waypoints, so this
 * replaces the account-wide course log for Anchor-scoped surfaces.
 */
const logCache = new Map<string, CourseLogEntry[]>();

export function resetAnchorCourseLogCache(): void {
  logCache.clear();
}

export function useAnchorCourseLog(anchorId: string | null | undefined) {
  const chart = useAnchorChart(anchorId ?? null);
  const courseIds = [chart.data?.chart?.id, ...(chart.data?.history ?? []).slice(0, 3).map((item) => item.id)].filter(
    (id): id is string => Boolean(id)
  );
  const cacheKey = courseIds.join('|');
  const versionKey = `${cacheKey}:${chart.data?.chart?.version ?? 0}`;
  const [entries, setEntries] = useState<CourseLogEntry[]>(() => logCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (courseIds.length === 0) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.allSettled(courseIds.map((id) => chartApiClient.getCourseLog(id, { limit: 100 })));
      const merged = results
        .flatMap((result) => (result.status === 'fulfilled' ? result.value.data : []))
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
      logCache.set(cacheKey, merged);
      if (alive.current) setEntries(merged);
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  useEffect(() => {
    setEntries(logCache.get(cacheKey) ?? []);
    void load();
    // Reload when the route changes version (a Move or waypoint was completed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionKey]);

  const refresh = useCallback(async () => {
    await chart.refresh();
    await load();
  }, [chart, load]);

  return { entries, loading: loading || chart.loading, refresh, hasChart: courseIds.length > 0 };
}
