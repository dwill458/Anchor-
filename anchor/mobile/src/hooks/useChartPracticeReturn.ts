import { useCallback } from 'react';

import { useTabNavigation } from '@/contexts/TabNavigationContext';
import {
  resolvePracticeReturnTarget,
  type ResolvePracticeReturnArgs,
} from '@/navigation/practiceReturn';
import { useAuthStore } from '@/stores/authStore';
import { finishChartAnchorPracticeHandoff } from '@/services/ChartAnchorHandoffService';
import { canViewChart } from '@/types/chart';

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
  const chartCapabilities = useAuthStore((state) => state.user?.chartCapabilities);
  const chartEnabled = canViewChart(serverFlags, chartCapabilities);

  return useCallback((args: Omit<ResolvePracticeReturnArgs, 'chartEnabled'>): boolean => {
    if (args.returnTo !== 'chart') return false;

    if (
      args.chartContext &&
      args.practiceReturn?.outcome === 'completed' &&
      args.practiceReturn.anchorId
    ) {
      finishChartAnchorPracticeHandoff(
        args.chartContext.courseId,
        args.chartContext.waypointId,
        args.practiceReturn.anchorId,
      );
    }

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
