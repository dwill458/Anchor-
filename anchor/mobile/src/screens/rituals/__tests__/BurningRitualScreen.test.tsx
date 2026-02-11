/**
 * Anchor App - BurningRitualScreen Tests
 *
 * Unit tests for the burning ritual animation screen
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { BurningRitualScreen } from '../BurningRitualScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { del } from '@/services/ApiClient';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import * as Haptics from 'expo-haptics';

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
  })),
}));

jest.mock('@/stores/anchorStore');
jest.mock('@/services/ApiClient');
jest.mock('@/services/AnalyticsService');
jest.mock('@/services/ErrorTrackingService');
jest.mock('@/components/ToastProvider', () => ({
  useToast: jest.fn(() => ({
    success: jest.fn(),
    error: jest.fn(),
  })),
}));
jest.mock('expo-haptics');
jest.mock('react-native-svg', () => ({
  SvgXml: 'SvgXml',
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => { };
  return {
    ...Reanimated,
    FadeIn: {
      duration: jest.fn().mockReturnThis(),
    },
  };
});

// Mock timers
jest.useFakeTimers();

describe('BurningRitualScreen', () => {
  let mockNavigate: jest.Mock;
  let mockRemoveAnchor: jest.Mock;
  let mockToastSuccess: jest.Mock;
  let mockToastError: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate = jest.fn();
    mockRemoveAnchor = jest.fn();
    mockToastSuccess = jest.fn();
    mockToastError = jest.fn();

    const navigation = require('@react-navigation/native');
    navigation.useNavigation.mockReturnValue({
      navigate: mockNavigate,
    });

    (useAnchorStore as unknown as jest.Mock).mockReturnValue({
      removeAnchor: mockRemoveAnchor,
    });

    const toastProvider = require('@/components/ToastProvider');
    toastProvider.useToast.mockReturnValue({
      success: mockToastSuccess,
      error: mockToastError,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should render the redesigned title', () => {
    const { getByText } = render(<BurningRitualScreen />);
    expect(getByText('Complete & Release')).toBeTruthy();
  });

  it('should show "Released" text after ritual completion', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });
    const { getByText } = render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(getByText('Released')).toBeTruthy();
    });
  });

  it('should trigger medium haptic feedback on start', () => {
    render(<BurningRitualScreen />);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium
    );
  });

  it('should call backend API to archive anchor', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(del).toHaveBeenCalledWith('/api/anchors/test-anchor-id');
    });
  });

  it('should remove anchor from local store on success', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(mockRemoveAnchor).toHaveBeenCalledWith('test-anchor-id');
    });
  });

  it('should navigate to Vault on success', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(del).toHaveBeenCalledWith('/api/anchors/test-anchor-id');
    });

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Vault');
    });
  });

  it('should trigger success haptic on completion', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });
  });

  it('should track analytics on successful burn', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(AnalyticsService.track).toHaveBeenCalledWith(
        AnalyticsEvents.BURN_COMPLETED,
        {
          anchor_id: 'test-anchor-id',
        }
      );
    });
  });

  it('should handle API errors gracefully', async () => {
    const error = new Error('Network error');
    (del as jest.Mock).mockRejectedValue(error);

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(ErrorTrackingService.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        { screen: 'BurningRitualScreen' }
      );
    });
  });

  it('should show error toast on API failure', async () => {
    const error = new Error('Network error');
    (del as jest.Mock).mockRejectedValue(error);

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ritual completed, but failed to sync. Anchor removed locally.');
    });
  });

  it('should still navigate to Vault even on API error', async () => {
    const error = new Error('Network error');
    (del as jest.Mock).mockRejectedValue(error);

    render(<BurningRitualScreen />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Vault');
    });
  });
});
