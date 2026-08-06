import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  return {
    __mockNavigation: navigation,
    useNavigation: () => navigation,
    useRoute: () => ({ params: { courseId: null, proposalId: 'proposal-1' } }),
  };
});
jest.mock('@/services/ChartApiClient', () => ({
  chartApiClient: { getCoursePlan: jest.fn(), acceptCoursePlan: jest.fn() },
  getChartErrorCode: jest.fn(),
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: jest.fn() }));

import AIPlanReviewScreen from '../AIPlanReviewScreen';

const mockNavigation = jest.requireMock('@react-navigation/native')
  .__mockNavigation as {
  navigate: jest.Mock;
  goBack: jest.Mock;
};
const mockChartApi = jest.requireMock('@/services/ChartApiClient')
  .chartApiClient as {
  getCoursePlan: jest.Mock;
  acceptCoursePlan: jest.Mock;
};
const mockUseCourseStore = jest.requireMock('@/stores/courseStore')
  .useCourseStore as jest.Mock;
const mockRefresh = jest.fn();

const proposal = {
  proposalId: 'proposal-1',
  courseId: null,
  baseCourseVersion: null,
  plannerVersion: '1',
  modelVersion: 'deterministic-v1',
  inputHash: 'hash',
  generationSource: 'deterministic_fallback' as const,
  fallbackReason: 'unavailable_or_invalid',
  destinationInterpretation: 'Finish a portfolio',
  waypoints: [
    {
      clientKey: 'key-1',
      title: 'Clarify the target',
      description: 'Define a useful result.',
    },
  ],
  createdAt: '2026-08-03T00:00:00.000Z',
  expiresAt: '2026-08-03T00:30:00.000Z',
};

describe('AIPlanReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCourseStore.mockReturnValue({
      offline: false,
      flags: { chart_write_enabled: true },
      refresh: mockRefresh,
    });
    mockChartApi.getCoursePlan.mockResolvedValue({ data: proposal });
  });

  it('shows only the validated proposal and dismisses without a mutation', async () => {
    const screen = render(<AIPlanReviewScreen />);
    await waitFor(() =>
      expect(screen.getByText('Finish a portfolio')).toBeTruthy(),
    );
    expect(
      screen.getByLabelText('Waypoint 1: Clarify the target'),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back without changes'));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockChartApi.acceptCoursePlan).not.toHaveBeenCalled();
  });

  it('requires an explicit acceptance action before creating a Course', async () => {
    mockChartApi.acceptCoursePlan.mockResolvedValue({
      data: { id: 'course-1' },
    });
    const screen = render(<AIPlanReviewScreen />);
    await waitFor(() =>
      expect(
        screen.getByLabelText('Accept plan and create Course'),
      ).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText('Accept plan and create Course'));
    await waitFor(() =>
      expect(mockChartApi.acceptCoursePlan).toHaveBeenCalledWith(
        'proposal-1',
        expect.any(String),
      ),
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ChartHome');
  });
});
