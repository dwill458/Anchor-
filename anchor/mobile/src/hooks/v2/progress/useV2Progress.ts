import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useAnchorCourseLog } from '@/hooks/v2/chart/useAnchorCourseLog';
import { useCourseStore } from '@/stores/courseStore';
import { useSessionStore } from '@/stores/sessionStore';
import { buildProgressReflections, toV2ProgressModel } from '@/adapters/v2/progress/progressAdapter';
import type {
  V2ProgressAnchorOption,
  V2ProgressModel,
  V2ProgressRange,
  V2ThreadEventItem,
} from '@/adapters/v2/progress/types';

export interface UseV2ProgressOptions {
  anchorId?: string;
}

export interface UseV2ProgressReturn {
  model: V2ProgressModel | null;
  loading: boolean;
  error: string | null;
  selectedEvent: V2ThreadEventItem | null;
  setSelectedEvent: (event: V2ThreadEventItem | null) => void;
  refresh: () => Promise<void>;
  /** Rhythm range. Defaults to Month. */
  range: V2ProgressRange;
  setRange: (range: V2ProgressRange) => void;
  /** Non-archived Anchors for the switcher. */
  anchors: V2ProgressAnchorOption[];
  /** Views another Anchor's progress. Local to this screen; never changes the app's current Anchor. */
  selectAnchor: (anchorId: string) => void;
}

export function useV2Progress(options: UseV2ProgressOptions = {}): UseV2ProgressReturn {
  const [selectedEvent, setSelectedEvent] = useState<V2ThreadEventItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [range, setRange] = useState<V2ProgressRange>('Month');
  const [pickedAnchorId, setPickedAnchorId] = useState<string | null>(null);

  const anchors = useAnchorStore((s) => s.anchors);
  const currentAnchorId = useAnchorStore((s) => s.currentAnchorId);
  const anchorStoreLoading = useAnchorStore((s) => s.isLoading);
  const anchorStoreError = useAnchorStore((s) => s.error);

  const practiceHistory = useSessionStore((s) => s.practiceHistory);
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const weekHistory = useSessionStore((s) => s.weekHistory);
  const weekHistoryKey = useSessionStore((s) => s.weekHistoryKey);
  const lastGraceDayUsedAt = useSessionStore((s) => s.lastGraceDayUsedAt);
  const lastPrimedAt = useSessionStore((s) => s.lastPrimedAt);
  const lifetimeSessions = useSessionStore((s) => s.totalSessionsCount);
  const chartReflectionsEnabled = useCourseStore((s) => s.flags.chart_reflections_enabled);
  const sessions = useMemo(() => {
    if (Array.isArray(practiceHistory) && practiceHistory.length > 0) return practiceHistory;
    return sessionLog ?? [];
  }, [practiceHistory, sessionLog]);

  // A new route param (a different Anchor opened) overrides an earlier pick.
  useEffect(() => {
    setPickedAnchorId(null);
  }, [options.anchorId]);

  // Resolve target Anchor
  const targetId = pickedAnchorId || options.anchorId || currentAnchorId;
  const targetAnchor = useMemo(() => {
    if (targetId) {
      const found = anchors.find((a) => a.id === targetId);
      if (found) return found;
    }
    // Fallback to first non-archived anchor
    return anchors.find((a) => !a.archivedAt && !(a as any).isArchived) || anchors[0] || null;
  }, [anchors, targetId]);

  const anchorOptions = useMemo<V2ProgressAnchorOption[]>(
    () =>
      anchors
        .filter((a) => !a.archivedAt && !(a as any).isArchived)
        .map((a) => ({
          id: a.id,
          category: a.category ?? null,
          intention: (a as any).intention || a.intentionText || 'Your Anchor',
          anchor: a,
        })),
    [anchors],
  );

  // Chart evidence for this Anchor only (its live route and earlier routes).
  const courseLog = useAnchorCourseLog(targetAnchor?.id ?? null);
  const courseLogEntries = courseLog.entries;
  const refreshCourseLogs = courseLog.refresh;
  const courseLogLoading = courseLog.loading;
  const course = useAnchorChart(targetAnchor?.id ?? null).data?.chart ?? null;

  // Compute V2ProgressModel
  const model = useMemo(() => {
    const anchorIds = targetAnchor
      ? [targetAnchor.id, targetAnchor.localId].filter((id): id is string => Boolean(id))
      : [];
    const { items: reflections } = buildProgressReflections({
      courseLogs: courseLogEntries,
      sessionLog: sessionLog ?? [],
      anchorIds,
      chartReflectionsEnabled: Boolean(chartReflectionsEnabled),
    });
    return toV2ProgressModel(targetAnchor, courseLogEntries, sessions, {
      weekHistory,
      weekHistoryKey,
      lastGraceDayUsedAt,
      lastPrimedAt,
      lifetimeSessions,
      course,
      reflections,
    });
  }, [
    targetAnchor,
    courseLogEntries,
    sessions,
    sessionLog,
    weekHistory,
    weekHistoryKey,
    lastGraceDayUsedAt,
    lastPrimedAt,
    lifetimeSessions,
    course,
    chartReflectionsEnabled,
  ]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshCourseLogs?.();
    } catch {
      // Non-blocking refresh error
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCourseLogs]);

  const loading = (anchorStoreLoading || courseLogLoading || isRefreshing) && !model;
  const error = anchorStoreError || null;

  return {
    model,
    loading,
    error,
    selectedEvent,
    setSelectedEvent,
    refresh,
    range,
    setRange,
    anchors: anchorOptions,
    selectAnchor: setPickedAnchorId,
  };
}
