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

  it('should render warning message', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText(/This will permanently archive this anchor/)).toBeTruthy();
  });

  it('should display the intention text', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText('"I am confident"')).toBeTruthy();
  });

  it('should render Complete & Release button', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText(/COMPLETE & RELEASE/)).toBeTruthy();
  });

  it('should render Cancel button', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('should navigate to BurningRitual when confirmed', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const confirmButton = getByText(/COMPLETE & RELEASE/);

    fireEvent.press(confirmButton);

    expect(mockNavigate).toHaveBeenCalledWith('BurningRitual', {
      anchorId: 'test-anchor-id',
      intention: 'I am confident',
      sigilSvg: '<svg></svg>',
    });
  });

  it('should track analytics when confirmed', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const confirmButton = getByText(/COMPLETE & RELEASE/);

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
    const confirmButton = getByText(/COMPLETE & RELEASE/);

    fireEvent.press(confirmButton);

    expect(ErrorTrackingService.addBreadcrumb).toHaveBeenCalledWith(
      'User confirmed burn ritual',
      'navigation',
      {
        anchor_id: 'test-anchor-id',
      }
    );
  });

  it('should go back when cancelled', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const cancelButton = getByText('Cancel');

    fireEvent.press(cancelButton);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should track analytics when cancelled', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const cancelButton = getByText('Cancel');

    fireEvent.press(cancelButton);

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      'burn_cancelled',
      {
        anchor_id: 'test-anchor-id',
        source: 'confirm_burn_screen',
      }
    );
  });

  it('should add breadcrumb when cancelled', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    const cancelButton = getByText('Cancel');

    fireEvent.press(cancelButton);

    expect(ErrorTrackingService.addBreadcrumb).toHaveBeenCalledWith(
      'User cancelled burn ritual',
      'navigation',
      {
        anchor_id: 'test-anchor-id',
      }
    );
  });

  it('should display chaos magick principle in warning', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(
      getByText(/According to chaos magick, completing an anchor after success/)
    ).toBeTruthy();
  });

  it('should ask about intention fulfillment', () => {
    const { getByText } = render(<ConfirmBurnScreen />);
    expect(
      getByText(/Has this intention been fulfilled or served its purpose/)
    ).toBeTruthy();
  });
});
