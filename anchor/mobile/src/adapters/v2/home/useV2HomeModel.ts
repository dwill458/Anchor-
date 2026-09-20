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
import AuthHydrationService from '@/services/AuthHydrationService';
import type { Anchor } from '@/types';
import { toThreadPresentation, type V2ThreadPresentation } from './threadAdapter';
import { toV2HomeVisionState, type HomeVisionState } from './visionAdapter';
import { courseMatchesAnchor, resolveHomeChartState, type HomeChartState } from './chartAdapter';
import { toHomeProgressState, type HomeProgressState } from './progressAdapter';
import { useCourseLogStore } from '@/stores/courseLogStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toHomeRecentActivity, type HomeRecentActivityItem } from './recentActivityAdapter';

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
      threadStrength?: number | null;
      threadDelta: number | null;
      threadDeltaStatus: V2RecommendationContext['thread']['delta7dStatus'];
    };

export type V2HomeModel = {
  greeting: string;
  profileInitial: string | null;
  profilePictureUrl: string | null;
  anchorState: 'loading' | 'ready' | 'error';
  anchorError: string | null;
  hasAnchors: boolean;
  selectedAnchor: Anchor | null;
  thread: V2ThreadPresentation | null;
  anchorList: V2HomeAnchorSummary[];
  vision: HomeVisionState;
  chart: HomeChartState;
  progress: HomeProgressState;
  recentActivity: HomeRecentActivityItem[];
  today: V2HomeTodayState;
  /** Index of the selected Anchor inside `anchorList`; -1 when there is none. */
  selectedIndex: number;
  selectAnchor: (anchorId: string) => void;
  refreshVision: () => Promise<void>;
  refreshToday: () => Promise<void>;
  refreshChart: () => Promise<void>;
  refreshAnchors: () => Promise<void>;
};

function useV2HomeToday(
  anchorId: string | null,
  durations: { focus: number; deep_prime: number; visualize: number },
): { today: V2HomeTodayState; refresh: () => Promise<void> } {
  const [result, setResult] = useState<{ anchorId: string | null; today: V2HomeTodayState }>({ anchorId: null, today: { state: 'none' } });
  const activeController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    activeController.current?.abort();
    if (!anchorId) {
      setResult({ anchorId: null, today: { state: 'none' } });
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    setResult({ anchorId, today: { state: 'loading' } });
    try {
      const context = await fetchV2RecommendationContext(anchorId, controller.signal);
      if (controller.signal.aborted) return;
      const mode = V2_RECOMMENDATION_ACTION_TO_MODE[context.recommendation.action];
      const durationSeconds = mode === 'release' ? undefined : durations[mode];
      setResult({ anchorId, today: {
        state: 'ready',
        mode,
        action: context.recommendation.action,
        reason: context.recommendation.reason?.trim() ?? '',
        durationSeconds,
        completionSignal: context.completionSignal,
        threadStrength: typeof context.thread.strength === 'number' ? context.thread.strength : null,
        threadDelta: context.thread.delta7d,
        threadDeltaStatus: context.thread.delta7dStatus,
      } });
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setResult({ anchorId, today: {
        state: 'error',
        message: error instanceof Error ? error.message : 'Today’s practice is unavailable.',
      } });
    }
  }, [anchorId, durations]);

  useEffect(() => {
    void load();
    return () => activeController.current?.abort();
  }, [load]);

  // Selection can change before the effect above starts the next request.
  // Never expose the prior Anchor's recommendation or delta in that render.
  return { today: result.anchorId === anchorId ? result.today : anchorId ? { state: 'loading' } : { state: 'none' }, refresh: load };
}

/** Home read model over the account-scoped Anchor, Vision, Course, and practice APIs. */
export function useV2HomeModel(): V2HomeModel {
  const { selectedAnchor, activeAnchors, selectAnchor } = useV2SelectedAnchor();
  const displayName = useAuthStore((s) => s.user?.displayName ?? null);
  const profilePictureUrl = useAuthStore((s) => s.user?.profilePictureUrl ?? null);
  const accountId = useAuthStore((s) => s.user?.id ?? null);
  const chartServerFlags = useAuthStore((s) => s.user?.chartFlags ?? null);
  const anchorLoading = useAnchorStore((s) => s.isLoading);
  const anchorError = useAnchorStore((s) => s.error);
  const courseAccountId = useCourseStore((s) => s.accountId);
  const activeCourse = useCourseStore((s) => s.activeCourse);
  const courseSummaries = useCourseStore((s) => s.courses);
  const chartEnabled = useCourseStore((s) => s.flags.chart_enabled);
  const courseInitializationStatus = useCourseStore((s) => s.initializationStatus);
  const courseError = useCourseStore((s) => s.errorCode);
  const courseLogEntries = useCourseLogStore((s) => s.entries);
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const practiceHistory = useSessionStore((s) => s.practiceHistory);
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

  const refreshAnchors = useCallback(async () => {
    if (!accountId) return;
    useAnchorStore.getState().setLoading(true);
    try {
      await AuthHydrationService.hydrateAuthenticatedData();
    } catch (error) {
      useAnchorStore.getState().setError(error instanceof Error ? error.message : 'Unable to load your Anchors.');
    } finally {
      useAnchorStore.getState().setLoading(false);
    }
  }, [accountId]);

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

  /**
   * Memoised for identity, not for cost. `toV2HomeVisionState` is cheap, but a
   * fresh object every render means the memoised Vision section can never bail
   * out — so Vision re-rendered on every Today, Chart and Progress change, and
   * on every frame Home re-rendered for any other reason.
   */
  const vision = useMemo<HomeVisionState>(
    () => (selectedAnchor ? toV2HomeVisionState(visionModel.state) : { state: 'none' }),
    [selectedAnchor, visionModel.state],
  );

  /**
   * Absent, unknown and in-flight are three different Chart states. A busy
   * Course store is never treated as evidence that this Anchor has a Chart.
   */
  const chart = useMemo<HomeChartState>(
    () =>
      resolveHomeChartState({
        anchor: selectedAnchor,
        chartEnabled,
        accountId,
        courseAccountId,
        initializationStatus: courseInitializationStatus,
        courses: courseSummaries,
        activeCourse,
        errorCode: courseError === null || courseError === undefined ? null : String(courseError),
        isOnlyActiveAnchor: activeAnchors.length === 1,
      }),
    [accountId, activeAnchors.length, activeCourse, chartEnabled, courseAccountId, courseError, courseInitializationStatus, courseSummaries, selectedAnchor],
  );

  /** Course logs are account-scoped; only this Anchor's own Chart may supply evidence. */
  const ownsActiveChart = Boolean(
    selectedAnchor &&
      activeCourse &&
      courseAccountId === accountId &&
      courseMatchesAnchor(activeCourse, selectedAnchor, { isOnlyActiveAnchor: activeAnchors.length === 1 }),
  );

  const progress = useMemo<HomeProgressState>(
    () => toHomeProgressState({ anchor: selectedAnchor, courseLogs: courseLogEntries, sessions: sessionLog, ownsActiveChart }),
    [courseLogEntries, ownsActiveChart, selectedAnchor, sessionLog],
  );
  const recentActivity = useMemo(() => toHomeRecentActivity({
    sessions: practiceHistory,
    accountId,
    anchorId: selectedAnchor?.id ?? null,
    anchorLocalId: selectedAnchor?.localId,
  }), [practiceHistory, accountId, selectedAnchor?.id, selectedAnchor?.localId]);

  /**
   * Selection is resolved by reference, not by comparing ids.
   * `selectedAnchor` is always an element of `activeAnchors`, so `indexOf`
   * is exact. Comparing `localId === localId` looked equivalent but matched
   * EVERY Anchor whose `localId` was undefined, which pinned the hero to
   * index 0 while the shared store's selection moved underneath it — the
   * carousel appeared frozen and Today/Vision/Chart could describe a
   * different Anchor than the artwork on screen.
   */
  const selectedIndex = useMemo(
    () => (selectedAnchor ? activeAnchors.indexOf(selectedAnchor) : -1),
    [activeAnchors, selectedAnchor],
  );

  /**
   * The carousel's own data, memoised on its own inputs. It depends on the
   * Anchor list and the selection and on nothing else, so it must NOT be
   * rebuilt inside the model-wide memo: doing so handed the Home hero a brand
   * new array every time Today's recommendation moved between loading and
   * ready, re-rendering the carousel on exactly the frames it is settling.
   */
  const anchorList = useMemo(
    () =>
      activeAnchors.map<V2HomeAnchorSummary>((anchor, index) => ({
        anchor,
        thread: toThreadPresentation(anchor),
        isSelected: index === selectedIndex,
      })),
    [activeAnchors, selectedIndex],
  );

  return useMemo(() => {
    /**
     * Strength comes from the server-authoritative recommendation context or Anchor record.
     * `null` is passed straight through and is never coerced to 0.
     */
    const effectiveStrength =
      today.state === 'ready' && typeof today.threadStrength === 'number'
        ? today.threadStrength
        : selectedAnchor?.threadStrength;
    const baseThread = selectedAnchor
      ? toThreadPresentation({
          ...selectedAnchor,
          threadStrength: effectiveStrength,
        })
      : null;
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
      profilePictureUrl,
      anchorState,
      anchorError,
      hasAnchors: activeAnchors.length > 0,
      selectedAnchor,
      thread,
      anchorList,
      vision,
      chart,
      progress,
      recentActivity,
      selectedIndex,
      selectAnchor,
      today,
      refreshVision: visionModel.refresh,
      refreshToday,
      refreshChart: () => refreshChartStore(accountId ?? undefined),
      refreshAnchors,
    };
  }, [activeAnchors, anchorError, anchorList, anchorState, chart, displayName, profilePictureUrl, progress, recentActivity, refreshAnchors, refreshChartStore, refreshToday, selectAnchor, selectedAnchor, selectedIndex, today, vision, visionModel.refresh, accountId]);
}
