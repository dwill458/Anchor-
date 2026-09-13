import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useV2SelectedAnchor } from '@/hooks/v2/home/useV2SelectedAnchor';
import { useV2Vision } from '@/hooks/v2/vision';
import { resolveGreeting } from '@/constants/v2/home';
import { V2_RECOMMENDATION_ACTION_TO_MODE, type V2PracticeMode } from '@/constants/v2/practice';
import { fetchV2RecommendationContext, type V2RecommendationContext } from '@/adapters/v2/practice';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Anchor } from '@/types';
import { toThreadPresentation, type V2ThreadPresentation } from './threadAdapter';
import { toV2HomeVisionState, type HomeVisionState } from './visionAdapter';
import { courseMatchesAnchor, toHomeChartState, type HomeChartState } from './chartAdapter';

export type V2HomeAnchorSummary = {
  anchor: Anchor;
  thread: V2ThreadPresentation;
  isSelected: boolean;
};

export type V2HomeTodayState =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      mode: V2PracticeMode;
      action: V2RecommendationContext['recommendation']['action'];
      reason: string;
      durationSeconds?: number;
      completionSignal: V2RecommendationContext['completionSignal'];
      threadDelta: number | null;
      threadDeltaStatus: V2RecommendationContext['thread']['delta7dStatus'];
    };

export type V2HomeModel = {
  greeting: string;
  profileInitial: string | null;
  anchorState: 'loading' | 'ready' | 'error';
  anchorError: string | null;
  hasAnchors: boolean;
  selectedAnchor: Anchor | null;
  thread: V2ThreadPresentation | null;
  anchorList: V2HomeAnchorSummary[];
  vision: HomeVisionState;
  chart: HomeChartState;
  today: V2HomeTodayState;
  refreshVision: () => Promise<void>;
  refreshToday: () => Promise<void>;
  refreshChart: () => Promise<void>;
};

function useV2HomeToday(
  anchorId: string | null,
  durations: { focus: number; deep_prime: number; visualize: number },
): { today: V2HomeTodayState; refresh: () => Promise<void> } {
  const [today, setToday] = useState<V2HomeTodayState>({ state: 'none' });
  const activeController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    activeController.current?.abort();
    if (!anchorId) {
      setToday({ state: 'none' });
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    setToday({ state: 'loading' });
    try {
      const context = await fetchV2RecommendationContext(anchorId, controller.signal);
      if (controller.signal.aborted) return;
      const mode = V2_RECOMMENDATION_ACTION_TO_MODE[context.recommendation.action];
      const durationSeconds = mode === 'release' ? undefined : durations[mode];
      setToday({
        state: 'ready',
        mode,
        action: context.recommendation.action,
        reason: context.recommendation.reason?.trim() ?? '',
        durationSeconds,
        completionSignal: context.completionSignal,
        threadDelta: context.thread.delta7d,
        threadDeltaStatus: context.thread.delta7dStatus,
      });
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setToday({
        state: 'error',
        message: error instanceof Error ? error.message : 'Today’s practice is unavailable.',
      });
    }
  }, [anchorId, durations]);

  useEffect(() => {
    void load();
    return () => activeController.current?.abort();
  }, [load]);

  return { today, refresh: load };
}

/** Home read model over the account-scoped Anchor, Vision, Course, and practice APIs. */
export function useV2HomeModel(): V2HomeModel {
  const { selectedAnchor, activeAnchors } = useV2SelectedAnchor();
  const displayName = useAuthStore((s) => s.user?.displayName ?? null);
  const accountId = useAuthStore((s) => s.user?.id ?? null);
  const chartServerFlags = useAuthStore((s) => s.user?.chartFlags ?? null);
  const courseAccountId = useCourseStore((s) => s.accountId);
  const anchorLoading = useAnchorStore((s) => s.isLoading);
  const anchorError = useAnchorStore((s) => s.error);
  const activeCourse = useCourseStore((s) => s.activeCourse);
  const courseLoading = useCourseStore((s) => s.loading);
  const courseInitializationStatus = useCourseStore((s) => s.initializationStatus);
  const courseError = useCourseStore((s) => s.errorCode);
  const bindCourseAccount = useCourseStore((s) => s.bindAccount);
  const setCourseFeatureFlags = useCourseStore((s) => s.setFeatureFlags);
  const hydrateCourse = useCourseStore((s) => s.hydrateAndRefresh);
  const refreshChartStore = useCourseStore((s) => s.refresh);
  const focusDuration = useSettingsStore((s) => s.focusSessionDuration);
  const primeDuration = useSettingsStore((s) => s.primeSessionDuration);
  const visualizeDuration = useSettingsStore((s) => s.visualizeSessionDuration);
  const visionModel = useV2Vision(selectedAnchor?.id ?? '');
  const todayDurations = useMemo(
    () => ({ focus: focusDuration, deep_prime: primeDuration, visualize: visualizeDuration }),
    [focusDuration, primeDuration, visualizeDuration],
  );
  const { today, refresh: refreshToday } = useV2HomeToday(
    selectedAnchor?.id ?? null,
    todayDurations,
  );

  useEffect(() => {
    setCourseFeatureFlags(chartServerFlags);
    bindCourseAccount(accountId);
    if (accountId) void hydrateCourse(accountId);
  }, [accountId, bindCourseAccount, chartServerFlags, hydrateCourse, setCourseFeatureFlags]);

  const anchorState: V2HomeModel['anchorState'] =
    activeAnchors.length === 0 && anchorLoading
      ? 'loading'
      : anchorError && activeAnchors.length === 0
        ? 'error'
        : 'ready';

  const vision = selectedAnchor
    ? toV2HomeVisionState(visionModel.state)
    : ({ state: 'none' } satisfies HomeVisionState);

  const chart = useMemo<HomeChartState>(() => {
    if (!selectedAnchor) return { state: 'none' };
    const scopedCourse = activeCourse && courseAccountId === accountId && courseMatchesAnchor(activeCourse, selectedAnchor, { isOnlyActiveAnchor: activeAnchors.length === 1 })
      ? activeCourse
      : null;
    if (scopedCourse) return toHomeChartState(scopedCourse);
    if (courseLoading || courseInitializationStatus === 'hydrating') return { state: 'loading' };
    if (courseError) return { state: 'error', message: String(courseError) };
    return { state: 'none' };
  }, [accountId, activeAnchors.length, activeCourse, courseAccountId, courseError, courseInitializationStatus, courseLoading, selectedAnchor]);

  return useMemo(() => {
    const anchorList = activeAnchors.map<V2HomeAnchorSummary>((anchor) => ({
      anchor,
      thread: toThreadPresentation(anchor),
      isSelected:
        !!selectedAnchor &&
        (anchor.id === selectedAnchor.id || anchor.localId === selectedAnchor.localId),
    }));

    const baseThread = selectedAnchor ? toThreadPresentation(selectedAnchor) : null;
    const thread = baseThread && today.state === 'ready' && today.threadDeltaStatus === 'AVAILABLE' && today.threadDelta !== null && Number.isFinite(today.threadDelta)
      ? {
          ...baseThread,
          delta: today.threadDelta,
          trend: today.threadDelta > 0 ? 'up' as const : today.threadDelta < 0 ? 'down' as const : 'flat' as const,
        }
      : baseThread;

    return {
      greeting: resolveGreeting(new Date(), displayName),
      profileInitial: displayName?.trim().charAt(0).toUpperCase() || null,
      anchorState,
      anchorError,
      hasAnchors: activeAnchors.length > 0,
      selectedAnchor,
      thread,
      anchorList,
      vision,
      chart,
      today,
      refreshVision: visionModel.refresh,
      refreshToday,
      refreshChart: () => refreshChartStore(accountId ?? undefined),
    };
  }, [
    activeAnchors,
    anchorError,
    anchorState,
    chart,
    displayName,
    refreshChartStore,
    refreshToday,
    selectedAnchor,
    today,
    vision,
    visionModel.refresh,
    accountId,
  ]);
}
