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

  it('should render burning prompts in sequence', async () => {
    const { getByText } = render(<BurningRitualScreen />);

    // Fast-forward to first prompt
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(getByText('Let go.')).toBeTruthy();

    // Fast-forward to second prompt
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(getByText('Trust the process.')).toBeTruthy();

    // Fast-forward to third prompt
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(getByText('Your intention has been released.')).toBeTruthy();
  }, 15000);

  it('should trigger heavy haptic feedback on start', () => {
    render(<BurningRitualScreen />);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Heavy
    );
  });

  it('should call backend API to archive anchor', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(del).toHaveBeenCalledWith('/api/anchors/test-anchor-id');
    });
  });

  it('should remove anchor from local store on success', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(mockRemoveAnchor).toHaveBeenCalledWith('test-anchor-id');
    });
  });

  it('should show success toast on successful burn', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Anchor released and archived successfully'
      );
    });
  });

  it('should navigate to Vault on success', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Vault');
    });
  });

  it('should trigger success haptic on completion', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });
  });

  it('should track analytics on successful burn', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

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

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(ErrorTrackingService.captureException).toHaveBeenCalledWith(
        error,
        {
          screen: 'BurningRitualScreen',
          action: 'archive_anchor',
          anchor_id: 'test-anchor-id',
        }
      );
    });
  });

  it('should show error toast on API failure', async () => {
    const error = new Error('Network error');
    (del as jest.Mock).mockRejectedValue(error);

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Network error');
    });
  });

  it('should track analytics on burn failure', async () => {
    const error = new Error('Network error');
    (del as jest.Mock).mockRejectedValue(error);

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(AnalyticsService.track).toHaveBeenCalledWith(
        AnalyticsEvents.BURN_FAILED,
        {
          anchor_id: 'test-anchor-id',
          error: 'Network error',
        }
      );
    });
  });

  it('should still navigate to Vault even on API error', async () => {
    const error = new Error('Network error');
    (del as jest.Mock).mockRejectedValue(error);

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Vault');
    });
  });

  it('should prevent duplicate API calls', async () => {
    (del as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    // Should only be called once despite potential race conditions
    await waitFor(() => {
      expect(del).toHaveBeenCalledTimes(1);
    });
  });

  it('should add breadcrumb before API call', async () => {
    (del as jest.Mock).mockResolvedValue({ success: true });

    render(<BurningRitualScreen />);

    // Fast-forward to completion
    jest.advanceTimersByTime(7000);

    await waitFor(() => {
      expect(ErrorTrackingService.addBreadcrumb).toHaveBeenCalledWith(
        'Archiving anchor via API',
        'api',
        {
          anchor_id: 'test-anchor-id',
        }
      );
    });
  });
});
