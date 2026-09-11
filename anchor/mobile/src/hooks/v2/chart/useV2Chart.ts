import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCourseStore } from '@/stores/courseStore';
import { chartApiClient } from '@/services/ChartApiClient';
import { apiClient } from '@/services/ApiClient';
import {
  toV2ChartPresentationState,
  type ChartRouteTemplate,
  type V2ChartPresentationState,
  type V2WaypointMove,
  type V2WaypointPresentation,
} from '@/adapters/v2/chart';
import type { CourseDetail } from '@/types/chart';
import { resolveV2ChartCourse } from '@/adapters/v2/chart/anchorCourseResolver';

export interface UseV2ChartResult {
  chart: V2ChartPresentationState | null;
  activeCourse: CourseDetail | null;
  loading: boolean;
  error: string | null;
  isReaching: boolean;
  template: ChartRouteTemplate;
  connectedVisionId: string | null;
  setTemplate: (tmpl: ChartRouteTemplate) => void;
  setConnectedVisionId: (id: string | null) => void;
  completeOneMove: (waypointId: string, moveId: string) => void;
  addMove: (waypointId: string, text: string) => void;
  reachWaypoint: (waypointId: string) => Promise<{ success: boolean; isDestination: boolean }>;
  reorderWaypoints: (fromIndex: number, toIndex: number) => Promise<boolean>;
  updateWaypointTitle: (waypointId: string, title: string) => Promise<boolean>;
  addNewWaypoint: (title: string, description?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useV2Chart(courseIdProp?: string, anchorId?: string): UseV2ChartResult {
  const activeCourseFromStore = useCourseStore((s) => s.activeCourse);
  const fetchCourseDetail = useCourseStore((s) => s.fetchCourseDetail);
  const editWaypointInStore = useCourseStore((s) => s.editWaypoint);
  const reorderWaypointsInStore = useCourseStore((s) => s.reorderWaypoints);
  const addWaypointInStore = useCourseStore((s) => s.addWaypoint);
  const refreshCourseStore = useCourseStore((s) => s.refresh);

  const [course, setCourse] = useState<CourseDetail | null>(activeCourseFromStore);
  const [loading, setLoading] = useState<boolean>(!activeCourseFromStore);
  const [error, setError] = useState<string | null>(null);
  const [isReaching, setIsReaching] = useState<boolean>(false);
  const [template, setTemplate] = useState<ChartRouteTemplate>('gentle-s');
  const [connectedVisionId, setConnectedVisionId] = useState<string | null>(null);
  const [customMoves, setCustomMoves] = useState<Record<string, V2WaypointMove[]>>({});

  const reachLockRef = useRef<boolean>(false);

  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(null);
  const resolutionKey = useRef(`v2-chart:${anchorId ?? ''}`);
  const targetCourseId = courseIdProp ?? resolvedCourseId ?? activeCourseFromStore?.id ?? '';

  useEffect(() => {
    if (courseIdProp || !anchorId || resolvedCourseId) return;
    let active = true;
    setLoading(true);
    resolveV2ChartCourse(anchorId, resolutionKey.current)
      .then((courseId) => { if (active) setResolvedCourseId(courseId); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Unable to prepare Chart'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [anchorId, courseIdProp, resolvedCourseId]);

  useEffect(() => {
    if (activeCourseFromStore && (!courseIdProp || activeCourseFromStore.id === courseIdProp)) {
      setCourse(activeCourseFromStore);
      setLoading(false);
    }
  }, [activeCourseFromStore, courseIdProp]);

  const loadCourse = useCallback(async () => {
    if (!targetCourseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchCourseDetail(targetCourseId);
      if (fetched) {
        setCourse(fetched);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load course';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [targetCourseId, fetchCourseDetail]);

  useEffect(() => {
    if (!course && targetCourseId) {
      loadCourse();
    }
  }, [course, targetCourseId, loadCourse]);

  const completeOneMove = useCallback((waypointId: string, moveId: string) => {
    setCustomMoves((prev) => {
      const existing = prev[waypointId] || [];
      const updated = existing.map((m) => (m.id === moveId ? { ...m, done: true } : m));
      return { ...prev, [waypointId]: updated };
    });
  }, []);

  const addMove = useCallback((waypointId: string, text: string) => {
    if (!text.trim()) return;
    setCustomMoves((prev) => {
      const existing = prev[waypointId] || [];
      const newMove: V2WaypointMove = {
        id: `${waypointId}-m-${Date.now()}`,
        waypointId,
        text: text.trim(),
        done: false,
      };
      return { ...prev, [waypointId]: [...existing, newMove] };
    });
  }, []);

  /**
   * Reaches the waypoint via the authoritative backend CourseService endpoint.
   * Prevents duplicate in-flight calls.
   */
  const reachWaypoint = useCallback(
    async (waypointId: string): Promise<{ success: boolean; isDestination: boolean }> => {
      if (!course || reachLockRef.current) {
        return { success: false, isDestination: false };
      }
      reachLockRef.current = true;
      setIsReaching(true);

      const targetWp = course.waypoints.find((w) => w.id === waypointId);
      const isDestination =
        course.waypoints[course.waypoints.length - 1]?.id === waypointId;

      const idempotencyKey = `reach-${waypointId}-${Date.now()}`;

      try {
        await apiClient.post(
          `/api/courses/${encodeURIComponent(course.id)}/waypoints/${encodeURIComponent(waypointId)}/complete`,
          {
            idempotencyKey,
            expectedCourseVersion: course.version,
          },
        );

        // Optimistically update local course and refresh store
        setCourse((prev) => {
          if (!prev) return null;
          const updatedWaypoints = prev.waypoints.map((w) =>
            w.id === waypointId
              ? { ...w, reachedAt: new Date().toISOString(), state: 'REACHED' as const }
              : w,
          );
          return {
            ...prev,
            version: prev.version + 1,
            reachedCount: prev.reachedCount + 1,
            waypoints: updatedWaypoints,
          };
        });

        // Trigger store background refresh
        refreshCourseStore();

        return { success: true, isDestination };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reach waypoint';
        setError(msg);
        return { success: false, isDestination: false };
      } finally {
        reachLockRef.current = false;
        setIsReaching(false);
      }
    },
    [course, refreshCourseStore],
  );

  const reorderWaypoints = useCallback(
    async (fromIndex: number, toIndex: number): Promise<boolean> => {
      if (!course) return false;
      const sorted = [...course.waypoints].sort((a, b) => a.position - b.position);
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= sorted.length || toIndex >= sorted.length) {
        return false;
      }
      const moved = sorted[fromIndex];
      sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);

      const waypointIds = sorted.map((w) => w.id);
      try {
        const updated = await reorderWaypointsInStore(course.id, {
          expectedCourseVersion: course.version,
          orderedWaypointIds: waypointIds,
        });
        if (updated) {
          setCourse(updated);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [course, reorderWaypointsInStore],
  );

  const updateWaypointTitle = useCallback(
    async (waypointId: string, title: string): Promise<boolean> => {
      if (!course || !title.trim()) return false;
      try {
        const updated = await editWaypointInStore(course.id, waypointId, {
          expectedCourseVersion: course.version,
          title: title.trim(),
        });
        if (updated) {
          setCourse(updated);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [course, editWaypointInStore],
  );

  const addNewWaypoint = useCallback(
    async (title: string, description?: string): Promise<boolean> => {
      if (!course || !title.trim()) return false;
      try {
        const updated = await addWaypointInStore(course.id, {
          idempotencyKey: `add-wp-${Date.now()}`,
          expectedCourseVersion: course.version,
          title: title.trim(),
          description,
        });
        if (updated) {
          setCourse(updated);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [course, addWaypointInStore],
  );

  const chart = useMemo(() => {
    return toV2ChartPresentationState(course, {
      template,
      connectedVisionId,
      movesMap: customMoves,
    });
  }, [course, template, connectedVisionId, customMoves]);

  return {
    chart,
    activeCourse: course,
    loading,
    error,
    isReaching,
    template,
    connectedVisionId,
    setTemplate,
    setConnectedVisionId,
    completeOneMove,
    addMove,
    reachWaypoint,
    reorderWaypoints,
    updateWaypointTitle,
    addNewWaypoint,
    refresh: loadCourse,
  };
}
