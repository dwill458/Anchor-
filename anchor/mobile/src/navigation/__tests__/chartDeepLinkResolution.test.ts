/**
 * Deep-link *resolution*, as distinct from parsing.
 *
 * chartDeepLinks.test.ts covers URL parsing. This covers what happens when a
 * well-formed link points at a Course or Waypoint that does not exist, which the
 * fixture matrix requires to resolve to a typed error rather than to a fabricated
 * or empty Chart.
 */

import { parseChartDeepLink } from '../chartDeepLinks';
import { useCourseStore } from '@/stores/courseStore';
import { chartApiClient } from '@/services/ChartApiClient';
import { ApiClientError } from '@/services/ApiClient';
import {
  CHART_FIXTURES,
  FIXTURE_COURSE_ID,
  UNKNOWN_DEEP_LINK_TARGETS,
  WAYPOINT_IDS,
} from '@/screens/chart/__fixtures__/phase0';

const ACCOUNT_ID = 'acct-chart-phase0';

const ENABLED_FLAGS = CHART_FIXTURES['active-current'].state.flags;
const DISABLED_FLAGS = CHART_FIXTURES['chart-disabled'].state.flags;

function bindStore(overrides: Record<string, unknown> = {}): void {
  useCourseStore.setState({
    accountId: ACCOUNT_ID,
    courses: [],
    activeCourse: null,
    flags: ENABLED_FLAGS,
    loading: false,
    refreshing: false,
    errorCode: null,
    migrationRequired: false,
    readOnly: false,
    offline: false,
    stale: false,
    lastSyncedAt: Date.now(),
    ...overrides,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  useCourseStore.getState().clearAccount();
});

describe('Deep-link resolution — unknown Course', () => {
  it('parses to a course target before any resolution is attempted', () => {
    const { courseId } = UNKNOWN_DEEP_LINK_TARGETS.unknownCourse;
    expect(parseChartDeepLink(`anchor://chart/${courseId}`)).toEqual({
      kind: 'course',
      courseId,
    });
  });

  it('surfaces COURSE_NOT_FOUND and returns no course', async () => {
    bindStore();
    jest
      .spyOn(chartApiClient, 'getCourse')
      .mockRejectedValue(
        new ApiClientError('Course not found', 'COURSE_NOT_FOUND', 404),
      );

    const result = await useCourseStore
      .getState()
      .fetchCourseDetail(UNKNOWN_DEEP_LINK_TARGETS.unknownCourse.courseId);

    expect(result).toBeNull();
    expect(useCourseStore.getState().errorCode).toBe(
      UNKNOWN_DEEP_LINK_TARGETS.unknownCourse.expectedErrorCode,
    );
    expect(useCourseStore.getState().activeCourse).toBeNull();
  });

  it('evicts a stale cached course when the server says it is gone', async () => {
    const cached = CHART_FIXTURES['active-current'].state.activeCourse!;
    bindStore({ courses: [cached], activeCourse: cached });
    jest
      .spyOn(chartApiClient, 'getCourse')
      .mockRejectedValue(
        new ApiClientError('Course not found', 'COURSE_NOT_FOUND', 404),
      );

    await useCourseStore.getState().fetchCourseDetail(FIXTURE_COURSE_ID);

    // A course the server no longer has must not linger in the list.
    expect(useCourseStore.getState().courses).toEqual([]);
    expect(useCourseStore.getState().errorCode).toBe('COURSE_NOT_FOUND');
  });

  it('keeps the cached course on a transient network failure', async () => {
    const cached = CHART_FIXTURES['active-current'].state.activeCourse!;
    bindStore({ courses: [cached], activeCourse: cached });
    jest
      .spyOn(chartApiClient, 'getCourse')
      .mockRejectedValue(new ApiClientError('Network down', undefined, 0));

    await useCourseStore.getState().fetchCourseDetail(FIXTURE_COURSE_ID);

    expect(useCourseStore.getState().courses).toHaveLength(1);
    expect(useCourseStore.getState().errorCode).toBe('NETWORK');
  });
});

describe('Deep-link resolution — unknown Waypoint', () => {
  it('parses to a waypoint target', () => {
    const { courseId, waypointId } = UNKNOWN_DEEP_LINK_TARGETS.unknownWaypoint;
    expect(parseChartDeepLink(`anchor://chart/${courseId}/waypoint/${waypointId}`)).toEqual({
      kind: 'waypoint',
      courseId,
      waypointId,
    });
  });

  it('loads the course but finds no matching waypoint', async () => {
    const course = CHART_FIXTURES['active-current'].state.activeCourse!;
    bindStore();
    jest.spyOn(chartApiClient, 'getCourse').mockResolvedValue({ data: course });

    const loaded = await useCourseStore.getState().fetchCourseDetail(FIXTURE_COURSE_ID);

    expect(loaded).not.toBeNull();
    // The screen replaces to ChartHome on exactly this condition rather than
    // rendering a fabricated waypoint.
    expect(
      loaded!.waypoints.some(
        wp => wp.id === UNKNOWN_DEEP_LINK_TARGETS.unknownWaypoint.waypointId,
      ),
    ).toBe(false);
    expect(loaded!.waypoints.some(wp => wp.id === WAYPOINT_IDS.current)).toBe(true);
  });
});

describe('Deep-link resolution — feature gate', () => {
  it('resolves nothing while Chart is disabled', async () => {
    bindStore({ flags: DISABLED_FLAGS });
    const getCourse = jest.spyOn(chartApiClient, 'getCourse');

    const result = await useCourseStore.getState().fetchCourseDetail(FIXTURE_COURSE_ID);

    expect(result).toBeNull();
    expect(getCourse).not.toHaveBeenCalled();
  });

  it('resolves nothing when no account is bound', async () => {
    useCourseStore.getState().clearAccount();
    const getCourse = jest.spyOn(chartApiClient, 'getCourse');

    const result = await useCourseStore.getState().fetchCourseDetail(FIXTURE_COURSE_ID);

    expect(result).toBeNull();
    expect(getCourse).not.toHaveBeenCalled();
  });
});
