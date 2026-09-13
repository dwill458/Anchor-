import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCourseStore } from '@/stores/courseStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCourseLogStore } from '@/stores/courseLogStore';
import { useV2Vision } from '@/hooks/v2/vision';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { chartApiClient } from '@/services/ChartApiClient';
import {
  toV2ChartPresentationState,
  type ChartRouteTemplate,
  type V2ChartPresentationState,
  type V2WaypointMove,
  type V2WaypointPresentation,
} from '@/adapters/v2/chart';
import type { CourseDetail } from '@/types/chart';
import type { Anchor } from '@/types';

export interface UseV2ChartResult {
  chart: V2ChartPresentationState | null;
  activeCourse: CourseDetail | null;
  activeAnchor: Anchor | null;
  loading: boolean;
  error: string | null;
  isReaching: boolean;
  template: ChartRouteTemplate;
  connectedVisionId: string | null;
  isOffline: boolean;
  setTemplate: (tmpl: ChartRouteTemplate) => void;
  setConnectedVisionId: (id: string | null) => void;
  completeOneMove: (waypointId: string, moveId: string) => Promise<void>;
  uncompleteOneMove: (waypointId: string, moveId: string) => Promise<void>;
  addMove: (waypointId: string, text: string) => Promise<void>;
  reachWaypoint: (waypointId: string) => Promise<{ success: boolean; isDestination: boolean }>;
  reorderWaypoints: (fromIndex: number, toIndex: number) => Promise<boolean>;
  updateWaypointTitle: (waypointId: string, title: string) => Promise<boolean>;
  addNewWaypoint: (title: string, description?: string) => Promise<boolean>;
  deleteWaypoint: (waypointId: string) => Promise<boolean>;
  createChart: (
    destinationText: string,
    waypoints?: Array<{ title: string; description?: string }>,
  ) => Promise<CourseDetail | null>;
  refresh: () => Promise<void>;
}

export function useV2Chart(courseIdProp?: string, anchorIdProp?: string): UseV2ChartResult {
  const activeCourseFromStore = useCourseStore((s) => s.activeCourse);
  const fetchCourseDetail = useCourseStore((s) => s.fetchCourseDetail);
  const editWaypointInStore = useCourseStore((s) => s.editWaypoint);
  const reorderWaypointsInStore = useCourseStore((s) => s.reorderWaypoints);
  const addWaypointInStore = useCourseStore((s) => s.addWaypoint);
  const completeWaypointInStore = useCourseStore((s) => s.completeWaypoint);
  const createManualCourseInStore = useCourseStore((s) => s.createManualCourse);
  const publishCourseInStore = useCourseStore((s) => s.publishCourse);
  const linkAnchorInStore = useCourseStore((s) => s.linkAnchor);
  const refreshCourseStore = useCourseStore((s) => s.refresh);
  const isStoreOffline = useCourseStore((s) => s.offline);

  // Active anchor from anchor store
  const activeAnchor = useAnchorStore((s) => {
    if (anchorIdProp) {
      return s.anchors.find((a) => a.id === anchorIdProp || a.localId === anchorIdProp) ?? null;
    }
    const destAnchorId = activeCourseFromStore?.destinationAnchorLink?.anchorId;
    if (destAnchorId) {
      return s.anchors.find((a) => a.id === destAnchorId || a.localId === destAnchorId) ?? null;
    }
    return s.getActiveAnchors()[0] ?? null;
  });

  const resolvedAnchorId = activeAnchor?.id ?? '';
  const { vision, tiles } = useV2Vision(resolvedAnchorId);

  const [course, setCourse] = useState<CourseDetail | null>(activeCourseFromStore);
  const [loading, setLoading] = useState<boolean>(Boolean(courseIdProp && !activeCourseFromStore));
  const [error, setError] = useState<string | null>(null);
  const [isReaching, setIsReaching] = useState<boolean>(false);
  const [template, setTemplateState] = useState<ChartRouteTemplate>('gentle-s');
  const [connectedVisionId, setConnectedVisionIdState] = useState<string | null>(null);
  const [customMoves, setCustomMoves] = useState<Record<string, V2WaypointMove[]>>({});

  const reachLockRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const targetCourseId = courseIdProp ?? activeCourseFromStore?.id ?? '';

  // Synchronize with active course from store
  useEffect(() => {
    if (activeCourseFromStore && (!courseIdProp || activeCourseFromStore.id === courseIdProp)) {
      setCourse(activeCourseFromStore);
      setLoading(false);
    }
  }, [activeCourseFromStore, courseIdProp]);

  // Load custom moves and preferences from encrypted storage whenever course changes
  useEffect(() => {
    if (!course?.id) return;
    const movesKey = `anchor:v2:chart:moves:${course.id}`;
    const tmplKey = `anchor:v2:chart:template:${course.id}`;
    const visionKey = `anchor:v2:chart:vision:${course.id}`;

    async function hydrateStorage() {
      try {
        const [savedMovesRaw, savedTmplRaw, savedVisionRaw] = await Promise.all([
          encryptedPersistStorage.getItem(movesKey),
          encryptedPersistStorage.getItem(tmplKey),
          encryptedPersistStorage.getItem(visionKey),
        ]);
        if (!isMountedRef.current) return;

        if (savedMovesRaw) {
          const parsed = JSON.parse(savedMovesRaw);
          if (parsed && typeof parsed === 'object') {
            setCustomMoves(parsed);
          }
        }
        if (savedTmplRaw && ['gentle-s', 'wide-zigzag', 'rising-arc', 'double-bend'].includes(savedTmplRaw)) {
          setTemplateState(savedTmplRaw as ChartRouteTemplate);
        }
        if (savedVisionRaw !== null && savedVisionRaw !== undefined) {
          setConnectedVisionIdState(savedVisionRaw.length > 0 ? savedVisionRaw : null);
        } else if (vision) {
          // If vision exists for anchor, default to connected
          setConnectedVisionIdState(vision.id);
        }
      } catch {
        /* storage errors are non-blocking */
      }
    }

    void hydrateStorage();
  }, [course?.id, vision]);

  const loadCourse = useCallback(async () => {
    if (!targetCourseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchCourseDetail(targetCourseId);
      if (fetched && isMountedRef.current) {
        setCourse(fetched);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Unable to load course';
      setError(msg);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [targetCourseId, fetchCourseDetail]);

  useEffect(() => {
    if (!course && targetCourseId) {
      loadCourse();
    }
  }, [course, targetCourseId, loadCourse]);

  const setTemplate = useCallback((tmpl: ChartRouteTemplate) => {
    setTemplateState(tmpl);
    if (course?.id) {
      const tmplKey = `anchor:v2:chart:template:${course.id}`;
      void encryptedPersistStorage.setItem(tmplKey, tmpl);
    }
  }, [course?.id]);

  const setConnectedVisionId = useCallback((id: string | null) => {
    setConnectedVisionIdState(id);
    if (course?.id) {
      const visionKey = `anchor:v2:chart:vision:${course.id}`;
      void encryptedPersistStorage.setItem(visionKey, id ?? '');
    }
  }, [course?.id]);

  const completeOneMove = useCallback(
    async (waypointId: string, moveId: string) => {
      let updatedForPersistence: Record<string, V2WaypointMove[]> = {};
      setCustomMoves((prev) => {
        const existing = prev[waypointId] || [];
        const updated = existing.map((m) => (m.id === moveId ? { ...m, done: true } : m));
        updatedForPersistence = { ...prev, [waypointId]: updated };
        return updatedForPersistence;
      });

      if (course?.id) {
        const movesKey = `anchor:v2:chart:moves:${course.id}`;
        await encryptedPersistStorage.setItem(movesKey, JSON.stringify(updatedForPersistence));
      }
    },
    [course?.id],
  );

  const uncompleteOneMove = useCallback(
    async (waypointId: string, moveId: string) => {
      let updatedForPersistence: Record<string, V2WaypointMove[]> = {};
      setCustomMoves((prev) => {
        const existing = prev[waypointId] || [];
        const updated = existing.map((m) => (m.id === moveId ? { ...m, done: false } : m));
        updatedForPersistence = { ...prev, [waypointId]: updated };
        return updatedForPersistence;
      });

      if (course?.id) {
        const movesKey = `anchor:v2:chart:moves:${course.id}`;
        await encryptedPersistStorage.setItem(movesKey, JSON.stringify(updatedForPersistence));
      }
    },
    [course?.id],
  );

  const addMove = useCallback(
    async (waypointId: string, text: string) => {
      if (!text.trim()) return;
      let updatedForPersistence: Record<string, V2WaypointMove[]> = {};
      const newMove: V2WaypointMove = {
        id: `${waypointId}-m-${Date.now()}`,
        waypointId,
        text: text.trim(),
        done: false,
      };

      setCustomMoves((prev) => {
        const existing = prev[waypointId] || [];
        const updated = [...existing, newMove];
        updatedForPersistence = { ...prev, [waypointId]: updated };
        return updatedForPersistence;
      });

      if (course?.id) {
        const movesKey = `anchor:v2:chart:moves:${course.id}`;
        await encryptedPersistStorage.setItem(movesKey, JSON.stringify(updatedForPersistence));
      }
    },
    [course?.id],
  );

  /**
   * Reaches the waypoint via the authoritative backend CourseService endpoint.
   * Prevents duplicate in-flight calls and updates authoritative Course.currentWaypointId.
   */
  const reachWaypoint = useCallback(
    async (waypointId: string): Promise<{ success: boolean; isDestination: boolean }> => {
      if (!course || reachLockRef.current) {
        return { success: false, isDestination: false };
      }
      reachLockRef.current = true;
      setIsReaching(true);

      const isDestination =
        course.waypoints[course.waypoints.length - 1]?.id === waypointId;
      const idempotencyKey = `reach-${waypointId}-${Date.now()}`;

      try {
        const result = await completeWaypointInStore(course.id, waypointId, {
          idempotencyKey,
          expectedCourseVersion: course.version,
        });

        if (result) {
          setCourse((prev) => {
            if (!prev) return null;
            const updatedWaypoints = prev.waypoints.map((w) => {
              if (w.id === waypointId)
                return result.completedWaypoint ?? { ...w, state: 'REACHED' as const };
              if (result.nextWaypoint && w.id === result.nextWaypoint.id)
                return result.nextWaypoint;
              return w;
            });
            const courseData = result.course ?? {};
            return {
              ...prev,
              ...courseData,
              currentWaypointId: result.nextWaypoint?.id ?? null,
              status: result.courseCompleted ? 'COMPLETED' : prev.status,
              reachedCount: courseData.reachedCount ?? prev.reachedCount + 1,
              version: courseData.version ?? prev.version + 1,
              waypoints: updatedWaypoints,
            };
          });

          return { success: true, isDestination: Boolean(result.courseCompleted || isDestination) };
        }
        return { success: false, isDestination: false };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reach waypoint';
        setError(msg);
        return { success: false, isDestination: false };
      } finally {
        reachLockRef.current = false;
        setIsReaching(false);
      }
    },
    [course, completeWaypointInStore, refreshCourseStore],
  );

  const reorderWaypoints = useCallback(
    async (fromIndex: number, toIndex: number): Promise<boolean> => {
      if (!course) return false;
      const sorted = [...course.waypoints].sort((a, b) => a.position - b.position);
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= sorted.length || toIndex >= sorted.length) {
        return false;
      }
      // Domain rule: cannot swap reached with upcoming or destination
      const fromWp = sorted[fromIndex];
      const toWp = sorted[toIndex];
      if (fromWp.reachedAt !== null || toWp.reachedAt !== null) {
        return false;
      }
      if (fromIndex === sorted.length - 1 || toIndex === sorted.length - 1) {
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
        if (updated && isMountedRef.current) {
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
        if (updated && isMountedRef.current) {
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
      if (!course || !title.trim() || course.waypoints.length >= 7) return false;
      try {
        const updated = await addWaypointInStore(course.id, {
          idempotencyKey: `add-wp-${Date.now()}`,
          expectedCourseVersion: course.version,
          title: title.trim(),
          description,
        });
        if (updated && isMountedRef.current) {
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

  const deleteWaypoint = useCallback(
    async (waypointId: string): Promise<boolean> => {
      if (!course || course.waypoints.length <= 2) return false;
      const wp = course.waypoints.find((w) => w.id === waypointId);
      if (!wp || wp.reachedAt !== null || wp.id === course.currentWaypointId) return false;

      try {
        const result = await chartApiClient.cancelWaypoint(course.id, waypointId, {
          idempotencyKey: `cancel-wp-${waypointId}-${Date.now()}`,
          expectedCourseVersion: course.version,
        });
        if (result.data && isMountedRef.current) {
          setCourse(result.data);
          await refreshCourseStore();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [course, refreshCourseStore],
  );

  const createChart = useCallback(
    async (
      destinationText: string,
      initialWaypoints?: Array<{ title: string; description?: string }>,
    ): Promise<CourseDetail | null> => {
      const destination = destinationText.trim();
      if (!destination) return null;

      setLoading(true);
      setError(null);
      try {
        const idempotencyKey = `create-course-${Date.now()}`;
        const waypoints = initialWaypoints ?? [
          { title: 'First Milestone', description: 'Take the first concrete step.' },
          { title: 'Second Milestone', description: 'Build momentum.' },
          { title: destination, description: 'Reach your ultimate destination.' },
        ];

        const created = await createManualCourseInStore({
          idempotencyKey,
          destinationText: destination,
          waypoints,
        });

        if (!created) {
          setError('Failed to create Chart');
          return null;
        }

        const published = await publishCourseInStore(created.id, created.version);
        const finalCourse = published ?? created;

        if (activeAnchor) {
          try {
            await linkAnchorInStore(finalCourse.id, {
              idempotencyKey: `link-dest-${Date.now()}`,
              expectedCourseVersion: finalCourse.version,
              anchorId: activeAnchor.id,
              role: 'DESTINATION',
            });
          } catch {
            /* anchor linking is optional */
          }
        }

        if (isMountedRef.current) {
          setCourse(finalCourse);
        }
        await refreshCourseStore();
        return finalCourse;
      } catch (err: unknown) {
        if (!isMountedRef.current) return null;
        const msg = err instanceof Error ? err.message : 'Failed to create Chart';
        setError(msg);
        return null;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [activeAnchor, createManualCourseInStore, publishCourseInStore, linkAnchorInStore, refreshCourseStore],
  );

  const visionAssetUrl =
    vision?.scenes?.[0]?.resolvedImageUrl ??
    tiles?.[0]?.imageUrl ??
    null;
  const visionTitle = vision?.title ?? 'Connected Vision';

  const chart = useMemo(() => {
    return toV2ChartPresentationState(course, {
      template,
      connectedVisionId,
      connectedVisionAssetUrl: visionAssetUrl,
      connectedVisionTitle: visionTitle,
      movesMap: customMoves,
    });
  }, [course, template, connectedVisionId, visionAssetUrl, visionTitle, customMoves]);

  return {
    chart,
    activeCourse: course,
    loading,
    error,
    isReaching,
    template,
    connectedVisionId,
    isOffline: isStoreOffline,
    setTemplate,
    setConnectedVisionId,
    completeOneMove,
    uncompleteOneMove,
    addMove,
    reachWaypoint,
    reorderWaypoints,
    updateWaypointTitle,
    addNewWaypoint,
    deleteWaypoint,
    createChart,
    activeAnchor,
    refresh: loadCourse,
  };
}
