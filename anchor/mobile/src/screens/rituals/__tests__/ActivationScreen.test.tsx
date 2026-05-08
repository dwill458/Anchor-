/**
 * Anchor App - ActivationScreen Tests
 *
 * Unit tests for focus session activation flow.
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { ActivationScreen } from '../ActivationScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { createMockAnchor } from '@/__tests__/utils/testUtils';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';

const TEST_ACTIVATION_DURATION_SECONDS = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mockNavigateToPractice = jest.fn();
const mockPlaySound = jest.fn();
const mockHandlePrimeComplete = jest.fn();
const mockSetActiveSession = jest.fn();
const mockRecordPrimeSession = jest.fn();
const mockIsPostPrimeTraceEligible = jest.fn().mockResolvedValue(false);
const mockMarkPostPrimeTraceAttemptStarted = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useRoute: jest.fn(() => ({
      params: {
        anchorId: 'test-anchor-id',
        activationType: 'visual',
      },
    })),
    useNavigation: jest.fn(() => ({
      goBack: jest.fn(),
    })),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => { };
  Reanimated.useFrameCallback = jest.fn();
  Reanimated.default.Value = class {
    constructor(_val: number) {}
    setValue = jest.fn();
    interpolate = jest.fn(() => this);
    addListener = jest.fn();
    removeListener = jest.fn();
    stopAnimation = jest.fn();
  };
  Reanimated.default.timing = jest.fn(() => ({ start: jest.fn((cb?: () => void) => cb?.()) }));
  Reanimated.default.parallel = jest.fn(() => ({ start: jest.fn((cb?: () => void) => cb?.()) }));
  Reanimated.default.sequence = jest.fn(() => ({ start: jest.fn((cb?: () => void) => cb?.()) }));
  Reanimated.default.createAnimatedComponent = jest.fn((C: any) => C);
  // Use React.useRef to return a stable shared-value object across re-renders,
  // matching real Reanimated behavior (new object each call breaks useCallback deps).
  Reanimated.useSharedValue = (init: any) => {
    const ref = React.useRef({ value: init });
    return ref.current;
  };
  return Reanimated;
});

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToVault: jest.fn(),
    navigateToPractice: mockNavigateToPractice,
    registerTabNav: jest.fn(),
    activeTabIndex: 0,
  }),
  TabNavigationProvider: ({ children }: any) => children,
}));

jest.mock('@/stores/anchorStore');
jest.mock('@/stores/settingsStore');
jest.mock('@/services/ApiClient');
jest.mock('@/services/ErrorTrackingService');
jest.mock('@/hooks/useAudio', () => ({
  useAudio: () => ({
    playSound: mockPlaySound,
  }),
}));
jest.mock('@/components/ToastProvider', () => ({
  useToast: jest.fn(() => ({
    success: jest.fn(),
    error: jest.fn(),
  })),
}));
jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    isInitialized: true,
    notifState: null,
    handlePrimeComplete: mockHandlePrimeComplete,
    handleBurnFlowEntered: jest.fn(),
    handleSigilVaulted: jest.fn(),
    updateActiveHours: jest.fn(),
    toggleNotifications: jest.fn(),
    setActiveSession: mockSetActiveSession,
  }),
}));
jest.mock('@/utils/postPrimeTraceEligibility', () => ({
  isPostPrimeTraceEligible: (...args: any[]) => mockIsPostPrimeTraceEligible(...args),
  markPostPrimeTraceAttemptStarted: (...args: any[]) =>
    mockMarkPostPrimeTraceAttemptStarted(...args),
}));

// Helper: make useSettingsStore call the selector so values resolve correctly
const mockSettingsState = (overrides: Record<string, unknown> = {}) => {
  const base = {
    focusSessionDuration: TEST_ACTIVATION_DURATION_SECONDS,
    focusSessionAudio: 'silent',
    arrivePhaseEnabled: false,
    reduceIntentionVisibility: false,
    primeSessionDuration: 120,
    ...overrides,
  };
  (useSettingsStore as unknown as jest.Mock).mockImplementation((selector: any) =>
    typeof selector === 'function' ? selector(base) : base
  );
};

describe('ActivationScreen', () => {
  let mockGoBack: jest.Mock;
  let mockPopToTop: jest.Mock;
  let mockNavigate: jest.Mock;
  let mockReplace: jest.Mock;
  let mockAddListener: jest.Mock;
  let mockGetAnchorById: jest.Mock;
  let mockUpdateAnchor: jest.Mock;
  let mockIncrementTotalPrimes: jest.Mock;
  let mockToastSuccess: jest.Mock;
  let mockToastError: jest.Mock;
  let mockAnchor: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlaySound.mockClear();
    useAuthStore.setState({ pendingFirstAnchorDraft: null });

    mockGoBack = jest.fn();
    mockPopToTop = jest.fn();
    mockNavigate = jest.fn();
    mockReplace = jest.fn();
    mockAddListener = jest.fn(() => jest.fn());
    mockGetAnchorById = jest.fn();
    mockUpdateAnchor = jest.fn();
    mockIncrementTotalPrimes = jest.fn();
    mockToastSuccess = jest.fn();
    mockToastError = jest.fn();
    mockHandlePrimeComplete.mockReset();
    mockHandlePrimeComplete.mockResolvedValue(undefined);
    mockSetActiveSession.mockReset();
    mockSetActiveSession.mockResolvedValue(undefined);
    mockRecordPrimeSession.mockReset();
    mockIsPostPrimeTraceEligible.mockReset();
    mockIsPostPrimeTraceEligible.mockResolvedValue(false);
    mockMarkPostPrimeTraceAttemptStarted.mockReset();
    mockMarkPostPrimeTraceAttemptStarted.mockResolvedValue(undefined);
    usePostPrimeTraceStore.setState({ activeFlow: null });

    mockAnchor = createMockAnchor({
      id: 'test-anchor-id',
      intentionText: 'I am confident',
      baseSigilSvg: '<svg></svg>',
      isCharged: true,
    });

    const navigation = require('@react-navigation/native');
    navigation.useNavigation.mockReturnValue({
      goBack: mockGoBack,
      popToTop: mockPopToTop,
      navigate: mockNavigate,
      replace: mockReplace,
      addListener: mockAddListener,
    });
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        activationType: 'visual',
        durationOverride: TEST_ACTIVATION_DURATION_SECONDS,
      },
    });

    mockNavigateToPractice.mockReset();

    mockGetAnchorById.mockReturnValue(mockAnchor);
    (useAnchorStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        getAnchorById: mockGetAnchorById,
        updateAnchor: mockUpdateAnchor,
        incrementTotalPrimes: mockIncrementTotalPrimes,
        recordPrimeSession: mockRecordPrimeSession,
        totalPrimes: 0,
        anchors: [mockAnchor],
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
    (useAnchorStore as any).getState = jest.fn(() => ({
      totalPrimes: 0,
      anchors: [mockAnchor],
    }));

    mockSettingsState();
    // Also mock the static getState used directly by sessionStore's applyDecay
    (useSettingsStore as any).getState = jest.fn(() => ({
      focusSessionDuration: TEST_ACTIVATION_DURATION_SECONDS,
      focusSessionAudio: 'silent',
      arrivePhaseEnabled: false,
      reduceIntentionVisibility: false,
      threadStrengthSensitivity: 1,
      restDays: [],
    }));

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

    // New design: top bar shows "FOCUS" label and timer on the right
    expect(getByText('FOCUS')).toBeTruthy();
    expect(getByText('00:02')).toBeTruthy();
    // First guidance string shown in bottom area during running
    expect(getByText('See it as already done.')).toBeTruthy();
  });

  it('displays anchor not found when anchor is missing', () => {
    mockGetAnchorById.mockReturnValue(undefined);
    const { getByText } = render(<ActivationScreen />);
    expect(getByText('Anchor not found')).toBeTruthy();
  });

  it('falls back to safe defaults when settings are missing', () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: { anchorId: 'test-anchor-id', activationType: 'visual' },
    });
    // arrivePhaseEnabled defaults to true when key is missing, which subtracts 5s
    // from the display. Explicitly disable it so the test checks the raw default (30s).
    (useSettingsStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const base = { arrivePhaseEnabled: false };
      return typeof selector === 'function' ? selector(base) : base;
    });

    const { getByText } = render(<ActivationScreen />);
    // focusSessionDuration defaults to 30
    expect(getByText('00:30')).toBeTruthy();
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

    // After pause, resume button is shown, timer stays frozen
    await waitFor(() => expect(getByTestId('focus-session-resume')).toBeTruthy());
    expect(getByText('00:02')).toBeTruthy();

    fireEvent.press(getByTestId('focus-session-resume'));

    await sleep(1100);

    await waitFor(() => expect(getByText('00:01')).toBeTruthy(), { timeout: 2000 });
  });

  it('shows seal phase when timer reaches zero', async () => {
    const { getByText, getByTestId } = render(<ActivationScreen />);

    await waitFor(() => {
      // Seal phase: top bar shows "SEAL YOUR ANCHOR", hint below sigil
      expect(getByText('SEAL YOUR ANCHOR')).toBeTruthy();
      expect(getByText('Press and hold to seal')).toBeTruthy();
      // Seal container has focus-session-continue testID
      expect(getByTestId('focus-session-continue')).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('calls API only after tapping the seal', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    expect(apiClient.post).not.toHaveBeenCalled();

    // Tap the seal container (fires onPress = immediate complete)
    fireEvent.press(getByTestId('focus-session-continue'));

    // Now click Done in CompletionModal
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      '/api/anchors/test-anchor-id/activate',
      {
        activationType: 'visual',
        durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
      }
    ));
  });

  it('updates local activation immediately on seal', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() => expect(mockUpdateAnchor).toHaveBeenCalledWith('test-anchor-id', {
      activationCount: 1,
      lastActivatedAt: expect.any(Date),
    }));
  });

  it('dismiss button exits without activating', () => {
    const { getByTestId, getByText } = render(<ActivationScreen />);

    fireEvent.press(getByTestId('focus-session-dismiss'));

    expect(getByText('Exit Focus Session?')).toBeTruthy();
    fireEvent.press(getByText('Exit'));
    expect(mockGoBack).toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('does not show exit warning once the focus session is complete', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-dismiss'));

    expect(mockGoBack).not.toHaveBeenCalled();
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
  });

  it('routes completed-session back attempts into reflection instead of exit warning', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });

    const beforeRemoveHandler = mockAddListener.mock.calls.find(
      ([eventName]) => eventName === 'beforeRemove'
    )?.[1];

    expect(beforeRemoveHandler).toBeTruthy();

    const preventDefault = jest.fn();
    await act(async () => {
      beforeRemoveHandler?.({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
  });

  it('pops vault stack and returns to Practice after completion when launched from Practice', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        activationType: 'visual',
        returnTo: 'practice',
        durationOverride: TEST_ACTIVATION_DURATION_SECONDS,
      },
    });

    const { getByTestId } = render(<ActivationScreen />);
    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() => {
      expect(mockPopToTop).toHaveBeenCalled();
      expect(mockNavigateToPractice).toHaveBeenCalled();
    });
  });

  it('uses provided activation type', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        activationType: 'audio',
        durationOverride: TEST_ACTIVATION_DURATION_SECONDS,
      },
    });

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

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
        durationOverride: TEST_ACTIVATION_DURATION_SECONDS,
      },
    });

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

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

  it('shows the post-prime trace prompt before reflection when eligible', async () => {
    mockIsPostPrimeTraceEligible.mockResolvedValue(true);

    const { getByTestId, queryByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    await waitFor(() => expect(getByTestId('post-prime-trace-modal')).toBeTruthy());
    expect(queryByTestId('completion-modal-done')).toBeNull();
  });

  it('skips the post-prime trace prompt on the first prime session for an anchor', async () => {
    mockIsPostPrimeTraceEligible.mockResolvedValue(true);
    mockAnchor = createMockAnchor({
      id: 'test-anchor-id',
      intentionText: 'I am confident',
      baseSigilSvg: '<svg></svg>',
      isCharged: false,
      activationCount: 0,
      chargeCount: 0,
      firstChargedAt: undefined,
    });
    mockGetAnchorById.mockReturnValue(mockAnchor);

    const { getByTestId, queryByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    expect(queryByTestId('post-prime-trace-modal')).toBeNull();
    expect(mockIsPostPrimeTraceEligible).not.toHaveBeenCalled();
  });

  it('marks the anchor as charged when the first quick-prime completes', async () => {
    mockAnchor = createMockAnchor({
      id: 'test-anchor-id',
      intentionText: 'I am confident',
      baseSigilSvg: '<svg></svg>',
      isCharged: false,
      activationCount: 0,
      chargeCount: 0,
      firstChargedAt: undefined,
      chargedAt: undefined,
    });
    mockGetAnchorById.mockReturnValue(mockAnchor);

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() =>
      expect(mockUpdateAnchor).toHaveBeenCalledWith(
        'test-anchor-id',
        expect.objectContaining({
          isCharged: true,
          chargedAt: expect.any(Date),
          firstChargedAt: expect.any(Date),
          chargeCount: 1,
          activationCount: 1,
          lastActivatedAt: expect.any(Date),
        })
      )
    );
  });

  it('skips post-prime trace into reflection without applying the trace flow', async () => {
    mockIsPostPrimeTraceEligible.mockResolvedValue(true);

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    await waitFor(() => expect(getByTestId('post-prime-skip-button')).toBeTruthy());
    fireEvent.press(getByTestId('post-prime-skip-button'));

    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalledWith('ManualReinforcement', expect.anything());
  });

  it('starts post-prime trace and returns to reflection after a completed trace result', async () => {
    mockIsPostPrimeTraceEligible.mockResolvedValue(true);

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    await waitFor(() => expect(getByTestId('post-prime-trace-button')).toBeTruthy());
    fireEvent.press(getByTestId('post-prime-trace-button'));

    expect(mockMarkPostPrimeTraceAttemptStarted).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('ManualReinforcement', {
        source: 'post_prime_trace',
        anchorId: 'test-anchor-id',
      })
    );

    const flowId = usePostPrimeTraceStore.getState().activeFlow?.flowId;
    expect(flowId).toBeTruthy();

    act(() => {
      usePostPrimeTraceStore.getState().finishFlow(flowId!, 'completed');
    });

    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
  });

  it('handles API errors gracefully after sealing', async () => {
    const error = new Error('Network error');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

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

  it('replaces back to Vault after a creation-launched activation completes', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        activationType: 'visual',
        returnTo: 'vault',
        durationOverride: TEST_ACTIVATION_DURATION_SECONDS,
      },
    });

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Vault'));
  });
});
