import { useEffect } from "react";

import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { usePracticeEntry } from "@/hooks/usePracticeEntry";
import { useAnchorStore } from "@/stores/anchorStore";
import { useNavigationResumeStore } from "@/stores/navigationResumeStore";
import { ENABLE_VISUALIZE } from "@/config";
import { useAuthStore } from "@/stores/authStore";
import { resolveChartFeatureFlags } from "@/types/chart";
import { useCourseStore } from '@/stores/courseStore';

export const ResumeTargetHandler: React.FC = () => {
  const { navigateToPractice, navigateToChart, navigateToVault } = useTabNavigation();
  const { startPractice } = usePracticeEntry();
  useEffect(() => {
    const chartDeepLink = useNavigationResumeStore.getState().consumeChartDeepLink();
    if (chartDeepLink) {
      if (!resolveChartFeatureFlags(useAuthStore.getState().user?.chartFlags).chart_enabled) {
        navigateToVault();
        return;
      }
      if (chartDeepLink.kind === 'chart_home') navigateToChart();
      if (chartDeepLink.kind === 'course') navigateToChart('CourseDetails', { courseId: chartDeepLink.courseId });
      if (chartDeepLink.kind === 'log') navigateToChart('CourseLog', { courseId: chartDeepLink.courseId });
      if (chartDeepLink.kind === 'waypoint') {
        navigateToChart('WaypointDetail', {
          courseId: chartDeepLink.courseId,
          waypointId: chartDeepLink.waypointId,
        });
      }
      return;
    }
    const target = useNavigationResumeStore.getState().consumeTarget();
    if (!target) return;
    if (
      ENABLE_VISUALIZE &&
      target.kind === "visualize_prepare"
    ) {
      // An existing anchor means the canonical helper owns the outcome,
      // including a paywall redirect. Do not add a second Practice navigation
      // after that helper has already handled the request.
      if (useAnchorStore.getState().getAnchorById(target.anchorId)) {
        startPractice({
          mode: "visualize",
          anchorId: target.anchorId,
          source: "shortcut",
        });
        return;
      }
    }
    if (target.kind === 'chart_waypoint') {
      if (!resolveChartFeatureFlags(useAuthStore.getState().user?.chartFlags).chart_enabled) {
        navigateToVault();
        return;
      }
      navigateToChart('WaypointDetail', {
        courseId: target.courseId,
        waypointId: target.waypointId,
      });
      return;
    }
    if (target.kind === 'chart_practice') {
      const accountId = useAuthStore.getState().user?.id;
      if (
        accountId !== target.chartContext.accountId ||
        !resolveChartFeatureFlags(useAuthStore.getState().user?.chartFlags).chart_enabled
      ) {
        navigateToVault();
        return;
      }
      void useCourseStore.getState().fetchCourseDetail(target.chartContext.courseId).then((course) => {
        const waypoint = course?.waypoints.find((item) => item.id === target.chartContext.waypointId);
        if (
          useAuthStore.getState().user?.id !== target.chartContext.accountId ||
          !waypoint ||
          course?.currentWaypointId !== waypoint.id ||
          waypoint.state !== 'CURRENT' ||
          waypoint.anchorLink?.anchorId !== target.anchorId
        ) {
          navigateToChart('WaypointDetail', {
            courseId: target.chartContext.courseId,
            waypointId: course?.currentWaypointId ?? target.chartContext.waypointId,
          });
          return;
        }
        startPractice({
          mode: target.mode,
          anchorId: target.anchorId,
          source: target.source,
          chartContext: target.chartContext,
        });
      });
      return;
    }
    if (target.kind === 'chart_ai_plan') {
      if (!resolveChartFeatureFlags(useAuthStore.getState().user?.chartFlags).chart_enabled) {
        navigateToVault();
        return;
      }
      // Workstream F owns the proposal continuation. B restores the Chart
      // context without fabricating a proposal.
      navigateToChart();
      return;
    }
    navigateToPractice();
  }, [navigateToChart, navigateToPractice, navigateToVault, startPractice]);
  return null;
};
