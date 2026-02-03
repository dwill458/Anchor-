/**
 * Anchor App - ActivationScreen Tests
 *
 * Unit tests for the 10-second activation ritual
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ActivationScreen } from '../ActivationScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import * as Haptics from 'expo-haptics';
import { createMockAnchor } from '@/__tests__/utils/testUtils';

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({
    params: {
      anchorId: 'test-anchor-id',
      activationType: 'visual',
    },
  })),
  useNavigation: jest.fn(() => ({
    goBack: jest.fn(),
  })),
}));

jest.mock('@/stores/anchorStore');
jest.mock('@/services/ApiClient');
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

describe('ActivationScreen', () => {
  let mockGoBack: jest.Mock;
  let mockGetAnchorById: jest.Mock;
  let mockUpdateAnchor: jest.Mock;
  let mockToastSuccess: jest.Mock;
  let mockToastError: jest.Mock;
  let mockAnchor: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoBack = jest.fn();
    mockGetAnchorById = jest.fn();
    mockUpdateAnchor = jest.fn();
    mockToastSuccess = jest.fn();
    mockToastError = jest.fn();

    mockAnchor = createMockAnchor({
      id: 'test-anchor-id',
      intentionText: 'I am confident',
      baseSigilSvg: '<svg></svg>',
      isCharged: true,
    });

    const navigation = require('@react-navigation/native');
    navigation.useNavigation.mockReturnValue({
      goBack: mockGoBack,
    });

    mockGetAnchorById.mockReturnValue(mockAnchor);
    (useAnchorStore as unknown as jest.Mock).mockReturnValue({
      getAnchorById: mockGetAnchorById,
      updateAnchor: mockUpdateAnchor,
    });

    const toastProvider = require('@/components/ToastProvider');
    toastProvider.useToast.mockReturnValue({
      success: mockToastSuccess,
      error: mockToastError,
    });

    (apiClient.post as jest.Mock).mockResolvedValue({
      data: {
        data: {
          activationCount: 5,
          lastActivatedAt: new Date().toISOString(),
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should render with correct duration', () => {
    const { getByText } = render(<ActivationScreen />);
    expect(getByText('10')).toBeTruthy();
  });

  it('should display intention text', () => {
    const { getByText } = render(<ActivationScreen />);
    expect(getByText('"I am confident"')).toBeTruthy();
  });

  it('should render anchor not found when anchor is missing', () => {
    mockGetAnchorById.mockReturnValue(undefined);
    const { getByText } = render(<ActivationScreen />);
    expect(getByText('Anchor not found')).toBeTruthy();
  });

  it('should trigger medium haptic on start', () => {
    render(<ActivationScreen />);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium
    );
  });

  it('should countdown from 10 seconds', async () => {
    const { getByText } = render(<ActivationScreen />);

    expect(getByText('10')).toBeTruthy();

    jest.advanceTimersByTime(1000);
    await waitFor(() => expect(getByText('9')).toBeTruthy());

    jest.advanceTimersByTime(1000);
    await waitFor(() => expect(getByText('8')).toBeTruthy());
  });

  it('should trigger haptics every 2 seconds', async () => {
    render(<ActivationScreen />);

    jest.clearAllMocks();

    // Should trigger at 2, 4, 6, 8 seconds
    for (let i = 0; i < 4; i++) {
      jest.advanceTimersByTime(2000);
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalled();
      });
      jest.clearAllMocks();
    }
  });

  it('should show completion state when finished', async () => {
    const { getByText } = render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(getByText('Session Complete!')).toBeTruthy();
    });
  });

  it('should call backend API on completion', async () => {
    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/anchors/test-anchor-id/activate',
        {
          activationType: 'visual',
          durationSeconds: 10,
        }
      );
    });
  });

  it('should update local store with activation data', async () => {
    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(mockUpdateAnchor).toHaveBeenCalledWith('test-anchor-id', {
        activationCount: 5,
        lastActivatedAt: expect.any(Date),
      });
    });
  });

  it('should show success toast on successful activation', async () => {
    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Activation logged successfully');
    });
  });

  it('should trigger success haptic on completion', async () => {
    render(<ActivationScreen />);

    jest.clearAllMocks();
    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });
  });

  it('should navigate back after completion', async () => {
    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);
    await Promise.resolve();
    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('should handle API errors gracefully', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(ErrorTrackingService.captureException).toHaveBeenCalledWith(
        error,
        {
          screen: 'ActivationScreen',
          action: 'activate_anchor',
          anchor_id: 'test-anchor-id',
        }
      );
    });
  });

  it('should show error toast on API failure', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Activation completed but failed to sync. Will retry later.'
      );
    });
  });

  it('should still navigate back even on API error', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);
    await Promise.resolve();
    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('should cleanup timer on unmount', () => {
    const { unmount } = render(<ActivationScreen />);

    jest.advanceTimersByTime(5000);
    unmount();

    // Should not crash or throw errors
    expect(() => jest.advanceTimersByTime(10000)).not.toThrow();
  });

  it('should handle missing activation data in response', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: {},
    });

    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    // Should not crash
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Activation logged successfully');
    });

    // Should not try to update store with missing data
    expect(mockUpdateAnchor).not.toHaveBeenCalled();
  });

  it('should display activation instruction', () => {
    const { getByText } = render(<ActivationScreen />);
    expect(getByText(/Focus on your intention/)).toBeTruthy();
  });

  it('should handle different activation types', () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        activationType: 'audio',
      },
    });

    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/anchors/test-anchor-id/activate',
        {
          activationType: 'audio',
          durationSeconds: 10,
        }
      );
    });
  });

  it('should use visual as default activation type', () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        // No activationType provided
      },
    });

    render(<ActivationScreen />);

    jest.advanceTimersByTime(10000);

    waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/anchors/test-anchor-id/activate',
        {
          activationType: 'visual',
          durationSeconds: 10,
        }
      );
    });
  });

  it('should complete full activation ritual flow', async () => {
    const { getByText } = render(<ActivationScreen />);

    // Start state
    expect(getByText('10')).toBeTruthy();
    expect(getByText(/Focus on your intention/)).toBeTruthy();

    // Mid-ritual
    jest.advanceTimersByTime(5000);
    await waitFor(() => expect(getByText('5')).toBeTruthy());

    // Completion
    jest.advanceTimersByTime(5000);
    await waitFor(() => expect(getByText('Session Complete!')).toBeTruthy());

    // API called
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    // Navigation
    await Promise.resolve();
    jest.advanceTimersByTime(1500);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});
