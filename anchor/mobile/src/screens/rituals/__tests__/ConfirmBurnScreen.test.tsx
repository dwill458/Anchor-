import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ConfirmBurnScreen } from '../ConfirmBurnScreen';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({
    params: {
      anchorId: 'test-anchor-id',
      intention: 'I am confident',
      sigilSvg: '<svg></svg>',
      enhancedImageUrl: undefined,
    },
  })),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
}));

jest.mock('@/services/AnalyticsService');
jest.mock('@/services/ErrorTrackingService');
jest.mock('react-native-svg', () => ({
  SvgXml: 'SvgXml',
}));

jest.useFakeTimers();

describe('ConfirmBurnScreen', () => {
  let mockNavigate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate = jest.fn();

    const navigation = require('@react-navigation/native');
    navigation.useNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('renders initial Reflect step with Continue CTA', () => {
    const { getByText } = render(<ConfirmBurnScreen />);

    expect(getByText('Burn & Release')).toBeTruthy();
    expect(getByText('Completed intention')).toBeTruthy();
    expect(getByText('I am confident')).toBeTruthy();
    expect(getByText('If this work is complete, release the symbol.')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('Continue on Reflect step transitions directly to Release step', () => {
    const { getByText, queryByText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(getByText('Final Seal')).toBeTruthy();
    expect(getByText('Typing RELEASE closes the loop permanently.')).toBeTruthy();
    expect(getByText('Burn Now')).toBeTruthy();
    expect(queryByText('Continue')).toBeNull();
  });

  it('Release step shows Not yet button', () => {
    const { getByText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(getByText('Not yet')).toBeTruthy();
  });

  it('Not yet returns to Reflect step', () => {
    const { getByText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    fireEvent.press(getByText('Not yet'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(getByText('If this work is complete, release the symbol.')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('Burn Now is disabled until input equals RELEASE', () => {
    const { getByText, getByPlaceholderText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    const burnButton = getByText('Burn Now');
    // Button is disabled with partial input
    fireEvent.changeText(getByPlaceholderText('Type RELEASE'), 'RELE');
    expect(burnButton).toBeTruthy();

    // Not enabled yet — pressing should not navigate
    fireEvent.press(burnButton);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Burn Now is enabled and navigates once input equals RELEASE', () => {
    const { getByText, getByPlaceholderText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    fireEvent.changeText(getByPlaceholderText('Type RELEASE'), 'RELEASE');
    fireEvent.press(getByText('Burn Now'));

    expect(mockNavigate).toHaveBeenCalledWith('BurningRitual', {
      anchorId: 'test-anchor-id',
      intention: 'I am confident',
      sigilSvg: '<svg></svg>',
      enhancedImageUrl: undefined,
    });
  });

  it('tracks analytics and breadcrumb on Burn Now', () => {
    const { getByText, getByPlaceholderText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    fireEvent.changeText(getByPlaceholderText('Type RELEASE'), 'RELEASE');
    fireEvent.press(getByText('Burn Now'));

    expect(AnalyticsService.track).toHaveBeenCalledWith(AnalyticsEvents.BURN_INITIATED, {
      anchor_id: 'test-anchor-id',
      source: 'confirm_burn_screen',
    });
    expect(ErrorTrackingService.addBreadcrumb).toHaveBeenCalledWith(
      'User confirmed release ritual',
      'navigation',
      { anchor_id: 'test-anchor-id' }
    );
  });

  it('shows inline feedback: Must match exactly for partial input', () => {
    const { getByText, getByPlaceholderText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    fireEvent.changeText(getByPlaceholderText('Type RELEASE'), 'REL');
    expect(getByText('Must match exactly')).toBeTruthy();
  });

  it('shows inline feedback: Ready for exact RELEASE input', () => {
    const { getByText, getByPlaceholderText } = render(<ConfirmBurnScreen />);

    fireEvent.press(getByText('Continue'));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    fireEvent.changeText(getByPlaceholderText('Type RELEASE'), 'RELEASE');
    expect(getByText('✓  Ready')).toBeTruthy();
  });
});
