import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigation = { replace: jest.fn(), navigate: jest.fn() };
let mockRouteParams: Record<string, string> = {};
let mockCourseStore: any;
let mockAuthState: any;
const mockNavigateToVault = jest.fn();
const mockAnchors = [
  { id: 'anchor-a', intentionText: 'Return to the work', category: 'creative' },
];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: () => mockCourseStore }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: any) => unknown) => selector(mockAuthState),
}));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: any) => unknown) => selector({ getActiveAnchors: () => mockAnchors }),
}));
jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({ navigateToVault: mockNavigateToVault }),
}));
jest.mock('@/screens/practice/components/AnchorSelectorSheet', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    AnchorSelectorSheet: ({ visible, anchors, onSelect }: any) => visible
      ? ReactModule.createElement(
        View,
        null,
        anchors.map((anchor: any) => ReactModule.createElement(
          Pressable,
          { key: anchor.id, accessibilityRole: 'button', accessibilityLabel: `Select ${anchor.id}`, onPress: () => onSelect(anchor) },
          ReactModule.createElement(Text, null, anchor.intentionText),
        )),
      )
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
    ChartHair: () => ReactModule.createElement(View, { testID: 'hair' }),
    ChartKicker: ({ children }: any) => ReactModule.createElement(Text, null, children),
    ChartStatusTag: ({ status }: any) => ReactModule.createElement(Text, null, status),
    ReadOnlyNotice: ({ reason }: any) => ReactModule.createElement(Text, null, reason),
    formatDate: (value: string) => value,
  };
});
jest.mock('../components/MiniRoute', () => ({
  MiniRoute: ({ testID }: any) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, { testID });
  },
}));
jest.mock('../components/CourseMap', () => ({
  CourseMap: ({ advancement }: any) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, {
      testID: 'reached-course-map',
      accessibilityLabel: `Advancement ${advancement?.eventId ?? 'none'}`,
    });
  },
}));
jest.mock('@/hooks/useReduceMotionEnabled', () => ({ useReduceMotionEnabled: () => false }));
jest.mock('../components/Ico', () => ({
  Ico: () => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, { testID: 'icon' });
  },
}));

import WaypointActivationScreen from '../WaypointActivationScreen';
import WaypointReachedScreen from '../WaypointReachedScreen';

const currentWaypoint = {
  id: 'waypoint-current',
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

const reachedWaypoint = {
  ...currentWaypoint,
  id: 'waypoint-reached',
  title: 'Choose the direction',
  state: 'REACHED',
  reachedAt: '2026-08-21T12:00:00.000Z',
};

function courseWith(waypoints: any[], currentWaypointId: string) {
  return {
    id: 'course-1',
    destinationText: 'Build a durable creative practice',
    status: 'ACTIVE',
    version: 4,
    currentWaypointId,
    waypointCount: waypoints.length,
    reachedCount: waypoints.filter((item) => item.state === 'REACHED').length,
    plottedAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    waypoints,
  };
}

describe('Waypoint progression screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: {
        chartCapabilities: {
          canCreateAnchor: true,
        },
      },
    };
    mockCourseStore = {
      activeCourse: courseWith([currentWaypoint], currentWaypoint.id),
      readOnly: false,
      offline: false,
      fetchCourseDetail: jest.fn(),
      linkAnchor: jest.fn().mockResolvedValue({ id: 'course-1' }),
    };
  });

  it('projects activation copy from ID-selected authoritative Course state', () => {
    mockRouteParams = { courseId: 'course-1', waypointId: currentWaypoint.id };
    const screen = render(<WaypointActivationScreen />);

    expect(screen.getByLabelText(
      'Destination: Build a durable creative practice. Current waypoint: Publish the first useful version. No Anchor linked yet.',
    )).toBeTruthy();
    expect(screen.getByText('Give the next step a form you can return to.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Set Anchor Later'));
    expect(mockNavigation.replace).toHaveBeenCalledWith('WaypointDetail', {
      courseId: 'course-1',
      waypointId: currentWaypoint.id,
    });
  });

  it('presents the confirmed waypoint before the next authoritative Current waypoint', () => {
    mockRouteParams = {
      courseId: 'course-1',
      completedWaypointId: reachedWaypoint.id,
      nextWaypointId: currentWaypoint.id,
      completionEventId: 'event-1',
    };
    mockCourseStore.activeCourse = courseWith([reachedWaypoint, currentWaypoint], currentWaypoint.id);
    const screen = render(<WaypointReachedScreen />);

    expect(screen.getByLabelText(
      'Reached waypoint: Choose the direction. Next current waypoint: Publish the first useful version. No Anchor linked yet.',
    )).toBeTruthy();
    expect(screen.getByText('This Waypoint is now part of your Course history.')).toBeTruthy();
    expect(screen.getByText('This is what you are working toward now.')).toBeTruthy();
    expect(screen.getByLabelText('Advancement event-1')).toBeTruthy();
  });

  it('links an existing Anchor to the next Current waypoint with current server version', async () => {
    mockRouteParams = {
      courseId: 'course-1',
      completedWaypointId: reachedWaypoint.id,
      nextWaypointId: currentWaypoint.id,
      completionEventId: 'event-2',
    };
    mockCourseStore.activeCourse = courseWith([reachedWaypoint, currentWaypoint], currentWaypoint.id);
    const screen = render(<WaypointReachedScreen />);

    fireEvent.press(screen.getByLabelText('Use Existing Anchor'));
    fireEvent.press(screen.getByLabelText('Select anchor-a'));

    await waitFor(() => expect(mockCourseStore.linkAnchor).toHaveBeenCalledWith('course-1', expect.objectContaining({
      expectedCourseVersion: 4,
      anchorId: 'anchor-a',
      waypointId: currentWaypoint.id,
      role: 'WAYPOINT_PRIMARY',
      idempotencyKey: expect.any(String),
    })));
  });
});
