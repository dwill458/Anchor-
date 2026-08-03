/**
 * Workstream E: paywall/resume revalidation for Chart-launched practice.
 *
 * A resumed Chart practice must never be trusted from stored state alone. The
 * handler re-reads the account and re-fetches server-authoritative Course state
 * before it is allowed to cross the canonical practice boundary.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockNavigateToPractice = jest.fn();
const mockNavigateToChart = jest.fn();
const mockNavigateToVault = jest.fn();
const mockStartPractice = jest.fn();
const mockFetchCourseDetail = jest.fn();
const mockConsumeTarget = jest.fn();
const mockConsumeChartDeepLink = jest.fn();
const mockGetAnchorById = jest.fn();
const mockAuthState: { user: unknown } = { user: null };

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToPractice: mockNavigateToPractice,
    navigateToChart: mockNavigateToChart,
    navigateToVault: mockNavigateToVault,
  }),
}));
jest.mock('@/hooks/usePracticeEntry', () => ({
  usePracticeEntry: () => ({ startPractice: mockStartPractice }),
}));
jest.mock('@/config', () => ({ ENABLE_VISUALIZE: true }));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ getAnchorById: mockGetAnchorById }) },
}));
jest.mock('@/stores/navigationResumeStore', () => ({
  useNavigationResumeStore: {
    getState: () => ({
      consumeTarget: mockConsumeTarget,
      consumeChartDeepLink: mockConsumeChartDeepLink,
    }),
  },
}));
jest.mock('@/stores/courseStore', () => ({
  useCourseStore: { getState: () => ({ fetchCourseDetail: mockFetchCourseDetail }) },
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));

import { ResumeTargetHandler } from '../ResumeTargetHandler';

const CHART_FLAGS_ON = {
  chart_enabled: true,
  chart_write_enabled: true,
  chart_ai_planner_enabled: false,
  chart_reflections_enabled: true,
  chart_notifications_enabled: false,
  chart_existing_user_intro_enabled: false,
};

const chartContext = {
  courseId: 'course-1',
  waypointId: 'waypoint-1',
  accountId: 'account-1',
  practiceEntrySource: 'chart_waypoint_detail' as const,
  returnTarget: {
    route: 'WaypointDetail' as const,
    courseId: 'course-1',
    waypointId: 'waypoint-1',
  },
};

const resumeTarget = {
  kind: 'chart_practice' as const,
  anchorId: 'anchor-1',
  mode: 'focus' as const,
  source: 'chart_waypoint_detail' as const,
  chartContext,
};

function courseWith(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    currentWaypointId: 'waypoint-1',
    waypoints: [
      {
        id: 'waypoint-1',
        state: 'CURRENT',
        anchorLink: { anchorId: 'anchor-1', anchorAvailable: true },
      },
    ],
    ...overrides,
  };
}

describe('ResumeTargetHandler — Chart practice resume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // EXPO_PUBLIC_ENABLE_CHART gates resolveChartFeatureFlags at build level.
    process.env.EXPO_PUBLIC_ENABLE_CHART = 'true';
    mockConsumeChartDeepLink.mockReturnValue(null);
    mockConsumeTarget.mockReturnValue(resumeTarget);
    mockAuthState.user = { id: 'account-1', chartFlags: CHART_FLAGS_ON };
    mockFetchCourseDetail.mockResolvedValue(courseWith());
  });

  it('resumes practice with identifier-only context after revalidating the Course', async () => {
    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockStartPractice).toHaveBeenCalledTimes(1));
    expect(mockFetchCourseDetail).toHaveBeenCalledWith('course-1');
    expect(mockStartPractice).toHaveBeenCalledWith({
      mode: 'focus',
      anchorId: 'anchor-1',
      source: 'chart_waypoint_detail',
      chartContext,
    });
    // Nothing beyond identifiers and the frozen source crosses the boundary.
    expect(Object.keys(mockStartPractice.mock.calls[0][0].chartContext).sort()).toEqual([
      'accountId',
      'courseId',
      'practiceEntrySource',
      'returnTarget',
      'waypointId',
    ]);
  });

  it('invalidates context belonging to a previous account', async () => {
    mockAuthState.user = { id: 'account-2', chartFlags: CHART_FLAGS_ON };

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToVault).toHaveBeenCalledTimes(1));
    expect(mockFetchCourseDetail).not.toHaveBeenCalled();
    expect(mockStartPractice).not.toHaveBeenCalled();
  });

  it('invalidates context when the account switches during revalidation', async () => {
    mockFetchCourseDetail.mockImplementation(async () => {
      mockAuthState.user = { id: 'account-2', chartFlags: CHART_FLAGS_ON };
      return courseWith();
    });

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToChart).toHaveBeenCalled());
    expect(mockStartPractice).not.toHaveBeenCalled();
  });

  it('does not strand the user when Chart is disabled after the paywall', async () => {
    mockAuthState.user = {
      id: 'account-1',
      chartFlags: { ...CHART_FLAGS_ON, chart_enabled: false },
    };

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToVault).toHaveBeenCalledTimes(1));
    expect(mockStartPractice).not.toHaveBeenCalled();
  });

  it('respects a server-authoritative waypoint change instead of resuming', async () => {
    mockFetchCourseDetail.mockResolvedValue(
      courseWith({
        currentWaypointId: 'waypoint-2',
        waypoints: [
          {
            id: 'waypoint-1',
            state: 'REACHED',
            anchorLink: { anchorId: 'anchor-1', anchorAvailable: true },
          },
          { id: 'waypoint-2', state: 'CURRENT', anchorLink: null },
        ],
      }),
    );

    render(<ResumeTargetHandler />);

    await waitFor(() =>
      expect(mockNavigateToChart).toHaveBeenCalledWith('WaypointDetail', {
        courseId: 'course-1',
        waypointId: 'waypoint-2',
      }),
    );
    expect(mockStartPractice).not.toHaveBeenCalled();
  });

  it('blocks resume when the linked Anchor was replaced', async () => {
    mockFetchCourseDetail.mockResolvedValue(
      courseWith({
        waypoints: [
          {
            id: 'waypoint-1',
            state: 'CURRENT',
            anchorLink: { anchorId: 'anchor-replaced', anchorAvailable: true },
          },
        ],
      }),
    );

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToChart).toHaveBeenCalled());
    expect(mockStartPractice).not.toHaveBeenCalled();
  });

  it('blocks resume when the linked Anchor was released or unlinked', async () => {
    mockFetchCourseDetail.mockResolvedValue(
      courseWith({
        waypoints: [{ id: 'waypoint-1', state: 'CURRENT', anchorLink: null }],
      }),
    );

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToChart).toHaveBeenCalled());
    expect(mockStartPractice).not.toHaveBeenCalled();
  });

  it('blocks resume when the Course is unavailable', async () => {
    mockFetchCourseDetail.mockResolvedValue(null);

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockNavigateToChart).toHaveBeenCalled());
    expect(mockStartPractice).not.toHaveBeenCalled();
  });

  it('leaves non-Chart resume behaviour unchanged', async () => {
    mockConsumeTarget.mockReturnValue({ kind: 'visualize_prepare', anchorId: 'anchor-9' });
    mockGetAnchorById.mockReturnValue({ id: 'anchor-9' });

    render(<ResumeTargetHandler />);

    await waitFor(() => expect(mockStartPractice).toHaveBeenCalledTimes(1));
    expect(mockStartPractice).toHaveBeenCalledWith({
      mode: 'visualize',
      anchorId: 'anchor-9',
      source: 'shortcut',
    });
    expect(mockFetchCourseDetail).not.toHaveBeenCalled();
  });
});
