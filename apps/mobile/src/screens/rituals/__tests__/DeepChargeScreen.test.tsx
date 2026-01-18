/**
 * Anchor App - DeepChargeScreen Tests
 *
 * Unit tests for the 5-phase deep charge ritual (~5 minutes)
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DeepChargeScreen } from '../DeepChargeScreen';
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

describe('DeepChargeScreen', () => {
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

  it('should render anchor not found when anchor is missing', () => {
    mockGetAnchorById.mockReturnValue(undefined);
    const { getByText } = render(<DeepChargeScreen />);
    expect(getByText('Anchor not found')).toBeTruthy();
  });

  it('should display intention text', () => {
    const { getByText } = render(<DeepChargeScreen />);
    expect(getByText('"I am confident"')).toBeTruthy();
  });

  it('should start with Phase 1', () => {
    const { getByText } = render(<DeepChargeScreen />);
    expect(getByText('Phase 1 of 5')).toBeTruthy();
    expect(getByText('Breathe and Center')).toBeTruthy();
  });

  it('should trigger medium haptic on start', () => {
    render(<DeepChargeScreen />);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium
    );
  });

  it('should display phase 1 instruction', () => {
    const { getByText } = render(<DeepChargeScreen />);
    expect(getByText('Take slow, deep breaths. Clear your mind and prepare to focus.')).toBeTruthy();
  });

  it('should display phase 1 emotional cue', () => {
    const { getByText } = render(<DeepChargeScreen />);
    expect(getByText('Feel yourself becoming calm and ready. Release all distractions.')).toBeTruthy();
  });

  it('should countdown in phase 1 from 30 seconds', async () => {
    const { getByText } = render(<DeepChargeScreen />);

    expect(getByText('30')).toBeTruthy();

    jest.advanceTimersByTime(1000);
    await waitFor(() => expect(getByText('29')).toBeTruthy());

    jest.advanceTimersByTime(1000);
    await waitFor(() => expect(getByText('28')).toBeTruthy());
  });

  it('should transition to phase 2 after 30 seconds', async () => {
    const { getByText } = render(<DeepChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(getByText('Phase 2 of 5')).toBeTruthy();
      expect(getByText('Repeat Your Intention')).toBeTruthy();
    });
  });

  it('should display phase 2 details correctly', async () => {
    const { getByText } = render(<DeepChargeScreen />);

    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(getByText('Silently or aloud, repeat your intention with conviction.')).toBeTruthy();
      expect(getByText('Say it like you MEAN it. Feel the truth of these words.')).toBeTruthy();
      expect(getByText('60')).toBeTruthy(); // Phase 2 is 60 seconds
    });
  });

  it('should transition through all 5 phases', async () => {
    const { getByText } = render(<DeepChargeScreen />);

    // Phase 1: 30s
    expect(getByText('Phase 1 of 5')).toBeTruthy();

    // Phase 2: 60s (cumulative 30s)
    jest.advanceTimersByTime(30000);
    await waitFor(() => expect(getByText('Phase 2 of 5')).toBeTruthy());

    // Phase 3: 90s (cumulative 90s)
    jest.advanceTimersByTime(60000);
    await waitFor(() => expect(getByText('Phase 3 of 5')).toBeTruthy());
    await waitFor(() => expect(getByText('Visualize Success')).toBeTruthy());

    // Phase 4: 30s (cumulative 180s)
    jest.advanceTimersByTime(90000);
    await waitFor(() => expect(getByText('Phase 4 of 5')).toBeTruthy());
    await waitFor(() => expect(getByText('Connect to Symbol')).toBeTruthy());

    // Phase 5: 90s (cumulative 210s)
    jest.advanceTimersByTime(30000);
    await waitFor(() => expect(getByText('Phase 5 of 5')).toBeTruthy());
    await waitFor(() => expect(getByText('Hold Focus')).toBeTruthy());
  });

  it('should trigger haptics every 10 seconds', async () => {
    render(<DeepChargeScreen />);

    jest.clearAllMocks();

    // Should trigger at 10, 20, 30 (phase transition)
    jest.advanceTimersByTime(10000);
    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    jest.clearAllMocks();
    jest.advanceTimersByTime(10000);
    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalled();
    });
  });

  it('should trigger stronger haptic on phase transition', async () => {
    render(<DeepChargeScreen />);

    jest.clearAllMocks();

    // Phase 1 -> Phase 2 transition
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });
  });

  it('should show completion state when finished', async () => {
    const { getByText } = render(<DeepChargeScreen />);

    // Advance through all phases (30 + 60 + 90 + 30 + 90 = 300 seconds)
    jest.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(getByText('⚡️ Deeply Charged ⚡️')).toBeTruthy();
    });
  });

  it('should call backend API on completion', async () => {
    render(<DeepChargeScreen />);

    jest.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/anchors/test-anchor-id/charge',
        {
          chargeType: 'initial_deep',
          durationSeconds: 300,
        }
      );
    });
  });

  it('should update local store on successful charge', async () => {
    render(<DeepChargeScreen />);

    jest.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(mockUpdateAnchor).toHaveBeenCalledWith('test-anchor-id', {
        isCharged: true,
        chargedAt: expect.any(Date),
      });
    });
  });

  it('should show success toast on successful charge', async () => {
    render(<DeepChargeScreen />);

    jest.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Anchor charged successfully');
    });
  });

  it('should trigger success haptic on completion', async () => {
    render(<DeepChargeScreen />);

    jest.clearAllMocks();
    jest.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });
  });

  it('should navigate back after completion', async () => {
    render(<DeepChargeScreen />);

    jest.advanceTimersByTime(302000); // 300s + 2s delay

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('should handle API errors gracefully', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    render(<DeepChargeScreen />);

    jest.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(ErrorTrackingService.captureException).toHaveBeenCalledWith(
        error,
        {
          screen: 'DeepChargeScreen',
          action: 'charge_anchor',
          anchor_id: 'test-anchor-id',
        }
      );
    });
  });

  it('should show error toast on API failure', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    render(<DeepChargeScreen />);

    jest.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Charging completed but failed to sync. Will retry later.'
      );
    });
  });

  it('should still navigate back even on API error', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<DeepChargeScreen />);

    jest.advanceTimersByTime(302000);

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('should cleanup timer on unmount', () => {
    const { unmount } = render(<DeepChargeScreen />);

    jest.advanceTimersByTime(50000);
    unmount();

    // Should not crash or throw errors
    expect(() => jest.advanceTimersByTime(300000)).not.toThrow();
  });

  it('should show progress correctly through phases', async () => {
    const { getByText } = render(<DeepChargeScreen />);

    // Phase 1/5 = 0% progress (simplified check via phase numbers)
    expect(getByText('Phase 1 of 5')).toBeTruthy();

    // Phase 2/5
    jest.advanceTimersByTime(30000);
    await waitFor(() => expect(getByText('Phase 2 of 5')).toBeTruthy());

    // Phase 3/5
    jest.advanceTimersByTime(60000);
    await waitFor(() => expect(getByText('Phase 3 of 5')).toBeTruthy());

    // Phase 4/5
    jest.advanceTimersByTime(90000);
    await waitFor(() => expect(getByText('Phase 4 of 5')).toBeTruthy());

    // Phase 5/5
    jest.advanceTimersByTime(30000);
    await waitFor(() => expect(getByText('Phase 5 of 5')).toBeTruthy());
  });

  it('should display all phase emotional cues correctly', async () => {
    const { getByText } = render(<DeepChargeScreen />);

    // Phase 1
    expect(getByText('Feel yourself becoming calm and ready. Release all distractions.')).toBeTruthy();

    // Phase 2
    jest.advanceTimersByTime(30000);
    await waitFor(() =>
      expect(getByText('Say it like you MEAN it. Feel the truth of these words.')).toBeTruthy()
    );

    // Phase 3
    jest.advanceTimersByTime(60000);
    await waitFor(() =>
      expect(getByText('Feel the joy of success NOW. Let it overwhelm you.')).toBeTruthy()
    );

    // Phase 4
    jest.advanceTimersByTime(90000);
    await waitFor(() =>
      expect(getByText('Your energy is pouring into this anchor. Feel the connection.')).toBeTruthy()
    );

    // Phase 5
    jest.advanceTimersByTime(30000);
    await waitFor(() =>
      expect(getByText('This moment is everything. Pure. Total. Complete focus.')).toBeTruthy()
    );
  });
});
