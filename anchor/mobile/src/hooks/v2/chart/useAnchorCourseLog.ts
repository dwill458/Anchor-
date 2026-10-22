import { useCallback, useEffect, useRef, useState } from 'react';
import { chartApiClient } from '@/services/ChartApiClient';
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';
import { useAuthStore } from '@/stores/authStore';
import { readCourseLogCache, writeCourseLogCache } from '@/stores/courseLogStore';
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
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const courseIds = [chart.data?.chart?.id, ...(chart.data?.history ?? []).slice(0, 3).map((item) => item.id)].filter(
    (id): id is string => Boolean(id)
  );
  const cacheKey = `${accountId ?? 'anonymous'}:${courseIds.join('|')}`;
  const versionKey = `${cacheKey}:${chart.data?.chart?.version ?? 0}`;
  const [entries, setEntries] = useState<CourseLogEntry[]>(() => logCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(() => Boolean(cacheKey) && !logCache.has(cacheKey));
  const alive = useRef(true);
  const activeCacheKey = useRef(cacheKey);

  if (activeCacheKey.current !== cacheKey) {
    activeCacheKey.current = cacheKey;
    setEntries(logCache.get(cacheKey) ?? []);
    setLoading(courseIds.length > 0 && !logCache.has(cacheKey));
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const span = HomeStartupProfiler.start('progress_course_log_request', { courseCount: courseIds.length });
    if (courseIds.length === 0) {
      if (activeCacheKey.current === cacheKey) {
        setEntries([]);
        setLoading(false);
      }
      span({ ok: true, skipped: true, entryCount: 0 });
      return;
    }
    setLoading(true);
    const persistedRead = accountId
      ? Promise.all(courseIds.map((id) => readCourseLogCache(accountId, id)))
      : Promise.resolve(courseIds.map(() => null));
    void persistedRead.then((cachedByCourse) => {
      if (
        activeCacheKey.current !== cacheKey ||
        logCache.has(cacheKey) ||
        !cachedByCourse.some((entries) => entries !== null)
      ) return;
      const cached = cachedByCourse.flatMap((entries) => entries ?? [])
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
      logCache.set(cacheKey, cached);
      if (alive.current) setEntries(cached);
    });
    try {
      const results = await Promise.allSettled(courseIds.map((id) => chartApiClient.getCourseLog(id, { limit: 100 })));
      const cachedByCourse = results.some((result) => result.status === 'rejected')
        ? await persistedRead
        : courseIds.map(() => null);
      const merged = results
        .flatMap((result, index) => {
          if (result.status === 'fulfilled') {
            if (accountId) void writeCourseLogCache(accountId, courseIds[index], result.value.data).catch(() => undefined);
            return result.value.data;
          }
          return cachedByCourse[index] ?? [];
        })
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
      logCache.set(cacheKey, merged);
      if (alive.current && activeCacheKey.current === cacheKey) setEntries(merged);
      span({
        ok: true,
        fulfilledCourseCount: results.filter((result) => result.status === 'fulfilled').length,
        cachedCourseCount: cachedByCourse.filter((entries) => entries !== null).length,
        entryCount: merged.length,
      });
    } finally {
      if (alive.current && activeCacheKey.current === cacheKey) setLoading(false);
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

  const cacheMiss = courseIds.length > 0 && !logCache.has(cacheKey);
  return { entries, loading: loading || chart.loading || cacheMiss, refresh, hasChart: courseIds.length > 0 };
}
