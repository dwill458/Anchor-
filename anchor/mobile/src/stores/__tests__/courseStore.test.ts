import {
  DEFAULT_CHART_FEATURE_FLAGS,
  type ChartFeatureFlags,
  type CourseSummary,
} from '@/types/chart';
import { useCourseStore } from '../courseStore';

const enabledFlags: ChartFeatureFlags = {
  chart_enabled: true,
  chart_write_enabled: true,
  chart_ai_planner_enabled: true,
  chart_reflections_enabled: true,
  chart_notifications_enabled: true,
  chart_existing_user_intro_enabled: true,
};

const summary = (id: string, destinationText: string): CourseSummary => ({
  id,
  destinationText,
  startingContext: null,
  status: 'ACTIVE',
  version: 1,
  currentWaypointId: null,
  waypointCount: 0,
  reachedCount: 0,
  plottedAt: '2026-08-03T00:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  destinationAnchorLink: null,
});

describe('courseStore account scoping', () => {
  afterEach(() => {
    useCourseStore.getState().clearAccount();
  });

  it('clears the previous account Course before binding the next account', () => {
    useCourseStore.setState({
      accountId: 'account-a',
      courses: [summary('course-a', 'A private destination')],
    });

    useCourseStore.getState().bindAccount('account-b');

    expect(useCourseStore.getState().accountId).toBe('account-b');
    expect(useCourseStore.getState().courses).toEqual([]);
    expect(useCourseStore.getState().activeCourse).toBeNull();
    expect(useCourseStore.getState().courses.some((course) => course.destinationText === 'A private destination')).toBe(false);
  });

  it('drops cached feature flags when binding a different account', () => {
    useCourseStore.setState({ accountId: 'account-a', flags: enabledFlags, readOnly: false });

    useCourseStore.getState().bindAccount('account-b');

    expect(useCourseStore.getState().flags).toEqual(DEFAULT_CHART_FEATURE_FLAGS);
    expect(useCourseStore.getState().readOnly).toBe(true);
  });

  it('treats a stale Course projection as read-only', () => {
    const previousBuildFlag = process.env.EXPO_PUBLIC_ENABLE_CHART;
    try {
      process.env.EXPO_PUBLIC_ENABLE_CHART = 'true';
      useCourseStore.setState({
        accountId: 'account-a',
        flags: enabledFlags,
        stale: true,
        readOnly: false,
      });

      useCourseStore.getState().setFeatureFlags(enabledFlags);

      expect(useCourseStore.getState().readOnly).toBe(true);
    } finally {
      if (previousBuildFlag === undefined) delete process.env.EXPO_PUBLIC_ENABLE_CHART;
      else process.env.EXPO_PUBLIC_ENABLE_CHART = previousBuildFlag;
    }
  });
});
