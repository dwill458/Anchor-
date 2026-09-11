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
import { fetchWeeklyInsightHistory, generateWeeklyInsightSnapshot, persistWeeklyInsightFeedback } from '@/adapters/v2/weeklyInsight/weeklyInsightApiAdapter';
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

  const isWithinReviewWindow = useMemo(() => isWithinWeeklyInsightReviewWindow(), []);

  // Compute archive items (preserved snapshots)
  const archiveItems = useMemo<WeeklyInsightHistoryItem[]>(() => persistedSnapshots.map(snapshot => ({ id: snapshot.id, dateRange: snapshot.weekLabel, title: snapshot.headline, typeLabel: snapshot.ruleType, ruleType: snapshot.ruleType, snapshot })), [persistedSnapshots]);

  // Production facts are frozen server evidence included with the snapshot.
  // factsOverride exists solely for deterministic UI tests.
  const facts = useMemo<WeeklyInsightFacts | null>(() => {
    if (factsOverride) return factsOverride;
    const current = persistedSnapshots[0] as (WeeklyInsightSnapshot & { facts?: WeeklyInsightFacts }) | undefined;
    return current?.facts ?? null;
  }, [factsOverride, persistedSnapshots, weekOffset]);

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

  // Missing server evidence remains missing; do not substitute device-local zeroes.
  const isFirstWeekEmpty = useMemo(() => {
    if (factsOverride) return false;
    return Boolean(facts && facts.sessions.length === 0);
  }, [factsOverride, facts]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await fetchWeeklyInsightHistory(anchorId);
      const current = await generateWeeklyInsightSnapshot(anchorId);
      setPersistedSnapshots(items => {
        const withoutCurrent = history.filter(item => item.id !== current.id);
        return [current, ...withoutCurrent];
      });
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
