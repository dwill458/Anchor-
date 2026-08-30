import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAnchorStore } from '@/stores/anchorStore';
import { useWeeklyStats } from '@/hooks/useWeeklyStats';
import { useSettingsStore } from '@/stores/settingsStore';
import { isWithinWeeklyReviewWindow } from '@/utils/weeklyReviewWindow';

const DISMISSED_WEEK_KEY = 'anchor_weekly_summary_dismissed_week';
const REVIEW_STREAK_KEY = 'anchor_weekly_summary_review_streak';

/** Consecutive un-opened review weeks that force the review open on launch. */
const AUTO_OPEN_DISMISSED_WEEKS = 2;

interface ReviewStreakState {
  /** Consecutive review weeks that ended without the review being opened. */
  reviewDismissedStreak: number;
  /** Review week key most recently tracked. */
  lastTrackedWeekKey: string | null;
  /** Whether the tracked week's review has been opened. */
  openedTrackedWeek: boolean;
}

const INITIAL_STREAK_STATE: ReviewStreakState = {
  reviewDismissedStreak: 0,
  lastTrackedWeekKey: null,
  openedTrackedWeek: false,
};

function parseStreakState(raw: string | null): ReviewStreakState {
  if (!raw) {
    return INITIAL_STREAK_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ReviewStreakState>;

    return {
      reviewDismissedStreak:
        typeof parsed.reviewDismissedStreak === 'number' &&
        Number.isFinite(parsed.reviewDismissedStreak)
          ? Math.max(0, Math.floor(parsed.reviewDismissedStreak))
          : 0,
      lastTrackedWeekKey:
        typeof parsed.lastTrackedWeekKey === 'string' ? parsed.lastTrackedWeekKey : null,
      openedTrackedWeek: parsed.openedTrackedWeek === true,
    };
  } catch {
    return INITIAL_STREAK_STATE;
  }
}

export interface WeeklySummaryTriggerResult {
  shouldShow: boolean;
  dismiss: () => void;
}

/**
 * Determines whether the weekly summary modal should be shown for the current
 * active weekly summary review period and exposes a dismissal handler
 * persisted in AsyncStorage.
 *
 * The review surfaces Sunday evening through Monday morning. Two consecutive
 * review weeks that pass without the review being opened force it open on the
 * next app launch; opening it resets that counter.
 */
export function useWeeklySummaryTrigger(): WeeklySummaryTriggerResult {
  const { weekNumber, weekStart, totalPrimes } = useWeeklyStats();
  const hasActiveAnchor = useAnchorStore((state) =>
    state.anchors.some((anchor) => !anchor.isReleased && !anchor.archivedAt)
  );
  const developerPreviewToken = useSettingsStore((state) => state.developerWeeklySummaryPreviewToken);
  const clearDeveloperPreview = useSettingsStore((state) => state.clearDeveloperWeeklySummaryPreview);
  const [dismissedWeekKey, setDismissedWeekKey] = useState<string | null>(null);
  const [hasLoadedDismissalState, setHasLoadedDismissalState] = useState(false);
  const [autoOpenPending, setAutoOpenPending] = useState(false);
  const currentWeekKey = `${weekNumber}:${weekStart}`;

  useEffect(() => {
    let isMounted = true;
    setHasLoadedDismissalState(false);

    Promise.all([
      AsyncStorage.getItem(DISMISSED_WEEK_KEY),
      AsyncStorage.getItem(REVIEW_STREAK_KEY),
    ])
      .then(([dismissedValue, streakValue]) => {
        if (!isMounted) {
          return;
        }

        setDismissedWeekKey(dismissedValue == null ? null : dismissedValue);

        let streakState = parseStreakState(streakValue);
        if (streakState.lastTrackedWeekKey !== currentWeekKey) {
          // A new review week began. If the previous tracked week's review was
          // never opened, count it as a dismissed week.
          streakState = {
            reviewDismissedStreak:
              streakState.lastTrackedWeekKey != null && !streakState.openedTrackedWeek
                ? streakState.reviewDismissedStreak + 1
                : streakState.reviewDismissedStreak,
            lastTrackedWeekKey: currentWeekKey,
            openedTrackedWeek: false,
          };
          void AsyncStorage.setItem(REVIEW_STREAK_KEY, JSON.stringify(streakState));
        }

        if (
          streakState.reviewDismissedStreak >= AUTO_OPEN_DISMISSED_WEEKS &&
          dismissedValue !== currentWeekKey
        ) {
          setAutoOpenPending(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDismissedWeekKey(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setHasLoadedDismissalState(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentWeekKey]);

  const dismiss = useCallback(() => {
    clearDeveloperPreview();
    setAutoOpenPending(false);
    setDismissedWeekKey(currentWeekKey);
    void AsyncStorage.setItem(DISMISSED_WEEK_KEY, currentWeekKey);
  }, [clearDeveloperPreview, currentWeekKey]);

  const shouldShow = useMemo(() => {
    const settings = useSettingsStore.getState();
    if (!settings.weeklySummaryEnabled && developerPreviewToken === 0) {
      return false;
    }

    if (developerPreviewToken > 0) {
      return true;
    }

    if (!hasLoadedDismissalState) {
      return false;
    }

    const hasDismissedThisWeek = dismissedWeekKey === currentWeekKey;
    if (hasDismissedThisWeek) {
      return false;
    }

    // Two consecutive un-opened review weeks force the review open on launch.
    if (autoOpenPending) {
      return true;
    }

    // DEFERRED: the review previously required a weekly prime and surfaced any
    // time on Sunday. Zero-prime weeks now render a dedicated state instead,
    // and delivery is pinned to Sunday evening / Monday morning.
    // const now = new Date();
    // const isSunday = now.getDay() === 0;
    // const hasWeeklyPrime = totalPrimes >= 1;
    // return isSunday && hasWeeklyPrime && !hasDismissedThisWeek;

    const hasReviewContent = hasActiveAnchor || totalPrimes >= 1;

    return isWithinWeeklyReviewWindow(new Date()) && hasReviewContent;
  }, [
    autoOpenPending,
    currentWeekKey,
    developerPreviewToken,
    dismissedWeekKey,
    hasActiveAnchor,
    hasLoadedDismissalState,
    totalPrimes,
  ]);

  useEffect(() => {
    if (!shouldShow || developerPreviewToken > 0) {
      return;
    }

    // Surfacing the review counts as opening it: reset the dismissed-week
    // streak and mark the tracked week as opened.
    const openedState: ReviewStreakState = {
      reviewDismissedStreak: 0,
      lastTrackedWeekKey: currentWeekKey,
      openedTrackedWeek: true,
    };
    void AsyncStorage.setItem(REVIEW_STREAK_KEY, JSON.stringify(openedState));
  }, [currentWeekKey, developerPreviewToken, shouldShow]);

  return {
    shouldShow,
    dismiss,
  };
}
