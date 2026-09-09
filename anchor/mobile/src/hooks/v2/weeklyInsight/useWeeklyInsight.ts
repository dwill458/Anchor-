/**
 * React hook for Anchor 2.0 Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx.
 * Handles state for:
 * - Active Weekly Insight snapshot
 * - Review window state (Sunday 19:00 - Tuesday 12:00)
 * - First-week empty state detection
 * - Historical snapshot browsing without data leaks
 * - Feedback rating submission
 * - Detailed Activity disclosure toggle
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WeeklyInsightFeedbackRating } from '@/constants/v2/weeklyInsightRoutes';
import { useSessionStore } from '@/stores/sessionStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useCourseLogStore } from '@/stores/courseLogStore';
import { useCourseStore } from '@/stores/courseStore';
import {
  buildWeeklyInsightFacts,
  PROTOTYPE_ARCHIVE_ITEMS,
  PROTOTYPE_WEEKLY_INSIGHT_FIXTURES,
} from '@/adapters/v2/weeklyInsight/weeklyInsightFactsBuilder';
import { selectWeeklyInsight } from '@/adapters/v2/weeklyInsight/weeklyInsightSelector';
import { isWithinWeeklyInsightReviewWindow } from '@/adapters/v2/weeklyInsight/weeklyReviewWindow';
import type {
  WeeklyInsightFacts,
  WeeklyInsightHistoryItem,
  WeeklyInsightSnapshot,
} from '@/adapters/v2/weeklyInsight/types';

export interface UseWeeklyInsightOptions {
  anchorId?: string;
  snapshotId?: string;
  weekOffset?: number;
  factsOverride?: WeeklyInsightFacts;
  onFeedbackSubmit?: (snapshotId: string, rating: WeeklyInsightFeedbackRating) => void;
}

export interface UseWeeklyInsightResult {
  snapshot: WeeklyInsightSnapshot | null;
  facts: WeeklyInsightFacts | null;
  loading: boolean;
  error: string | null;
  isWithinReviewWindow: boolean;
  isFirstWeekEmpty: boolean;
  archiveItems: WeeklyInsightHistoryItem[];
  isActivityOpen: boolean;
  toggleActivity: () => void;
  isArchiveOpen: boolean;
  openArchive: () => void;
  closeArchive: () => void;
  selectSnapshot: (snapshotId: string) => void;
  submitFeedback: (rating: WeeklyInsightFeedbackRating) => void;
  feedbackSubmitted: WeeklyInsightFeedbackRating | null;
  refresh: () => Promise<void>;
}

export function useWeeklyInsight(options: UseWeeklyInsightOptions = {}): UseWeeklyInsightResult {
  const {
    anchorId,
    snapshotId: initialSnapshotId,
    weekOffset = 0,
    factsOverride,
    onFeedbackSubmit,
  } = options;

  const [loading, setLoading] = useState<boolean>(!factsOverride);
  const [error, setError] = useState<string | null>(null);
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(initialSnapshotId || null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<WeeklyInsightFeedbackRating | null>(null);

  // Store subscriptions (safely consumed)
  const sessions = useSessionStore((state) => state.practiceHistory || []);
  const anchors = useAnchorStore((state) => state.anchors || []);
  const courseLogs = useCourseLogStore((state) => state.entries || []);
  const activeCourse = useCourseStore((state) => state.activeCourse);

  const isWithinReviewWindow = useMemo(() => isWithinWeeklyInsightReviewWindow(), []);

  // Compute archive items (preserved snapshots)
  const archiveItems = useMemo<WeeklyInsightHistoryItem[]>(() => {
    return PROTOTYPE_ARCHIVE_ITEMS;
  }, []);

  // Compute live facts or use override
  const facts = useMemo<WeeklyInsightFacts | null>(() => {
    if (factsOverride) return factsOverride;

    try {
      return buildWeeklyInsightFacts({
        sessions,
        anchors,
        courseLogs,
        currentWaypointTitle: activeCourse?.waypoints?.find(
          (w) => w.id === activeCourse.currentWaypointId,
        )?.title,
        hasActiveCourse: Boolean(activeCourse),
        currentAnchorId: anchorId,
        weekOffset,
        weeksOfHistoryCount: Math.min(sessions.length > 0 ? 4 : 0, 4),
      });
    } catch (err: any) {
      console.warn('[useWeeklyInsight] Failed to build facts:', err);
      return null;
    }
  }, [factsOverride, sessions, anchors, courseLogs, activeCourse, anchorId, weekOffset]);

  // Compute primary snapshot from facts
  const primarySnapshot = useMemo<WeeklyInsightSnapshot | null>(() => {
    if (!facts) return null;
    return selectWeeklyInsight(facts);
  }, [facts]);

  // Active snapshot: either historical selection or primary snapshot
  const activeSnapshot = useMemo<WeeklyInsightSnapshot | null>(() => {
    if (selectedSnapshotId) {
      const historical = archiveItems.find((item) => item.id === selectedSnapshotId);
      if (historical) return historical.snapshot;
    }
    return primarySnapshot;
  }, [selectedSnapshotId, archiveItems, primarySnapshot]);

  // Determine first-week empty state:
  // If user has 0 sessions ever and 0 anchors, or is brand new with no snapshot
  const isFirstWeekEmpty = useMemo(() => {
    if (factsOverride) return false;
    return sessions.length === 0 && anchors.length === 0;
  }, [factsOverride, sessions.length, anchors.length]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate quick fetch if needed
      await new Promise((res) => setTimeout(res, 30));
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh insight');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading && !factsOverride) {
      refresh();
    }
  }, [loading, factsOverride, refresh]);

  const toggleActivity = useCallback(() => {
    setIsActivityOpen((prev) => !prev);
  }, []);

  const openArchive = useCallback(() => {
    setIsArchiveOpen(true);
  }, []);

  const closeArchive = useCallback(() => {
    setIsArchiveOpen(false);
  }, []);

  const selectSnapshot = useCallback((id: string) => {
    setSelectedSnapshotId(id);
    setFeedbackSubmitted(null);
    setIsArchiveOpen(false);
    setIsActivityOpen(false);
  }, []);

  const submitFeedback = useCallback(
    (rating: WeeklyInsightFeedbackRating) => {
      setFeedbackSubmitted(rating);
      if (activeSnapshot) {
        activeSnapshot.feedback = rating;
        onFeedbackSubmit?.(activeSnapshot.id, rating);
      }
    },
    [activeSnapshot, onFeedbackSubmit],
  );

  return {
    snapshot: activeSnapshot,
    facts,
    loading,
    error,
    isWithinReviewWindow,
    isFirstWeekEmpty,
    archiveItems,
    isActivityOpen,
    toggleActivity,
    isArchiveOpen,
    openArchive,
    closeArchive,
    selectSnapshot,
    submitFeedback,
    feedbackSubmitted,
    refresh,
  };
}
