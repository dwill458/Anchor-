import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};
let mockRoute: any;
let mockCourseStore: any;
let mockCourseLogStore: any;
let mockAuthState: any;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: () => mockCourseStore }));
jest.mock('@/stores/courseLogStore', () => ({ useCourseLogStore: () => mockCourseLogStore }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: any) => unknown) => selector(mockAuthState),
}));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useReduceMotionEnabled: () => true }));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: { COURSE_COMPLETED: 'course_completed', COURSE_LOG_VIEWED: 'course_log_viewed' },
  trackChartEventOnce: jest.fn(),
}));
jest.mock('../components/CourseMap', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return { CourseMap: () => ReactModule.createElement(View, { testID: 'completed-course-map' }) };
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
    ChartStatusPill: ({ status }: any) => ReactModule.createElement(Text, null, status),
    formatDate: (value: string) => value,
  };
});

import CourseCompletionScreen from '../CourseCompletionScreen';
import CompletedJourneyScreen from '../CompletedJourneyScreen';
import CourseLogScreen from '../CourseLogScreen';

const historicalAnchor = {
  id: 'link-1',
  role: 'WAYPOINT_PRIMARY',
  anchorId: null,
  anchorAvailable: false,
  linkedAt: '2026-08-01T00:00:00.000Z',
  snapshot: {
    snapshotVersion: 1,
    anchorId: 'anchor-1',
    intentionText: 'I release useful work consistently.',
    category: 'creative',
    planetaryTier: null,
    enhancedImageUrl: 'https://example.com/historical-anchor.png',
    releasedAtUnlink: true,
    capturedAt: '2026-08-01T00:00:00.000Z',
  },
};

const completedCourse = {
  id: 'course-1',
  destinationText: 'Publish a meaningful portfolio',
  startingContext: 'Two complete pieces and no publishing rhythm',
  status: 'COMPLETED',
  version: 9,
  currentWaypointId: null,
  waypointCount: 1,
  reachedCount: 1,
  plottedAt: '2026-08-01T00:00:00.000Z',
  completedAt: '2026-08-21T00:00:00.000Z',
  archivedAt: null,
  destinationAnchorLink: null,
  waypoints: [{
    id: 'waypoint-1',
    courseId: 'course-1',
    position: 100,
    title: 'Publish the first useful version',
    description: null,
    state: 'REACHED',
    blockedReason: null,
    reachedAt: '2026-08-21T00:00:00.000Z',
    skippedAt: null,
    cancelledAt: null,
    anchorLink: historicalAnchor,
  }],
};

const practiceEntry = {
  id: 'event-practice',
  eventType: 'PRACTICE_COMPLETED',
  message: 'Practice completed.',
  waypointId: 'waypoint-1',
  occurredAt: '2026-08-20T00:00:00.000Z',
  recordedAt: '2026-08-20T00:00:01.000Z',
  snapshot: null,
  reflection: null,
  practiceSession: { id: 'session-1', practiceMode: 'focus', completedDurationSeconds: 600 },
  anchorLink: historicalAnchor,
};

const reachedEntry = {
  id: 'event-reached',
  eventType: 'WAYPOINT_REACHED',
  message: 'Waypoint reached.',
  waypointId: 'waypoint-1',
  occurredAt: '2026-08-21T00:00:00.000Z',
  recordedAt: '2026-08-21T00:00:01.000Z',
  snapshot: { waypointTitle: 'Publish the first useful version' },
  reflection: null,
  practiceSession: null,
  anchorLink: historicalAnchor,
};

describe('Chart completion and historical evidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: {
        id: 'account-1',
        chartCapabilities: { canCreateOrEditReflections: true },
      },
    };
    mockCourseStore = {
      activeCourse: completedCourse,
      courses: [completedCourse],
      flags: { chart_reflections_enabled: true },
      readOnly: false,
      fetchCourseDetail: jest.fn(),
    };
    mockCourseLogStore = {
      entries: [practiceEntry, reachedEntry],
      refreshing: false,
      loading: false,
      errorCode: null,
      bind: jest.fn(),
      refresh: jest.fn(),
      loadMore: jest.fn(),
    };
  });

  it('shows the authoritative starting context on destination completion', () => {
    mockRoute = { key: 'completion-route', params: { courseId: 'course-1' } };
    const screen = render(<CourseCompletionScreen />);

    expect(screen.getByText('You began this Course from: Two complete pieces and no publishing rhythm')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('View Your Journey'));
    expect(mockNavigation.replace).toHaveBeenCalledWith('CompletedJourney', { courseId: 'course-1' });
  });

  it('preserves starting context and historical Anchor snapshots in the completed journey', () => {
    mockRoute = { key: 'journey-route', params: { courseId: 'course-1' } };
    const screen = render(<CompletedJourneyScreen />);

    expect(screen.getByText('Starting from · Two complete pieces and no publishing rhythm')).toBeTruthy();
    expect(screen.getByText('HISTORICAL ANCHOR')).toBeTruthy();
    expect(screen.getByText('“I release useful work consistently.”')).toBeTruthy();
    expect(screen.getByTestId('completed-course-map')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open Course Log and Practice Evidence'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CourseLog', { courseId: 'course-1' });
  });

  it('renders real Practice and Waypoint events from the account-bound Course Log', async () => {
    mockRoute = { key: 'log-route', params: { courseId: 'course-1' } };
    const screen = render(<CourseLogScreen />);

    await waitFor(() => expect(mockCourseLogStore.bind).toHaveBeenCalledWith('account-1', 'course-1'));
    expect(screen.getByText('Completed a focus practice.')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();
    expect(screen.getByText('Publish the first useful version reached.')).toBeTruthy();
    expect(screen.getAllByText('Released Anchor.')).toHaveLength(2);
  });
});
