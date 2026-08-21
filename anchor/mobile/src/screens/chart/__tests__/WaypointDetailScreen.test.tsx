import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  setParams: jest.fn(),
};
let mockCourseStore: any;
let mockAuthState: any;
const mockNavigateToVault = jest.fn();
const mockStartPractice = jest.fn();
const mockTrackChartEventOnce = jest.fn();
const mockAnchors = [
  { id: 'anchor-a', intentionText: 'Anchor A', category: 'creative' },
  { id: 'anchor-b', intentionText: 'Anchor B', category: 'creative' },
];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { courseId: 'course-1', waypointId: 'waypoint-1' } }),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: () => mockCourseStore }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: any) => unknown) => selector(mockAuthState),
}));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: any) => unknown) => selector({ getActiveAnchors: () => mockAnchors }),
}));
jest.mock('@/hooks/usePracticeEntry', () => ({
  usePracticeEntry: () => ({ startPractice: mockStartPractice, isNavigationLocked: false }),
}));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useReduceMotionEnabled: () => true }));
jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({ navigateToVault: mockNavigateToVault }),
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    WAYPOINT_COMPLETION_STARTED: 'waypoint_completion_started',
    WAYPOINT_COMPLETED: 'waypoint_completed',
    COURSE_COMPLETED: 'course_completed',
  },
  trackChartEventOnce: (...args: any[]) => mockTrackChartEventOnce(...args),
}));
jest.mock('../useChartPostPracticeReflection', () => ({ useChartPostPracticeReflection: jest.fn() }));
jest.mock('@/screens/practice/components/AnchorSelectorSheet', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    AnchorSelectorSheet: ({ visible, anchors, onSelect }: any) => visible
      ? ReactModule.createElement(View, null, anchors.map((anchor: any) => ReactModule.createElement(
        Pressable,
        { key: anchor.id, accessibilityRole: 'button', accessibilityLabel: `Select ${anchor.id}`, onPress: () => onSelect(anchor) },
        ReactModule.createElement(Text, null, anchor.intentionText),
      )))
      : null,
  };
});
jest.mock('../chartUi', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  const button = ({ label, onPress, disabled }: any) => ReactModule.createElement(
    Pressable,
    { accessibilityRole: 'button', accessibilityLabel: label, accessibilityState: { disabled }, disabled, onPress },
    ReactModule.createElement(Text, null, label),
  );
  return {
    ChartScreenFrame: ({ title, subtitle, children }: any) => ReactModule.createElement(View, null,
      ReactModule.createElement(Text, null, title),
      subtitle ? ReactModule.createElement(Text, null, subtitle) : null,
      children,
    ),
    ChartButton: button,
    ChartGhostButton: button,
    ChartCard: ({ children }: any) => ReactModule.createElement(View, null, children),
    ChartKicker: ({ children }: any) => ReactModule.createElement(Text, null, children),
    ChartSheetHandle: () => ReactModule.createElement(View, { testID: 'sheet-handle' }),
    ChartStatusPill: ({ status }: any) => ReactModule.createElement(Text, null, status),
    ReadOnlyNotice: ({ reason }: any) => ReactModule.createElement(Text, null, reason),
  };
});

import WaypointDetailScreen from '../WaypointDetailScreen';

const waypoint = {
  id: 'waypoint-1',
  courseId: 'course-1',
  position: 100,
  title: 'Publish the first useful version',
  description: 'Put the work in front of real people.',
  state: 'CURRENT',
  blockedReason: null,
  reachedAt: null,
  skippedAt: null,
  cancelledAt: null,
  anchorLink: null,
};

const nextWaypoint = {
  ...waypoint,
  id: 'waypoint-2',
  position: 200,
  title: 'Learn from the first audience',
  state: 'UPCOMING',
};

const course = {
  id: 'course-1',
  destinationText: 'Build a durable creative practice',
  status: 'ACTIVE',
  version: 7,
  currentWaypointId: waypoint.id,
  waypointCount: 2,
  reachedCount: 0,
  plottedAt: '2026-08-01T00:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  destinationAnchorLink: null,
  waypoints: [waypoint, nextWaypoint],
};

const nonFinalResponse = {
  course: { ...course, version: 8, currentWaypointId: nextWaypoint.id, reachedCount: 1 },
  completedWaypoint: { ...waypoint, state: 'REACHED', reachedAt: '2026-08-21T12:00:00.000Z' },
  nextWaypoint: { ...nextWaypoint, state: 'CURRENT' },
  courseCompleted: false,
  completionEventId: 'event-complete-1',
  replayed: false,
};

describe('WaypointDetailScreen progression behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: {
        id: 'account-1',
        chartCapabilities: {
          canCreateAnchor: true,
          chartReflectionsEnabled: true,
          canCreateOrEditReflections: true,
        },
      },
    };
    mockCourseStore = {
      activeCourse: course,
      flags: { chart_reflections_enabled: true },
      readOnly: false,
      offline: false,
      errorCode: null,
      fetchCourseDetail: jest.fn(),
      linkAnchor: jest.fn().mockResolvedValue({ id: 'course-1' }),
      completeWaypoint: jest.fn(),
      skipWaypoint: jest.fn(),
      cancelWaypoint: jest.fn(),
    };
  });

  it('asks for confirmation without claiming success, and hides inline reflection when capability is denied', () => {
    mockAuthState.user.chartCapabilities.canCreateOrEditReflections = false;
    const screen = render(<WaypointDetailScreen />);

    fireEvent.press(screen.getByLabelText('Mark Waypoint Reached'));

    expect(screen.getByLabelText('Confirm waypoint completion')).toBeTruthy();
    expect(screen.getByText('Mark “Publish the first useful version” reached?')).toBeTruthy();
    expect(screen.queryByText('YOU REACHED A WAYPOINT')).toBeNull();
    expect(screen.queryByLabelText('What helped you get here? Optional')).toBeNull();
    expect(mockCourseStore.completeWaypoint).not.toHaveBeenCalled();
  });

  it('keeps completion and reflection keys stable when the same failed intent is retried', async () => {
    mockCourseStore.completeWaypoint.mockResolvedValue(null);
    const screen = render(<WaypointDetailScreen />);

    fireEvent.press(screen.getByLabelText('Mark Waypoint Reached'));
    fireEvent.changeText(screen.getByLabelText('What helped you get here? Optional'), 'Small, consistent releases');
    fireEvent.changeText(screen.getByLabelText('What did you learn? Optional'), 'Feedback made the next step clearer');
    fireEvent.press(screen.getByLabelText('Confirm Reached'));

    await waitFor(() => expect(mockCourseStore.completeWaypoint).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText(/This waypoint could not be reached/).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByLabelText('Confirm Reached').props.disabled).not.toBe(true));
    fireEvent.press(screen.getByLabelText('Confirm Reached'));
    await waitFor(() => expect(mockCourseStore.completeWaypoint).toHaveBeenCalledTimes(2));

    const firstRequest = mockCourseStore.completeWaypoint.mock.calls[0][2];
    const retryRequest = mockCourseStore.completeWaypoint.mock.calls[1][2];
    expect(retryRequest.idempotencyKey).toBe(firstRequest.idempotencyKey);
    expect(retryRequest.reflection.idempotencyKey).toBe(firstRequest.reflection.idempotencyKey);
    expect(screen.getByLabelText('Confirm waypoint completion')).toBeTruthy();
  });

  it('uses distinct keys for different Anchor link intents', async () => {
    mockCourseStore.linkAnchor.mockResolvedValue(null);
    const screen = render(<WaypointDetailScreen />);

    fireEvent.press(screen.getByLabelText('Link an Existing Anchor'));
    fireEvent.press(screen.getByLabelText('Select anchor-a'));
    await waitFor(() => expect(mockCourseStore.linkAnchor).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByLabelText('Link an Existing Anchor'));
    fireEvent.press(screen.getByLabelText('Select anchor-b'));
    await waitFor(() => expect(mockCourseStore.linkAnchor).toHaveBeenCalledTimes(2));

    expect(mockCourseStore.linkAnchor.mock.calls[0][1].idempotencyKey)
      .not.toBe(mockCourseStore.linkAnchor.mock.calls[1][1].idempotencyKey);
  });

  it('routes a server-confirmed non-final completion to the reached screen and emits real analytics', async () => {
    mockCourseStore.completeWaypoint.mockResolvedValue(nonFinalResponse);
    const screen = render(<WaypointDetailScreen />);

    fireEvent.press(screen.getByLabelText('Mark Waypoint Reached'));
    fireEvent.press(screen.getByLabelText('Confirm Reached'));

    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalledWith('WaypointReached', {
      courseId: 'course-1',
      completedWaypointId: 'waypoint-1',
      nextWaypointId: 'waypoint-2',
      completionEventId: nonFinalResponse.completionEventId,
    }));
    expect(mockTrackChartEventOnce).toHaveBeenCalledWith(
      'waypoint_completion_started',
      'account-1',
      expect.any(String),
      expect.objectContaining({ waypoint_state: 'CURRENT' }),
    );
    expect(mockTrackChartEventOnce).toHaveBeenCalledWith(
      'waypoint_completed',
      'account-1',
      'event-complete-1',
      expect.objectContaining({ server_confirmed: true }),
    );
  });

  it('routes a server-confirmed final completion to Course completion', async () => {
    mockCourseStore.completeWaypoint.mockResolvedValue({
      ...nonFinalResponse,
      course: { ...nonFinalResponse.course, status: 'COMPLETED', completedAt: '2026-08-21T12:00:00.000Z' },
      nextWaypoint: null,
      courseCompleted: true,
    });
    const screen = render(<WaypointDetailScreen />);

    fireEvent.press(screen.getByLabelText('Mark Waypoint Reached'));
    fireEvent.press(screen.getByLabelText('Confirm Reached'));

    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalledWith('CourseCompletion', { courseId: 'course-1' }));
    expect(mockTrackChartEventOnce).toHaveBeenCalledWith(
      'course_completed',
      'account-1',
      'course-1',
      expect.objectContaining({ server_confirmed: true }),
    );
  });
});
