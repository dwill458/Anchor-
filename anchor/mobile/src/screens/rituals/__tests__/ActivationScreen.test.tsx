/**
 * Anchor App - ActivationScreen Tests
 *
 * Unit tests for focus session activation flow.
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ActivationScreen } from '../ActivationScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { createMockAnchor } from '@/__tests__/utils/testUtils';

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

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => { };
  return Reanimated;
});

jest.mock('@/stores/anchorStore');
jest.mock('@/stores/settingsStore');
jest.mock('@/services/ApiClient');
jest.mock('@/services/ErrorTrackingService');
jest.mock('@/components/ToastProvider', () => ({
  useToast: jest.fn(() => ({
    success: jest.fn(),
    error: jest.fn(),
  })),
}));

const TEST_ACTIVATION_DURATION_SECONDS = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      defaultActivation: {
        type: 'visual',
        value: TEST_ACTIVATION_DURATION_SECONDS,
        unit: 'seconds',
      },
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
    jest.restoreAllMocks();
  });

  it('renders redesigned focus session with required copy', () => {
    const { getByText } = render(<ActivationScreen />);

    expect(getByText('Focus Session')).toBeTruthy();
    expect(getByText('Intention')).toBeTruthy();
    expect(getByText('remaining')).toBeTruthy();
    expect(getByText('Hold the symbol. Let the words fade.')).toBeTruthy();
    expect(getByText('00:02')).toBeTruthy();
  });

  it('displays intention text', () => {
    const { getByText } = render(<ActivationScreen />);
    expect(getByText('I am confident')).toBeTruthy();
  });

  it('renders anchor not found when anchor is missing', () => {
    mockGetAnchorById.mockReturnValue(undefined);
    const { getByText } = render(<ActivationScreen />);
    expect(getByText('Anchor not found')).toBeTruthy();
  });

  it('counts down in mm:ss format', async () => {
    const { getByText } = render(<ActivationScreen />);

    expect(getByText('00:02')).toBeTruthy();
    await sleep(1100);

    await waitFor(() => expect(getByText('00:01')).toBeTruthy(), { timeout: 2000 });
  });

  it('pauses and resumes countdown', async () => {
    const { getByTestId, getByText } = render(<ActivationScreen />);

    fireEvent.press(getByTestId('focus-session-pause'));

    await sleep(1200);

    await waitFor(() => expect(getByText('Paused')).toBeTruthy());
    expect(getByText('00:02')).toBeTruthy();

    fireEvent.press(getByTestId('focus-session-resume'));

    await sleep(1100);

    await waitFor(() => expect(getByText('00:01')).toBeTruthy(), { timeout: 2000 });
  });

  it('shows completion state when timer reaches zero', async () => {
    const { getByText } = render(<ActivationScreen />);

    await waitFor(() => {
      expect(getByText('Sealed.')).toBeTruthy();
      expect(getByText('Continue')).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('calls API only after tapping Continue', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    expect(apiClient.post).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('focus-session-continue'));

    expect(mockGoBack).toHaveBeenCalled();

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/anchors/test-anchor-id/activate',
      {
        activationType: 'visual',
        durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
      }
    ));
  });

  it('updates local activation immediately on Continue', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    expect(mockUpdateAnchor).toHaveBeenCalledWith('test-anchor-id', {
      activationCount: 1,
      lastActivatedAt: expect.any(Date),
    });
  });

  it('dismiss button exits without activating', () => {
    const { getByTestId } = render(<ActivationScreen />);

    fireEvent.press(getByTestId('focus-session-dismiss'));

    expect(mockGoBack).toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('uses provided activation type', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        activationType: 'audio',
      },
    });

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/anchors/test-anchor-id/activate',
        {
          activationType: 'audio',
          durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
        }
      );
    });
  });

  it('uses visual as fallback activation type', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
      },
    });

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/anchors/test-anchor-id/activate',
        {
          activationType: 'visual',
          durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
        }
      );
    });
  });

  it('handles API errors gracefully after Continue', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

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

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      'Activation completed but failed to sync. Will retry later.'
    );
  });
});
