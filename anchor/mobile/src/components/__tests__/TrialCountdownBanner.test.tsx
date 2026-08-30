import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TrialCountdownBanner } from '../TrialCountdownBanner';

const mockUseTrialStatus = jest.fn();
const mockTrack = jest.fn();

jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => mockUseTrialStatus(),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    TRIAL_BANNER_VIEWED: 'trial_banner_viewed',
    TRIAL_BANNER_TAPPED: 'trial_banner_tapped',
    UPGRADE_INITIATED: 'upgrade_initiated',
  },
  AnalyticsService: {
    track: (...args: unknown[]) => mockTrack(...args),
  },
}));

describe('TrialCountdownBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTrialStatus.mockReturnValue({
      isTrialActive: true,
      daysRemaining: 3,
    });
  });

  it('renders active no-card trial countdown context', async () => {
    const { getByText } = render(
      <TrialCountdownBanner surface="practice_home" onPressUpgrade={jest.fn()} />
    );

    expect(getByText('DAY 5/7')).toBeTruthy();
    expect(getByText('3 days left · no card on file')).toBeTruthy();
    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith('trial_banner_viewed', {
        surface: 'practice_home',
        trial_days_remaining: 3,
        trial_day: 5,
      });
    });
  });

  it('does not render when trial is inactive', () => {
    mockUseTrialStatus.mockReturnValue({
      isTrialActive: false,
      daysRemaining: 0,
    });

    const { queryByText } = render(
      <TrialCountdownBanner surface="practice_home" onPressUpgrade={jest.fn()} />
    );

    expect(queryByText('Free trial')).toBeNull();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('tracks tap and forwards trial context to upgrade handler', () => {
    const onPressUpgrade = jest.fn();
    const { getByLabelText } = render(
      <TrialCountdownBanner surface="practice_home" onPressUpgrade={onPressUpgrade} />
    );

    fireEvent.press(getByLabelText('Free trial, day 5 of 7. See plans.'));

    expect(mockTrack).toHaveBeenCalledWith('trial_banner_tapped', {
      surface: 'practice_home',
      trial_days_remaining: 3,
      trial_day: 5,
    });
    expect(mockTrack).toHaveBeenCalledWith('upgrade_initiated', {
      source: 'trial_banner',
      surface: 'practice_home',
      trial_days_remaining: 3,
    });
    expect(onPressUpgrade).toHaveBeenCalledWith({
      daysRemaining: 3,
      trialDay: 5,
    });
  });
});
