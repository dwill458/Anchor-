import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

jest.mock('@react-navigation/native', () => {
  const navigation = { navigate: jest.fn() };
  return {
    __mockNavigation: navigation,
    useNavigation: () => navigation,
    useRoute: () => ({ key: 'chart-home', params: {} }),
  };
});
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: jest.fn() }));
jest.mock('@/stores/courseLogStore', () => ({ useCourseLogStore: jest.fn() }));
jest.mock('@/services/ReflectionService', () => ({ startReflectionQueueSync: jest.fn() }));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: { CHART_TAB_VIEWED: 'chart_tab_viewed', CHART_UNAVAILABLE_VIEWED: 'chart_unavailable_viewed', COURSE_VIEWED: 'course_viewed' },
  trackChartEventOnce: jest.fn(),
}));
jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({ registerTabNav: jest.fn() }),
}));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useReduceMotionEnabled: () => false }));
jest.mock('@/types/chart', () => ({
  ...jest.requireActual('@/types/chart'),
  canViewChart: () => true,
}));
jest.mock('@/components/LoadingSpinner', () => {
  const mockReact = require('react');
  const { Text: MockText } = require('react-native');
  return { LoadingSpinner: () => mockReact.createElement(MockText, null, 'Loading Chart') };
});
jest.mock('../components/CourseMap', () => {
  const mockReact = require('react');
  const { View: MockView } = require('react-native');
  return { CourseMap: () => mockReact.createElement(MockView, { testID: 'course-map' }) };
});
jest.mock('../chartUi', () => {
  const mockReact = require('react');
  const { Pressable: MockPressable, Text: MockText, View: MockView } = require('react-native');
  const button = ({ label, onPress, disabled }: any) => mockReact.createElement(MockPressable, {
    accessibilityRole: 'button', accessibilityLabel: label, onPress, disabled,
  }, mockReact.createElement(MockText, null, label));
  return {
    ChartScreenFrame: ({ children, headerActions }: any) => mockReact.createElement(MockView, null, headerActions, children),
    ChartButton: button,
    ChartCard: ({ children }: any) => mockReact.createElement(MockView, null, children),
    ChartGhostButton: button,
    ChartIconButton: ({ label, onPress }: any) => mockReact.createElement(MockPressable, {
      accessibilityRole: 'button', accessibilityLabel: label, onPress,
    }, mockReact.createElement(MockText, null, label)),
    ChartKicker: ({ children }: any) => mockReact.createElement(MockText, null, children),
    ChartSection: ({ children }: any) => mockReact.createElement(MockView, null, children),
    ChartSyncNotice: () => mockReact.createElement(MockText, null, 'Sync notice'),
    LinearWaypointList: () => mockReact.createElement(MockView, { testID: 'waypoint-list' }),
    ReadOnlyNotice: ({ reason }: any) => mockReact.createElement(MockText, null, reason),
    formatDate: (value: string) => value,
  };
});

import { ChartHomeScreen } from '../ChartHomeScreen';

const mockUseAuthStore = jest.requireMock('@/stores/authStore').useAuthStore as jest.Mock;
const mockUseCourseStore = jest.requireMock('@/stores/courseStore').useCourseStore as jest.Mock;
const mockUseCourseLogStore = jest.requireMock('@/stores/courseLogStore').useCourseLogStore as jest.Mock;
const startReflectionQueueSync = jest.requireMock('@/services/ReflectionService').startReflectionQueueSync as jest.Mock;

const currentWaypoint = {
  id: 'waypoint-1',
  courseId: 'course-1',
  position: 0,
  title: 'Deepen the practice',
  description: 'Make time for the work that matters.',
  state: 'CURRENT',
  blockedReason: null,
  reachedAt: null,
  skippedAt: null,
  cancelledAt: null,
  anchorLink: {
    id: 'link-1',
    role: 'WAYPOINT_PRIMARY',
    anchorId: 'anchor-1',
    anchorAvailable: true,
    linkedAt: '2026-08-01T00:00:00.000Z',
    snapshot: {
      snapshotVersion: 1,
      anchorId: 'anchor-1',
      intentionText: 'Create with care',
      category: 'creative',
      planetaryTier: null,
      enhancedImageUrl: null,
      releasedAtUnlink: false,
      capturedAt: '2026-08-01T00:00:00.000Z',
    },
  },
};

const course = {
  id: 'course-1',
  destinationText: 'Build a steadier creative practice',
  status: 'ACTIVE',
  version: 3,
  currentWaypointId: 'waypoint-1',
  waypointCount: 1,
  reachedCount: 0,
  plottedAt: '2026-08-01T00:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  destinationAnchorLink: null,
  observations: [],
  waypoints: [currentWaypoint],
};

describe('ChartHomeScreen — truthful Chart copy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const auth = {
      user: {
        id: 'account-1',
        chartFlags: { chart_enabled: true, chart_write_enabled: true },
        chartCapabilities: undefined,
      },
      isOfflineMode: false,
    };
    mockUseAuthStore.mockImplementation((selector: (state: typeof auth) => unknown) => selector(auth));
    mockUseCourseStore.mockReturnValue({
      activeCourse: course,
      courses: [course],
      flags: { chart_enabled: true, chart_write_enabled: true },
      offline: false,
      stale: false,
      readOnly: false,
      migrationRequired: false,
      loading: false,
      refreshing: false,
      initializationStatus: 'ready',
      errorCode: null,
      lastSyncedAt: Date.now(),
      bindAccount: jest.fn(),
      hydrateAndRefresh: jest.fn(),
      setFeatureFlags: jest.fn(),
    });
    mockUseCourseLogStore.mockReturnValue({ entries: [], loading: false, bind: jest.fn() });
  });

  it('starts reflection queue sync once and renders only server-backed waypoint copy', async () => {
    const screen = render(<ChartHomeScreen />);

    await waitFor(() => expect(startReflectionQueueSync).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Make time for the work that matters.')).toBeTruthy();
    expect(screen.getAllByText('LINKED ANCHOR')).toHaveLength(2);
    expect(screen.queryByText('3 anchored sessions this week')).toBeNull();
    expect(screen.queryByText('LINKED TO 1K USERS')).toBeNull();
    expect(screen.queryByText(/first thousand people/i)).toBeNull();
    expect(screen.queryByText('Jul 18')).toBeNull();
  });

  it('does not expose a Chart notification control and retains the course menu', () => {
    const screen = render(<ChartHomeScreen />);

    expect(screen.queryByLabelText('Chart notifications')).toBeNull();
    fireEvent.press(screen.getByLabelText('Chart menu'));
    expect(jest.requireMock('@react-navigation/native').__mockNavigation.navigate).toHaveBeenCalledWith('CourseDetails', { courseId: 'course-1' });
  });
});
