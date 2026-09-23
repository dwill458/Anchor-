import { useState, useCallback, useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAnchorCourseLog } from '@/hooks/v2/chart/useAnchorCourseLog';
import { useSessionStore } from '@/stores/sessionStore';
import { toV2ProgressModel } from '@/adapters/v2/progress/progressAdapter';
import type { V2ProgressModel, V2ThreadEventItem } from '@/adapters/v2/progress/types';

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
}

export function useV2Progress(options: UseV2ProgressOptions = {}): UseV2ProgressReturn {
  const [selectedEvent, setSelectedEvent] = useState<V2ThreadEventItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const anchors = useAnchorStore((s) => s.anchors);
  const currentAnchorId = useAnchorStore((s) => s.currentAnchorId);
  const anchorStoreLoading = useAnchorStore((s) => s.isLoading);
  const anchorStoreError = useAnchorStore((s) => s.error);


  const practiceHistory = useSessionStore((s) => s.practiceHistory);
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const sessions = useMemo(() => {
    if (Array.isArray(practiceHistory) && practiceHistory.length > 0) return practiceHistory;
    return sessionLog ?? [];
  }, [practiceHistory, sessionLog]);

  // Resolve target Anchor
  const targetId = options.anchorId || currentAnchorId;
  const targetAnchor = useMemo(() => {
    if (targetId) {
      const found = anchors.find((a) => a.id === targetId);
      if (found) return found;
    }
    // Fallback to first non-archived anchor
    return anchors.find((a) => !a.archivedAt && !(a as any).isArchived) || anchors[0] || null;
  }, [anchors, targetId]);

  // Chart evidence for this Anchor only (its live route and earlier routes).
  const courseLog = useAnchorCourseLog(targetAnchor?.id ?? null);
  const courseLogEntries = courseLog.entries;
  const refreshCourseLogs = courseLog.refresh;
  const courseLogLoading = courseLog.loading;

  // Compute V2ProgressModel
  const model = useMemo(() => {
    return toV2ProgressModel(targetAnchor, courseLogEntries, sessions);
  }, [targetAnchor, courseLogEntries, sessions]);

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
  };
}
