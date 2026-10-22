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
import { buildWeeklyInsightFacts } from '@/adapters/v2/weeklyInsight/weeklyInsightFactsBuilder';
import { fetchWeeklyInsightHistory, persistWeeklyInsightFeedback, persistWeeklyInsightSnapshot } from '@/adapters/v2/weeklyInsight/weeklyInsightApiAdapter';
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
  /** Test/integration injection; production history always comes from the API. */
  historyOverride?: WeeklyInsightSnapshot[];
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
    factsOverride, historyOverride,
    onFeedbackSubmit,
  } = options;

  const [loading, setLoading] = useState<boolean>(!factsOverride);
  const [persistedSnapshots, setPersistedSnapshots] = useState<WeeklyInsightSnapshot[]>(historyOverride ?? []);
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
  const archiveItems = useMemo<WeeklyInsightHistoryItem[]>(() => persistedSnapshots.map(snapshot => ({ id: snapshot.id, dateRange: snapshot.weekLabel, title: snapshot.headline, typeLabel: snapshot.ruleType, ruleType: snapshot.ruleType, snapshot })), [persistedSnapshots]);

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
        weekOffset, referenceDate: new Date(),
        weeksOfHistoryCount: persistedSnapshots.length,
      });
    } catch (err: any) {
      console.warn('[useWeeklyInsight] Failed to build facts:', err);
      return null;
    }
  }, [factsOverride, sessions, anchors, courseLogs, activeCourse, anchorId, weekOffset]);

  // Compute primary snapshot from facts
  const primarySnapshot = useMemo<WeeklyInsightSnapshot | null>(() => {
    if (!facts) return null;
    return persistedSnapshots.find(item => item.weekLabel === facts.weekLabel) ?? selectWeeklyInsight(facts);
  }, [facts, persistedSnapshots]);
  const primaryIsPersisted = Boolean(primarySnapshot && persistedSnapshots.some(item => item.id === primarySnapshot.id));

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
      const history = await fetchWeeklyInsightHistory(anchorId);
      setPersistedSnapshots(history);
    } catch (e: any) {
      setError(e?.message || 'Failed to refresh insight');
    } finally {
      setLoading(false);
    }
  }, [anchorId]);

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
        void persistWeeklyInsightFeedback(activeSnapshot.id, rating).catch(() => setError('Feedback could not be saved.'));
        setPersistedSnapshots(items => items.map(item => item.id === activeSnapshot.id ? { ...item, feedback: rating } : item));
        onFeedbackSubmit?.(activeSnapshot.id, rating);
      }
    },
    [activeSnapshot, onFeedbackSubmit],
  );

  useEffect(() => {
    if (!facts || factsOverride || primaryIsPersisted) return;
    const snapshot = selectWeeklyInsight(facts);
    void persistWeeklyInsightSnapshot(anchorId, snapshot, facts.weekStart, facts.weekEnd)
      .then(saved => setPersistedSnapshots(items => items.some(item => item.id === saved.id) ? items : [saved, ...items]))
      .catch(() => undefined);
  }, [anchorId, facts, factsOverride, primaryIsPersisted]);

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
