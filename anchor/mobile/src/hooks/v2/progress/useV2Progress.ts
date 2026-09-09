import { useState, useCallback, useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCourseLogStore } from '@/stores/courseLogStore';
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

  const courseLogEntries = useCourseLogStore((s) => s.entries);
  const refreshCourseLogs = useCourseLogStore((s) => s.refresh);
  const courseLogLoading = useCourseLogStore((s) => s.loading);

  const sessionLog = useSessionStore((s) => s.sessionLog);

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

  // Compute V2ProgressModel
  const model = useMemo(() => {
    return toV2ProgressModel(targetAnchor, courseLogEntries, sessionLog);
  }, [targetAnchor, courseLogEntries, sessionLog]);

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
