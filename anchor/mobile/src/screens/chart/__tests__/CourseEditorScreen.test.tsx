import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

let mockCourseStore: any;
const mockNavigateToVault = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { courseId: 'course-1' } }),
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: () => mockCourseStore }));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: any) => unknown) => selector({ getActiveAnchors: () => [] }),
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: any) => unknown) => selector({ user: { subscriptionStatus: 'premium' } }),
}));
jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({ navigateToVault: mockNavigateToVault }),
}));
jest.mock('@/screens/practice/components/AnchorSelectorSheet', () => ({ AnchorSelectorSheet: () => null }));
jest.mock('../chartUi', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  const button = ({ label, onPress, disabled }: any) => ReactModule.createElement(
    Pressable,
    { accessibilityRole: 'button', accessibilityLabel: label, disabled, onPress },
    ReactModule.createElement(Text, null, label),
  );
  return {
    ChartScreenFrame: ({ title, subtitle, children }: any) => ReactModule.createElement(View, null,
      ReactModule.createElement(Text, null, title),
      subtitle ? ReactModule.createElement(Text, null, subtitle) : null,
      children,
    ),
    ChartButton: button,
    ChartCard: ({ children }: any) => ReactModule.createElement(View, null, children),
    ChartStatusPill: ({ status }: any) => ReactModule.createElement(Text, null, status),
    ReadOnlyNotice: ({ reason }: any) => ReactModule.createElement(Text, null, reason),
  };
});

import CourseEditorScreen from '../CourseEditorScreen';

const course = {
  id: 'course-1',
  destinationText: 'Build a durable creative practice',
  status: 'DRAFT',
  version: 3,
  currentWaypointId: null,
  waypointCount: 0,
  reachedCount: 0,
  plottedAt: '2026-08-01T00:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  destinationAnchorLink: null,
  waypoints: [],
};

describe('CourseEditorScreen waypoint mutation keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCourseStore = {
      activeCourse: course,
      readOnly: false,
      offline: false,
      fetchCourseDetail: jest.fn(),
      updateCourse: jest.fn(),
      editWaypoint: jest.fn(),
      reorderWaypoints: jest.fn(),
      addWaypoint: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(course)
        .mockResolvedValueOnce(course),
      linkAnchor: jest.fn(),
      publishCourse: jest.fn(),
    };
  });

  it('reuses a key for the same failed add intent and creates a new key for the next waypoint', async () => {
    const screen = render(<CourseEditorScreen />);
    const titleInput = screen.getByLabelText('New waypoint title');

    fireEvent.changeText(titleInput, 'Choose the direction');
    fireEvent.press(screen.getByLabelText('Add waypoint'));
    await waitFor(() => expect(mockCourseStore.addWaypoint).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByLabelText('Add waypoint'));
    await waitFor(() => expect(mockCourseStore.addWaypoint).toHaveBeenCalledTimes(2));

    fireEvent.changeText(screen.getByLabelText('New waypoint title'), 'Publish the first useful version');
    fireEvent.press(screen.getByLabelText('Add waypoint'));
    await waitFor(() => expect(mockCourseStore.addWaypoint).toHaveBeenCalledTimes(3));

    const firstKey = mockCourseStore.addWaypoint.mock.calls[0][1].idempotencyKey;
    const retryKey = mockCourseStore.addWaypoint.mock.calls[1][1].idempotencyKey;
    const nextWaypointKey = mockCourseStore.addWaypoint.mock.calls[2][1].idempotencyKey;
    expect(retryKey).toBe(firstKey);
    expect(nextWaypointKey).not.toBe(firstKey);
  });
});
