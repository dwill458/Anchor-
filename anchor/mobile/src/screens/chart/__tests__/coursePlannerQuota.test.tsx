/**
 * Phase 0 amendment F1 on the client: the mobile app may display
 * server-returned quota state, but never computes or authorizes generation.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  return {
    __mockNavigation: navigation,
    useNavigation: () => navigation,
    useRoute: () => ({ params: {} }),
  };
});
jest.mock('@/services/ChartApiClient', () => ({
  chartApiClient: { generateCoursePlan: jest.fn(), getCoursePlanQuota: jest.fn() },
  getChartErrorCode: jest.fn(),
}));
jest.mock('@/stores/courseStore', () => ({ useCourseStore: jest.fn() }));

import { CourseSetupScreen } from '../CourseSetupScreen';

const chartApi = jest.requireMock('@/services/ChartApiClient');
const mockGenerateCoursePlan = chartApi.chartApiClient.generateCoursePlan as jest.Mock;
const mockGetCoursePlanQuota = chartApi.chartApiClient.getCoursePlanQuota as jest.Mock;
const mockGetChartErrorCode = chartApi.getChartErrorCode as jest.Mock;
const mockUseCourseStore = jest.requireMock('@/stores/courseStore').useCourseStore as jest.Mock;

function storeState(overrides: Record<string, unknown> = {}) {
  return {
    offline: false,
    readOnly: false,
    loading: false,
    flags: { chart_ai_planner_enabled: true, chart_write_enabled: true },
    createManualCourse: jest.fn(),
    ...overrides,
  };
}

function quota(overrides: Record<string, unknown> = {}) {
  return {
    eligible: true,
    limit: 3,
    remaining: 2,
    resetAt: null,
    reason: null,
    ...overrides,
  };
}

describe('CourseSetupScreen — planner quota presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCourseStore.mockReturnValue(storeState());
    mockGetCoursePlanQuota.mockResolvedValue({ data: quota() });
    mockGetChartErrorCode.mockReturnValue(undefined);
  });

  it('displays server-returned remaining plans without computing them', async () => {
    const screen = render(<CourseSetupScreen />);

    await waitFor(() => expect(screen.getByText('2 suggested plans left.')).toBeTruthy());
    expect(mockGetCoursePlanQuota).toHaveBeenCalledTimes(1);
  });

  it('disables generation when the server reports the account is ineligible', async () => {
    mockGetCoursePlanQuota.mockResolvedValue({
      data: quota({ eligible: false, remaining: 0, reason: 'quota_exhausted' }),
    });

    const screen = render(<CourseSetupScreen />);

    await waitFor(() => expect(screen.getByText('No suggested plans left right now.')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Generate suggested plan'));
    expect(mockGenerateCoursePlan).not.toHaveBeenCalled();
  });

  it('restates an entitlement denial without offering a bypass', async () => {
    mockGetCoursePlanQuota.mockResolvedValue({
      data: quota({ eligible: false, remaining: 0, limit: 0, reason: 'entitlement_expired' }),
    });

    const screen = render(<CourseSetupScreen />);

    await waitFor(() =>
      expect(
        screen.getByText('Suggested plans are not available on your current plan.'),
      ).toBeTruthy(),
    );
  });

  it('does not request quota or allow generation while offline', async () => {
    mockUseCourseStore.mockReturnValue(storeState({ offline: true, readOnly: true }));

    const screen = render(<CourseSetupScreen />);

    await waitFor(() => expect(screen.getByLabelText('Generate suggested plan')).toBeTruthy());
    expect(mockGetCoursePlanQuota).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Generate suggested plan'));
    expect(mockGenerateCoursePlan).not.toHaveBeenCalled();
  });

  it('hides the planner surface entirely when the server flag is off', async () => {
    mockUseCourseStore.mockReturnValue(
      storeState({ flags: { chart_ai_planner_enabled: false, chart_write_enabled: true } }),
    );

    const screen = render(<CourseSetupScreen />);

    expect(screen.queryByLabelText('Generate suggested plan')).toBeNull();
    expect(mockGetCoursePlanQuota).not.toHaveBeenCalled();
  });

  it('surfaces a server quota denial raised at generation time', async () => {
    mockGenerateCoursePlan.mockRejectedValue(new Error('denied'));
    mockGetChartErrorCode.mockReturnValue('PLANNER_QUOTA_EXCEEDED');

    const screen = render(<CourseSetupScreen />);
    await waitFor(() => expect(mockGetCoursePlanQuota).toHaveBeenCalled());

    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Complete a portfolio');
    fireEvent.press(screen.getByLabelText('Generate suggested plan'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'You have used all of your suggested plans for now. You can still build a Course yourself.',
        ),
      ).toBeTruthy(),
    );
    // The denial refreshes quota from the server rather than decrementing locally.
    expect(mockGetCoursePlanQuota).toHaveBeenCalledTimes(2);
  });

  it('does not treat an unreadable quota response as permission or as a denial', async () => {
    mockGetCoursePlanQuota.mockRejectedValue(new Error('network'));
    mockGenerateCoursePlan.mockResolvedValue({ data: { proposalId: 'proposal-1' } });

    const screen = render(<CourseSetupScreen />);
    await waitFor(() => expect(mockGetCoursePlanQuota).toHaveBeenCalled());

    expect(screen.queryByLabelText('Suggested plan availability')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Complete a portfolio');
    fireEvent.press(screen.getByLabelText('Generate suggested plan'));

    // The request is allowed to reach the server, which is the only authority.
    await waitFor(() => expect(mockGenerateCoursePlan).toHaveBeenCalledTimes(1));
  });

  it('sends only the destination and an idempotency key', async () => {
    mockGenerateCoursePlan.mockResolvedValue({ data: { proposalId: 'proposal-1' } });

    const screen = render(<CourseSetupScreen />);
    await waitFor(() => expect(mockGetCoursePlanQuota).toHaveBeenCalled());

    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Complete a portfolio');
    fireEvent.press(screen.getByLabelText('Generate suggested plan'));

    await waitFor(() => expect(mockGenerateCoursePlan).toHaveBeenCalledTimes(1));
    const request = mockGenerateCoursePlan.mock.calls[0][0];
    expect(Object.keys(request).sort()).toEqual(['destinationText', 'idempotencyKey']);
    expect(request.destinationText).toBe('Complete a portfolio');
  });

  it('reuses one idempotency key across repeated taps on the same screen', async () => {
    mockGenerateCoursePlan.mockResolvedValue({ data: { proposalId: 'proposal-1' } });

    const screen = render(<CourseSetupScreen />);
    await waitFor(() => expect(mockGetCoursePlanQuota).toHaveBeenCalled());
    fireEvent.changeText(screen.getByLabelText('Course destination'), 'Complete a portfolio');

    fireEvent.press(screen.getByLabelText('Generate suggested plan'));
    await waitFor(() => expect(mockGenerateCoursePlan).toHaveBeenCalledTimes(1));

    // The button is briefly disabled while the first request is in flight, so
    // retry until the second tap is actually accepted.
    await waitFor(() => {
      fireEvent.press(screen.getByLabelText('Generate suggested plan'));
      expect(mockGenerateCoursePlan).toHaveBeenCalledTimes(2);
    });

    const [first] = mockGenerateCoursePlan.mock.calls[0];
    const [second] = mockGenerateCoursePlan.mock.calls[1];
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
});
