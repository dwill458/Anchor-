/**
 * Anchor App - ConfirmBurnScreen Tests
 *
 * Unit tests for the burn confirmation screen
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmBurnScreen } from '../ConfirmBurnScreen';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({
    params: {
      anchorId: 'test-anchor-id',
      intention: 'I am confident',
      sigilSvg: '<svg></svg>',
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

describe('ConfirmBurnScreen', () => {
  let mockNavigate: jest.Mock;
  let mockGoBack: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate = jest.fn();
    mockGoBack = jest.fn();

    const navigation = require('@react-navigation/native');
    navigation.useNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
  });

  it('should render the redesigned title', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText('Complete & Release')).toBeTruthy();
  });

  it('should render ritual explanation card', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText('Why release?')).toBeTruthy();
    expect(getByText(/In chaos magick, performing a final ritual of release/)).toBeTruthy();
  });

  it('should display the intention text', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText('"I am confident"')).toBeTruthy();
  });

  it('should render Release Anchor button', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText('Release Anchor')).toBeTruthy();
  });

  it('should render Keep Anchor Active button', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText('Keep Anchor Active')).toBeTruthy();
  });

  it('should navigate to BurningRitual when confirmed', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const confirmButton = getByText('Release Anchor');

    fireEvent.press(confirmButton);

    expect(mockNavigate).toHaveBeenCalledWith('BurningRitual', {
      anchorId: 'test-anchor-id',
      intention: 'I am confident',
      sigilSvg: '<svg></svg>',
    });
  });

  it('should track analytics when confirmed', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const confirmButton = getByText('Release Anchor');

    fireEvent.press(confirmButton);

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.BURN_INITIATED,
      {
        anchor_id: 'test-anchor-id',
        source: 'confirm_burn_screen',
      }
    );
  });

  it('should add breadcrumb when confirmed', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const confirmButton = getByText('Release Anchor');

    fireEvent.press(confirmButton);

    expect(ErrorTrackingService.addBreadcrumb).toHaveBeenCalledWith(
      'User confirmed release ritual',
      'navigation',
      {
        anchor_id: 'test-anchor-id',
      }
    );
  });

  it('should go back when cancelled', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const cancelButton = getByText('Keep Anchor Active');

    fireEvent.press(cancelButton);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should track analytics when cancelled', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const cancelButton = getByText('Keep Anchor Active');

    fireEvent.press(cancelButton);

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      'burn_cancelled',
      {
        anchor_id: 'test-anchor-id',
        source: 'confirm_burn_screen',
      }
    );
  });

  it('should ask about fulfilled role', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(
      getByText(/Has this anchor fulfilled its role/)
    ).toBeTruthy();
  });
});
