import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWeeklyStats } from '@/hooks/useWeeklyStats';
import { useSettingsStore } from '@/stores/settingsStore';

const DISMISSED_WEEK_KEY = 'anchor_weekly_summary_dismissed_week';

export interface WeeklySummaryTriggerResult {
  shouldShow: boolean;
  dismiss: () => void;
}

/**
 * Determines whether the weekly summary modal should be shown for the current
 * ISO week and exposes a dismissal handler persisted in AsyncStorage.
 */
export function useWeeklySummaryTrigger(): WeeklySummaryTriggerResult {
  const { weekNumber, weekStart, totalPrimes } = useWeeklyStats();
  const developerPreviewToken = useSettingsStore((state) => state.developerWeeklySummaryPreviewToken);
  const clearDeveloperPreview = useSettingsStore((state) => state.clearDeveloperWeeklySummaryPreview);
  const [dismissedWeekKey, setDismissedWeekKey] = useState<string | null>(null);
  const [hasLoadedDismissalState, setHasLoadedDismissalState] = useState(false);
  const currentWeekKey = `${weekNumber}:${weekStart}`;

  useEffect(() => {
    let isMounted = true;
    setHasLoadedDismissalState(false);

    AsyncStorage.getItem(DISMISSED_WEEK_KEY)
      .then((value) => {
        if (!isMounted) {
          return;
        }

        setDismissedWeekKey(value == null ? null : value);
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
    setDismissedWeekKey(currentWeekKey);
    void AsyncStorage.setItem(DISMISSED_WEEK_KEY, currentWeekKey);
  }, [clearDeveloperPreview, currentWeekKey]);

  const shouldShow = useMemo(() => {
    if (developerPreviewToken > 0) {
      return true;
    }

    if (!hasLoadedDismissalState) {
      return false;
    }

    const now = new Date();
    const isSunday = now.getDay() === 0;
    const isWithinWindow = now.getHours() >= 18 && now.getHours() <= 23;
    const hasWeeklyPrime = totalPrimes >= 1;
    const hasDismissedThisWeek = dismissedWeekKey === currentWeekKey;

    return isSunday && isWithinWindow && hasWeeklyPrime && !hasDismissedThisWeek;
  }, [currentWeekKey, developerPreviewToken, dismissedWeekKey, hasLoadedDismissalState, totalPrimes]);

  return {
    shouldShow,
    dismiss,
  };
}
