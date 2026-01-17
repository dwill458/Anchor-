/**
 * Anchor App - QuickChargeScreen Tests
 *
 * Unit tests for the 30-second quick charge ritual
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QuickChargeScreen } from '../QuickChargeScreen';
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

describe('QuickChargeScreen', () => {
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

    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should render with correct duration', () => {
    const { getByText } = render(<QuickChargeScreen />);
    expect(getByText('30')).toBeTruthy();
  });

  it('should display intention text', () => {
    const { getByText } = render(<QuickChargeScreen />);
    expect(getByText('"I am confident"')).toBeTruthy();
  });

  it('should render anchor not found when anchor is missing', () => {
    mockGetAnchorById.mockReturnValue(undefined);
    const { getByText } = render(<QuickChargeScreen />);
    expect(getByText('Anchor not found')).toBeTruthy();
  });

  it('should trigger heavy haptic on start', () => {
    render(<QuickChargeScreen />);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Heavy
    );
  });

  it('should countdown from 30 seconds', async () => {
    const { getByText } = render(<QuickChargeScreen />);

    expect(getByText('30')).toBeTruthy();

    jest.advanceTimersByTime(1000);
    await waitFor(() => expect(getByText('29')).toBeTruthy());

    jest.advanceTimersByTime(1000);
    await waitFor(() => expect(getByText('28')).toBeTruthy());
  });

  it('should display intensity prompts at correct times', async () => {
    const { getByText } = render(<QuickChargeScreen />);

    // Advance to 25 seconds (5 seconds in)
    jest.advanceTimersByTime(5000);
    await waitFor(() => expect(getByText('Feel it with every fiber')).toBeTruthy());

    // Advance to 20 seconds (10 seconds in)
    jest.advanceTimersByTime(5000);
    await waitFor(() => expect(getByText('This is REAL')).toBeTruthy());

    // Advance to 15 seconds (15 seconds in)
    jest.advanceTimersByTime(5000);
    await waitFor(() => expect(getByText('Channel pure desire')).toBeTruthy());

    // Advance to 10 seconds (20 seconds in)
    jest.advanceTimersByTime(5000);
    await waitFor(() => expect(getByText('Make it undeniable')).toBeTruthy());

    // Advance to 5 seconds (25 seconds in)
    jest.advanceTimersByTime(5000);
    await waitFor(() => expect(getByText('BELIEVE IT NOW')).toBeTruthy());
  });

  it('should trigger haptics at intensity prompt times', async () => {
    render(<QuickChargeScreen />);

    jest.clearAllMocks();

    // First prompt at 25 seconds
    jest.advanceTimersByTime(5000);
    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });
  });

  it('should show completion state when finished', async () => {
    const { getByText } = render(<QuickChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(getByText('⚡️ Charged ⚡️')).toBeTruthy();
    });
  });

  it('should call backend API on completion', async () => {
    render(<QuickChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/anchors/test-anchor-id/charge',
        {
          chargeType: 'initial_quick',
          durationSeconds: 30,
        }
      );
    });
  });

  it('should update local store on successful charge', async () => {
    render(<QuickChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(mockUpdateAnchor).toHaveBeenCalledWith('test-anchor-id', {
        isCharged: true,
        chargedAt: expect.any(Date),
      });
    });
  });

  it('should show success toast on successful charge', async () => {
    render(<QuickChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Anchor charged successfully');
    });
  });

  it('should trigger success haptic on completion', async () => {
    render(<QuickChargeScreen />);

    jest.clearAllMocks();
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });
  });

  it('should navigate back after completion', async () => {
    render(<QuickChargeScreen />);

    jest.advanceTimersByTime(32000); // 30s + 2s delay

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('should handle API errors gracefully', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    render(<QuickChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(ErrorTrackingService.captureException).toHaveBeenCalledWith(
        error,
        {
          screen: 'QuickChargeScreen',
          action: 'charge_anchor',
          anchor_id: 'test-anchor-id',
        }
      );
    });
  });

  it('should show error toast on API failure', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    render(<QuickChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Charging completed but failed to sync. Will retry later.'
      );
    });
  });

  it('should still navigate back even on API error', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<QuickChargeScreen />);

    jest.advanceTimersByTime(32000);

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('should cleanup timer on unmount', () => {
    const { unmount } = render(<QuickChargeScreen />);

    jest.advanceTimersByTime(5000);
    unmount();

    // Should not crash or throw errors
    expect(() => jest.advanceTimersByTime(30000)).not.toThrow();
  });

  it('should trigger periodic haptics every 5 seconds', async () => {
    render(<QuickChargeScreen />);

    jest.clearAllMocks();

    // Should trigger at 5, 10, 15, 20, 25, 30
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(5000);
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalled();
      });
      jest.clearAllMocks();
    }
  });
});
