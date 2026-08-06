import { useCallback } from 'react';

import { useTabNavigation } from '@/contexts/TabNavigationContext';
import {
  resolvePracticeReturnTarget,
  type ResolvePracticeReturnArgs,
} from '@/navigation/practiceReturn';
import { useAuthStore } from '@/stores/authStore';
import { resolveChartFeatureFlags } from '@/types/chart';

type PracticeNavigation = {
  popToTop?: () => void;
};

/**
 * Handles the Chart branch of an existing practice screen's return flow.
 * Non-Chart callers receive `false` and keep their established behavior.
 */
export function useChartPracticeReturn(navigation: PracticeNavigation) {
  const { navigateToChart, navigateToPractice } = useTabNavigation();
  const serverFlags = useAuthStore((state) => state.user?.chartFlags);
  const chartEnabled = resolveChartFeatureFlags(serverFlags).chart_enabled;

  return useCallback((args: Omit<ResolvePracticeReturnArgs, 'chartEnabled'>): boolean => {
    if (args.returnTo !== 'chart') return false;

    const target = resolvePracticeReturnTarget({ ...args, chartEnabled });
    navigation.popToTop?.();

    if (target.kind === 'chart_waypoint') {
      navigateToChart('WaypointDetail', {
        courseId: target.courseId,
        waypointId: target.waypointId,
        ...(target.practiceReturn ? { practiceReturn: target.practiceReturn } : {}),
      });
      return true;
    }
    if (target.kind === 'chart_home') {
      navigateToChart();
      return true;
    }

    // Chart may have been disabled while the session was active.
    navigateToPractice();
    return true;
  }, [chartEnabled, navigateToChart, navigateToPractice, navigation]);
}
