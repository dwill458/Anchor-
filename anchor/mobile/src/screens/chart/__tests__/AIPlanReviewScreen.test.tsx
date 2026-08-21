import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
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
const mockAuthState = {
  user: {
    id: 'account-1',
    chartCapabilities: { canAcceptExistingChartPlan: true },
  },
};
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));
const mockAnalyticsTrack = jest.fn();
const mockTrackChartEventOnce = jest.fn();
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    CHART_PLANNER_PROPOSAL_VIEWED: 'proposal_viewed',
    CHART_PLANNER_PROPOSAL_ACCEPTED: 'proposal_accepted',
    CHART_PLANNER_PROPOSAL_DISMISSED: 'proposal_dismissed',
  },
  AnalyticsService: { track: (...args: unknown[]) => mockAnalyticsTrack(...args) },
  trackChartEventOnce: (...args: unknown[]) => mockTrackChartEventOnce(...args),
}));

import AIPlanReviewScreen from '../AIPlanReviewScreen';

const mockNavigation = jest.requireMock('@react-navigation/native')
  .__mockNavigation as {
  navigate: jest.Mock;
  replace: jest.Mock;
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
  startingContext: 'Two strong pieces and no consistent publishing rhythm',
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
    mockAuthState.user.chartCapabilities.canAcceptExistingChartPlan = true;
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
    expect(screen.getByText('Two strong pieces and no consistent publishing rhythm')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reject this suggestion'));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockChartApi.acceptCoursePlan).not.toHaveBeenCalled();
  });

  it('requires capability and an explicit acceptance action before activating the Course', async () => {
    mockChartApi.acceptCoursePlan.mockResolvedValue({
      data: { id: 'course-1', status: 'ACTIVE', currentWaypointId: 'waypoint-1' },
    });
    const screen = render(<AIPlanReviewScreen />);
    await waitFor(() =>
      expect(
        screen.getByLabelText('Use this Course'),
      ).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText('Use this Course'));
    await waitFor(() =>
      expect(mockChartApi.acceptCoursePlan).toHaveBeenCalledWith(
        'proposal-1',
        expect.any(String),
      ),
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockNavigation.replace).toHaveBeenCalledWith('WaypointActivation', {
      courseId: 'course-1',
      waypointId: 'waypoint-1',
    });
  });

  it('fails closed when the server capability projection does not allow acceptance', async () => {
    mockAuthState.user.chartCapabilities.canAcceptExistingChartPlan = false;
    const screen = render(<AIPlanReviewScreen />);
    await waitFor(() => expect(screen.getByLabelText('Use this Course')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Use this Course'));

    expect(mockChartApi.acceptCoursePlan).not.toHaveBeenCalled();
  });

  it('opens proposal-backed setup for explicit editing or regeneration', async () => {
    const screen = render(<AIPlanReviewScreen />);
    await waitFor(() => expect(screen.getByLabelText('Edit or regenerate')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Edit or regenerate'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('CourseSetup', {
      fromProposalId: 'proposal-1',
    });
    expect(mockAnalyticsTrack).toHaveBeenCalledWith(
      'chart_planner_proposal_edit_selected',
      expect.objectContaining({ waypoint_count: 1 }),
    );
  });
});
