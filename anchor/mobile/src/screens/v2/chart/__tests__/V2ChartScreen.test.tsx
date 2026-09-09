import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { V2ChartScreen } from '../V2ChartScreen';
import { useCourseStore } from '@/stores/courseStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { apiClient } from '@/services/ApiClient';
import type { CourseDetail } from '@/types/chart';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  }),
  useRoute: () => ({
    params: { courseId: 'course-1', anchorId: 'anchor-1' },
  }),
}));

// Mock apiClient
jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    status?: number;
    code?: string;
  },
}));

describe('V2ChartScreen', () => {
  const mockCourse: CourseDetail = {
    id: 'course-1',
    destinationText: 'Launch product to 10k users',
    status: 'ACTIVE',
    version: 2,
    currentWaypointId: 'wp-2',
    waypointCount: 3,
    reachedCount: 1,
    plottedAt: '2026-09-01T00:00:00Z',
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
    waypoints: [
      {
        id: 'wp-1',
        courseId: 'course-1',
        position: 0,
        title: 'Prototype ready',
        description: 'First functional prototype',
        state: 'REACHED',
        reachedAt: '2026-09-02T00:00:00Z',
        skippedAt: null,
        cancelledAt: null,
        blockedReason: null,
        anchorLink: null,
      },
      {
        id: 'wp-2',
        courseId: 'course-1',
        position: 1,
        title: '500 beta signups',
        description: 'Contact 5 community leads\nPublish build diary',
        state: 'CURRENT',
        reachedAt: null,
        skippedAt: null,
        cancelledAt: null,
        blockedReason: null,
        anchorLink: null,
      },
      {
        id: 'wp-3',
        courseId: 'course-1',
        position: 2,
        title: '10,000 active users',
        description: 'Full public launch',
        state: 'UPCOMING',
        reachedAt: null,
        skippedAt: null,
        cancelledAt: null,
        blockedReason: null,
        anchorLink: null,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCourseStore.setState({
      activeCourse: mockCourse,
      courses: [mockCourse],
      loading: false,
    });
    useAnchorStore.setState({
      anchors: [
        {
          id: 'anchor-1',
          intention: 'I build with focus',
          category: 'Career',
          threadStrength: 80,
          status: 'ACTIVE',
          createdAt: '2026-09-01T00:00:00Z',
        } as any,
      ],
    });
  });

  it('loads real Course and Waypoint entities and displays Destination', async () => {
    const { getByText, getByTestId } = render(
      <V2ChartScreen courseId="course-1" anchorId="anchor-1" />,
    );

    expect(getByTestId('v2-chart-screen')).toBeTruthy();
    expect(getByText('Launch product to 10k users')).toBeTruthy();
    expect(getByText('1 of 3 waypoints reached')).toBeTruthy();
  });

  it('preserves current waypoint authority and reflects One Move', async () => {
    const { getByText, getByTestId } = render(
      <V2ChartScreen courseId="course-1" anchorId="anchor-1" />,
    );

    expect(getByTestId('v2-one-move-card')).toBeTruthy();
    expect(getByText('Reach 500 beta signups')).toBeTruthy();
    expect(getByText('Contact 5 community leads')).toBeTruthy();
  });

  it('operates fully without a connected Vision', () => {
    const { getByText, queryByText } = render(
      <V2ChartScreen courseId="course-1" anchorId="anchor-1" />,
    );

    // Shows Vision button/pill for optional attachment, but screen functions without error
    expect(getByText('Vision')).toBeTruthy();
    expect(queryByText('Connected Vision')).toBeNull();
  });

  it('waypoint reached flow triggers confirmation modal and server call without duplicates', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { success: true },
    });

    const { getByTestId, findByTestId, getByText } = render(
      <V2ChartScreen courseId="course-1" anchorId="anchor-1" />,
    );

    // Click reached prompt
    fireEvent.press(getByTestId('reached-waypoint-prompt'));

    // Confirm button in modal
    const confirmBtn = await findByTestId('confirm-waypoint-reached-btn');
    expect(confirmBtn).toBeTruthy();

    // Click confirm
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/courses/course-1/waypoints/wp-2/complete'),
        expect.objectContaining({
          expectedCourseVersion: 2,
        }),
      );
    });

    // Celebration modal shows
    await waitFor(() => {
      expect(getByText('Waypoint reached.')).toBeTruthy();
    });
  });
});
