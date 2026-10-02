import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chartApiClient } from '@/services/ChartApiClient';
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import {
  chartActionKey,
  chartV2Api,
  classifyChartError,
  freshKey,
  type ChartForAnchor,
  type ChartRequestError,
  type RouteWaypointInput,
} from '@/services/v2/chartV2Api';
import { toChartViewModel, type ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import type { CourseDetail } from '@/types/chart';
import { recordCourseEvent } from '@/stores/v2/chartEventStore';

/**
 * Per-Anchor Chart state shared by every surface (Chart, Home, Vision,
 * completion hand-offs). One module cache + subscribers keeps them in step
 * after a mutation; an encrypted copy lets an existing Chart open offline.
 */

const memory = new Map<string, ChartForAnchor>();
const listeners = new Map<string, Set<(value: ChartForAnchor) => void>>();
const inflight = new Map<string, Promise<ChartForAnchor>>();
const persistedReads = new Map<string, Promise<ChartForAnchor | null>>();
const currentAccountId = () => useAuthStore.getState().user?.id ?? null;
const cacheKey = (anchorId: string, accountId = currentAccountId()) => `${accountId ?? 'anonymous'}:${anchorId}`;
const storageKey = (anchorId: string, accountId: string) =>
  `anchor:v2:chart2:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`;

function publish(anchorId: string, value: ChartForAnchor, accountId = currentAccountId()): void {
  const key = cacheKey(anchorId, accountId);
  memory.set(key, value);
  listeners.get(key)?.forEach((listener) => listener(value));
  if (accountId) {
    Promise.resolve(encryptedPersistStorage.setItem(storageKey(anchorId, accountId), JSON.stringify(value))).catch(() => undefined);
  }
}

/** Replace only the Chart inside the cached read model. */
function publishChart(anchorId: string, chart: CourseDetail, accountId = currentAccountId()): void {
  const previous = memory.get(cacheKey(anchorId, accountId));
  if (!previous) return;
  publish(anchorId, { ...previous, chart }, accountId);
}

export function resetAnchorChartCache(): void {
  memory.clear();
  listeners.clear();
  inflight.clear();
  persistedReads.clear();
}

/** Seed the shared cache (fixture previews and tests); surfaces update immediately. */
export function primeAnchorChart(anchorId: string, value: ChartForAnchor): void {
  publish(anchorId, value);
}

export function peekAnchorChart(anchorId: string): ChartForAnchor | null {
  return memory.get(cacheKey(anchorId)) ?? null;
}

async function readPersisted(anchorId: string, accountId: string | null): Promise<ChartForAnchor | null> {
  if (!accountId) return null;
  const key = cacheKey(anchorId, accountId);
  const existing = persistedReads.get(key);
  if (existing) return existing;
  const request = (async () => {
  try {
    const raw = await encryptedPersistStorage.getItem(storageKey(anchorId, accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChartForAnchor;
    return parsed && typeof parsed === 'object' && parsed.anchor?.id === anchorId ? parsed : null;
  } catch {
    return null;
  }
  })();
  persistedReads.set(key, request);
  void request.finally(() => {
    if (persistedReads.get(key) === request) persistedReads.delete(key);
  });
  return request;
}

/** Fetch (deduplicated) and publish. Throws a classified ChartRequestError. */
export function loadAnchorChart(anchorId: string, accountId = currentAccountId()): Promise<ChartForAnchor> {
  const key = cacheKey(anchorId, accountId);
  const existing = inflight.get(key);
  if (existing) return existing;
  const span = HomeStartupProfiler.start('chart_request', { anchorId });
  const request = chartV2Api
    .getForAnchor(anchorId)
    .then((value) => {
      span({ ok: true });
      publish(anchorId, value, accountId);
      return value;
    }, (error: unknown) => {
      span({ ok: false });
      throw error;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

export function trackChart(event: string, properties: Record<string, string | number | boolean | null> = {}): void {
  // Ids, counts and enums only — never intention, route or reflection text.
  try {
    AnalyticsService.track(event, properties);
  } catch {
    /* analytics must never break the Chart */
  }
}

export type WaypointReachResult = {
  completedTitle: string;
  nextTitle: string | null;
  destinationReached: boolean;
  chart: CourseDetail;
};

export type UseAnchorChartResult = {
  data: ChartForAnchor | null;
  view: ChartViewModel | null;
  loading: boolean;
  /** Showing a locally saved copy because the server could not be reached. */
  stale: boolean;
  error: ChartRequestError | null;
  refresh: () => Promise<void>;
  /** Replace the cached Chart (after creation or an applied adjustment). */
  commitChart: (chart: CourseDetail) => void;
  busy: string | null;
  completeMove: (moveId: string) => Promise<boolean>;
  addMove: (waypointId: string, title: string, options?: { makeCurrent?: boolean }) => Promise<boolean>;
  acceptMove: (moveId: string, options?: { makeCurrent?: boolean }) => Promise<boolean>;
  /** Make an existing ACTIVE Move the One Move. */
  setCurrentMove: (moveId: string) => Promise<boolean>;
  editMove: (moveId: string, title: string) => Promise<boolean>;
  dismissMove: (moveId: string) => Promise<boolean>;
  suggestMoves: (waypointId: string) => Promise<'ok' | 'unavailable' | 'failed'>;
  updateProgress: (waypointId: string, value: number | null) => Promise<boolean>;
  reachWaypoint: (waypointId: string) => Promise<WaypointReachResult | null>;
  editWaypoint: (waypointId: string, input: Omit<RouteWaypointInput, 'id'>) => Promise<boolean>;
  addWaypoint: (input: Omit<RouteWaypointInput, 'id'>, afterWaypointId?: string | null) => Promise<boolean>;
  removeWaypoint: (waypointId: string) => Promise<boolean>;
  reorderWaypoints: (orderedIds: string[]) => Promise<boolean>;
  lastError: ChartRequestError | null;
  clearLastError: () => void;
};

export function useAnchorChart(anchorId: string | null | undefined): UseAnchorChartResult {
  const id = anchorId ?? '';
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const scope = cacheKey(id, accountId);
  const [data, setData] = useState<ChartForAnchor | null>(() => (id ? memory.get(scope) ?? null : null));
  const [loading, setLoading] = useState<boolean>(() => Boolean(id) && !memory.has(scope));
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<ChartRequestError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ChartRequestError | null>(null);
  const locks = useRef(new Set<string>());
  const mounted = useRef(true);
  const currentScope = useRef(scope);

  if (currentScope.current !== scope) {
    currentScope.current = scope;
    setData(id ? memory.get(scope) ?? null : null);
    setLoading(Boolean(id) && !memory.has(scope));
    setStale(false);
    setError(null);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return undefined;
    const set = listeners.get(scope) ?? new Set();
    const listener = (value: ChartForAnchor) => {
      if (mounted.current && currentScope.current === scope) setData(value);
    };
    set.add(listener);
    listeners.set(scope, set);
    return () => {
      set.delete(listener);
    };
  }, [id, scope]);

  const refresh = useCallback(async () => {
    if (!id) return;
    if (!memory.has(scope)) setLoading(true);
    setError(null);
    // Disk and network reads overlap. If a local Chart copy exists, expose it
    // as stale presentation data while the server remains the authority.
    const persistedRead = memory.has(scope) ? Promise.resolve(null) : readPersisted(id, accountId);
    const serverRead = loadAnchorChart(id, accountId);
    void persistedRead.then((cached) => {
      if (!cached || memory.has(scope) || !mounted.current || currentScope.current !== scope) return;
      memory.set(scope, cached);
      listeners.get(scope)?.forEach((listener) => listener(cached));
      setData(cached);
      setStale(true);
      setLoading(false);
    });
    try {
      const value = await serverRead;
      if (!mounted.current || currentScope.current !== scope) return;
      setData(value);
      setStale(false);
    } catch (caught) {
      const classified = classifyChartError(caught);
      if (!mounted.current || currentScope.current !== scope) return;
      const cached = memory.get(scope) ?? (await persistedRead);
      if (cached && (classified.kind === 'offline' || classified.kind === 'unavailable')) {
        memory.set(scope, cached);
        setData(cached);
        setStale(true);
      } else {
        setError(classified);
      }
    } finally {
      if (mounted.current && currentScope.current === scope) setLoading(false);
    }
  }, [accountId, id, scope]);

  useEffect(() => {
    setData(id ? memory.get(scope) ?? null : null);
    setStale(false);
    void refresh();
  }, [id, refresh, scope]);

  const commitChart = useCallback(
    (chart: CourseDetail) => {
      if (!id) return;
      const previous = memory.get(scope);
      if (previous) publishChart(id, chart, accountId);
      else void refresh();
    },
    [accountId, id, refresh, scope]
  );

  /**
   * Runs one mutation at a time per action key. A second tap while the first
   * is in flight is ignored; the server's idempotency covers retries.
   */
  const run = useCallback(
    async <T,>(lockKey: string, work: () => Promise<T>): Promise<T | null> => {
      if (locks.current.has(lockKey)) return null;
      locks.current.add(lockKey);
      setBusy(lockKey);
      try {
        return await work();
      } catch (caught) {
        const classified = classifyChartError(caught);
        if (mounted.current) setLastError(classified);
        // A version conflict means another device moved first: take the server's truth.
        if (classified.kind === 'conflict') void refresh();
        return null;
      } finally {
        locks.current.delete(lockKey);
        if (mounted.current) setBusy((current) => (current === lockKey ? null : current));
      }
    },
    [refresh]
  );

  const chart = data?.chart ?? null;

  const completeMove = useCallback(
    async (moveId: string) => {
      if (!chart) return false;
      const result = await run(`move:${moveId}`, () => chartV2Api.completeMove(chart.id, moveId));
      if (!result) return false;
      const move = chart.moves?.find((m) => m.id === moveId);
      void recordCourseEvent(chart.id, {
        courseId: chart.id,
        type: 'MOVE_COMPLETED',
        timestamp: new Date().toISOString(),
        payload: { moveTitle: move?.title ?? 'Completed move' },
      });
      publishChart(id, result.chart, accountId);
      if (!result.replayed) trackChart('chart_move_completed', { courseId: chart.id, hasNextMove: Boolean(result.nextMoveId) });
      return true;
    },
    [accountId, chart, id, run]
  );

  const addMove = useCallback(
    async (waypointId: string, title: string, options?: { makeCurrent?: boolean }) => {
      if (!chart || !title.trim()) return false;
      const key = freshKey(`move-add:${waypointId}`);
      const result = await run(`move-add:${waypointId}`, () =>
        chartV2Api.addMove(chart.id, { idempotencyKey: key, waypointId, title: title.trim(), makeCurrent: options?.makeCurrent })
      );
      if (!result) return false;
      publishChart(id, result, accountId);
      trackChart('chart_move_created', { courseId: chart.id, source: 'user' });
      return true;
    },
    [accountId, chart, id, run]
  );

  const acceptMove = useCallback(
    async (moveId: string, options?: { makeCurrent?: boolean }) => {
      if (!chart) return false;
      const result = await run(`move-accept:${moveId}`, () =>
        chartV2Api.updateMove(chart.id, moveId, { accept: true, makeCurrent: options?.makeCurrent })
      );
      if (!result) return false;
      publishChart(id, result, accountId);
      trackChart('chart_move_created', { courseId: chart.id, source: 'suggestion' });
      return true;
    },
    [accountId, chart, id, run]
  );

  const setCurrentMove = useCallback(
    async (moveId: string) => {
      if (!chart) return false;
      const result = await run(`move-current:${moveId}`, () => chartV2Api.updateMove(chart.id, moveId, { makeCurrent: true }));
      if (!result) return false;
      publishChart(id, result, accountId);
      return true;
    },
    [accountId, chart, id, run]
  );

  const editMove = useCallback(
    async (moveId: string, title: string) => {
      if (!chart || !title.trim()) return false;
      const result = await run(`move-edit:${moveId}`, () => chartV2Api.updateMove(chart.id, moveId, { title: title.trim() }));
      if (!result) return false;
      publishChart(id, result, accountId);
      return true;
    },
    [accountId, chart, id, run]
  );

  const dismissMove = useCallback(
    async (moveId: string) => {
      if (!chart) return false;
      const result = await run(`move-dismiss:${moveId}`, () => chartV2Api.dismissMove(chart.id, moveId));
      if (!result) return false;
      publishChart(id, result, accountId);
      return true;
    },
    [accountId, chart, id, run]
  );

  const suggestMoves = useCallback(
    async (waypointId: string): Promise<'ok' | 'unavailable' | 'failed'> => {
      if (!chart) return 'failed';
      const result = await run(`suggest:${waypointId}`, () => chartV2Api.suggestMoves(chart.id, waypointId));
      if (!result) return 'failed';
      if (!result.available || !result.chart) return 'unavailable';
      publishChart(id, result.chart, accountId);
      return 'ok';
    },
    [accountId, chart, id, run]
  );

  const updateProgress = useCallback(
    async (waypointId: string, value: number | null) => {
      if (!chart) return false;
      const wp = chart.waypoints?.find((w) => w.id === waypointId);
      const prevVal = wp?.metric?.current ?? wp?.metric?.baseline ?? 0;
      const unit = wp?.metric?.label ?? 'active users';
      const result = await run(`progress:${waypointId}`, () =>
        chartV2Api.updateProgress(chart.id, waypointId, { expectedCourseVersion: chart.version, metricCurrent: value })
      );
      if (!result) return false;
      if (value != null && value !== prevVal) {
        void recordCourseEvent(chart.id, {
          courseId: chart.id,
          type: 'PROGRESS_UPDATED',
          timestamp: new Date().toISOString(),
          payload: {
            from: prevVal,
            to: value,
            unit,
            delta: value - prevVal,
          },
        });
      }
      publishChart(id, result, accountId);
      return true;
    },
    [accountId, chart, id, run]
  );

  const reachWaypoint = useCallback(
    async (waypointId: string): Promise<WaypointReachResult | null> => {
      if (!chart) return null;
      // Stable key per waypoint and route version: a retried or doubled tap is one server write.
      const key = chartActionKey('reach', chart.id, waypointId, String(chart.version));
      const result = await run(`reach:${waypointId}`, async () => {
        const response = await chartApiClient.completeWaypoint(chart.id, waypointId, {
          idempotencyKey: key,
          expectedCourseVersion: chart.version,
        });
        const detail = await chartApiClient.getCourse(chart.id);
        return { response: response.data, detail: detail.data };
      });
      if (!result) return null;
      publishChart(id, result.detail, accountId);
      const destinationReached = result.response.courseCompleted;
      trackChart(destinationReached ? 'chart_destination_reached' : 'chart_waypoint_completed', {
        courseId: chart.id,
        replayed: result.response.replayed,
      });
      return {
        completedTitle: result.response.completedWaypoint.title,
        nextTitle: result.response.nextWaypoint?.title ?? null,
        destinationReached,
        chart: result.detail,
      };
    },
    [accountId, chart, id, run]
  );

  const editWaypoint = useCallback(
    async (waypointId: string, input: Omit<RouteWaypointInput, 'id'>) => {
      if (!chart) return false;
      const result = await run(`wp-edit:${waypointId}`, () =>
        chartApiClient.editWaypoint(chart.id, waypointId, {
          expectedCourseVersion: chart.version,
          title: input.title,
          description: input.rationale ?? null,
          ...(input.metricTarget !== undefined
            ? { kind: input.kind, metricLabel: input.metricLabel ?? null, metricTarget: input.metricTarget, metricBaseline: input.metricBaseline ?? null }
            : {}),
        })
      );
      if (!result) return false;
      publishChart(id, result.data, accountId);
      trackChart('chart_waypoint_edited', { courseId: chart.id });
      return true;
    },
    [accountId, chart, id, run]
  );

  const addWaypoint = useCallback(
    async (input: Omit<RouteWaypointInput, 'id'>, afterWaypointId?: string | null) => {
      if (!chart || !input.title.trim()) return false;
      const key = freshKey('wp-add');
      const result = await run('wp-add', () =>
        chartApiClient.addWaypoint(chart.id, {
          idempotencyKey: key,
          expectedCourseVersion: chart.version,
          title: input.title.trim(),
          description: input.rationale ?? undefined,
          afterWaypointId: afterWaypointId ?? null,
          ...(typeof input.metricTarget === 'number'
            ? { kind: 'METRIC' as const, metricLabel: input.metricLabel ?? null, metricTarget: input.metricTarget }
            : {}),
        })
      );
      if (!result) return false;
      publishChart(id, result.data, accountId);
      trackChart('chart_waypoint_added', { courseId: chart.id });
      return true;
    },
    [accountId, chart, id, run]
  );

  const removeWaypoint = useCallback(
    async (waypointId: string) => {
      if (!chart) return false;
      const key = chartActionKey('wp-cancel', waypointId);
      const result = await run(`wp-cancel:${waypointId}`, () =>
        chartApiClient.cancelWaypoint(chart.id, waypointId, { idempotencyKey: key, expectedCourseVersion: chart.version })
      );
      if (!result) return false;
      publishChart(id, result.data, accountId);
      return true;
    },
    [accountId, chart, id, run]
  );

  const reorderWaypoints = useCallback(
    async (orderedIds: string[]) => {
      if (!chart) return false;
      const result = await run('wp-reorder', () =>
        chartApiClient.reorderWaypoints(chart.id, { expectedCourseVersion: chart.version, orderedWaypointIds: orderedIds })
      );
      if (!result) return false;
      publishChart(id, result.data, accountId);
      return true;
    },
    [accountId, chart, id, run]
  );

  const view = useMemo(() => (chart ? toChartViewModel(chart, data?.stats) : null), [chart, data?.stats]);

  return {
    data,
    view,
    loading,
    stale,
    error,
    refresh,
    commitChart,
    busy,
    completeMove,
    addMove,
    acceptMove,
    setCurrentMove,
    editMove,
    dismissMove,
    suggestMoves,
    updateProgress,
    reachWaypoint,
    editWaypoint,
    addWaypoint,
    removeWaypoint,
    reorderWaypoints,
    lastError,
    clearLastError: () => setLastError(null),
  };
}
