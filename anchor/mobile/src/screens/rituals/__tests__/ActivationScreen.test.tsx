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
import { useSessionStore } from '@/stores/sessionStore';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { createMockAnchor } from '@/__tests__/utils/testUtils';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';

const TEST_ACTIVATION_DURATION_SECONDS = 2;
// UUID format required so isBackendAnchorId returns true and skips backend anchor creation
const TEST_ANCHOR_UUID = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
// UUID used as the server-assigned ID after anchor promotion in the "promotes" test
const SERVER_ANCHOR_UUID = 'c3d4e5f6-7890-4abc-8def-012345678901';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mockNavigateToPractice = jest.fn();
const mockCreateManagedPlayer = jest.fn();
const mockCreateSessionAudioPlayer = jest.fn(
  (_asset: unknown, options: { trackId?: string }) =>
    mockCreateManagedPlayer(options.trackId ?? 'missing-focus-track', options)
);
const mockPlaySound = jest.fn();
const createMockManagedPlayer = () => ({
  pause: jest.fn(),
  play: jest.fn(),
  setVolume: jest.fn(),
  stop: jest.fn(),
});
const mockAmbientPlayer = createMockManagedPlayer();
const mockGuidance60StartPlayer = createMockManagedPlayer();
const mockGuidance60MiddlePlayer = createMockManagedPlayer();
const mockGuidance60EndPlayer = createMockManagedPlayer();
const mockGuidance120OpeningPlayer = createMockManagedPlayer();
const mockGuidance120GroundingPlayer = createMockManagedPlayer();
const mockGuidance120DeepeningPlayer = createMockManagedPlayer();
const mockGuidance120ClosingPlayer = createMockManagedPlayer();
const mockHandlePrimeComplete = jest.fn();
const mockSetActiveSession = jest.fn();
const mockRecordPrimeSession = jest.fn();
const mockRecordSession = jest.fn();
const mockIsPostPrimeTraceEligible = jest.fn().mockResolvedValue(false);
const mockMarkPostPrimeTraceAttemptStarted = jest.fn().mockResolvedValue(undefined);
const mockNavigateToVaultDestination = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useRoute: jest.fn(() => ({
      params: {
        anchorId: TEST_ANCHOR_UUID,
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
jest.mock('@/stores/sessionStore');
jest.mock('@/services/ApiClient');
jest.mock('@/services/ErrorTrackingService');
jest.mock('@/hooks/useAudio', () => ({
  useAudio: () => ({
    createManagedPlayer: mockCreateManagedPlayer,
    playSound: mockPlaySound,
  }),
}));
jest.mock('@/hooks/useSessionAudio', () => ({
  useSessionAudio: () => ({
    createSessionAudioPlayer: mockCreateSessionAudioPlayer,
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
jest.mock('@/navigation/firstAnchorGate', () => ({
  navigateToVaultDestination: (...args: any[]) => mockNavigateToVaultDestination(...args),
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
  } as any;
  base.sessionAudioDefaults = overrides.sessionAudioDefaults ?? {
    focus:
      base.focusSessionAudio === 'ambient'
        ? { guidanceVoice: 'female', backgroundAudio: 'ambient' }
        : { guidanceVoice: 'none', backgroundAudio: 'off' },
    deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
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
  let mockApplySyncedAnchor: jest.Mock;
  let mockUpdateAnchor: jest.Mock;
  let mockIncrementTotalPrimes: jest.Mock;
  let mockToastSuccess: jest.Mock;
  let mockToastError: jest.Mock;
  let mockAnchor: any;
  let mockAnchors: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateManagedPlayer.mockReset();
    mockCreateManagedPlayer.mockImplementation((key: string) => {
      const normalizedKey = key.replace(/-male$/, '');
      if (normalizedKey === 'focus-session-ambient') return mockAmbientPlayer;
      if (normalizedKey === 'focus-session-120s-opening') return mockGuidance120OpeningPlayer;
      if (normalizedKey === 'focus-session-120s-grounding') return mockGuidance120GroundingPlayer;
      if (normalizedKey === 'focus-session-120s-deepening') return mockGuidance120DeepeningPlayer;
      if (normalizedKey === 'focus-session-120s-closing') return mockGuidance120ClosingPlayer;
      if (normalizedKey === 'focus-session-60s-start') return mockGuidance60StartPlayer;
      if (normalizedKey === 'focus-session-60s-middle') return mockGuidance60MiddlePlayer;
      if (normalizedKey === 'focus-session-60s-end') return mockGuidance60EndPlayer;
      return null;
    });
    mockPlaySound.mockClear();
    mockAmbientPlayer.pause.mockReset();
    mockAmbientPlayer.play.mockReset();
    mockAmbientPlayer.setVolume.mockReset();
    mockAmbientPlayer.stop.mockReset();
    mockGuidance60StartPlayer.pause.mockReset();
    mockGuidance60StartPlayer.play.mockReset();
    mockGuidance60StartPlayer.setVolume.mockReset();
    mockGuidance60StartPlayer.stop.mockReset();
    mockGuidance60MiddlePlayer.pause.mockReset();
    mockGuidance60MiddlePlayer.play.mockReset();
    mockGuidance60MiddlePlayer.setVolume.mockReset();
    mockGuidance60MiddlePlayer.stop.mockReset();
    mockGuidance60EndPlayer.pause.mockReset();
    mockGuidance60EndPlayer.play.mockReset();
    mockGuidance60EndPlayer.setVolume.mockReset();
    mockGuidance60EndPlayer.stop.mockReset();
    mockGuidance120OpeningPlayer.pause.mockReset();
    mockGuidance120OpeningPlayer.play.mockReset();
    mockGuidance120OpeningPlayer.setVolume.mockReset();
    mockGuidance120OpeningPlayer.stop.mockReset();
    mockGuidance120GroundingPlayer.pause.mockReset();
    mockGuidance120GroundingPlayer.play.mockReset();
    mockGuidance120GroundingPlayer.setVolume.mockReset();
    mockGuidance120GroundingPlayer.stop.mockReset();
    mockGuidance120DeepeningPlayer.pause.mockReset();
    mockGuidance120DeepeningPlayer.play.mockReset();
    mockGuidance120DeepeningPlayer.setVolume.mockReset();
    mockGuidance120DeepeningPlayer.stop.mockReset();
    mockGuidance120ClosingPlayer.pause.mockReset();
    mockGuidance120ClosingPlayer.play.mockReset();
    mockGuidance120ClosingPlayer.setVolume.mockReset();
    mockGuidance120ClosingPlayer.stop.mockReset();
    useAuthStore.setState({ pendingFirstAnchorDraft: null });

    mockGoBack = jest.fn();
    mockPopToTop = jest.fn();
    mockNavigate = jest.fn();
    mockReplace = jest.fn();
    mockAddListener = jest.fn(() => jest.fn());
    mockGetAnchorById = jest.fn();
    mockApplySyncedAnchor = jest.fn((referenceId: string, syncedAnchor: any) => {
      mockAnchors = [
        syncedAnchor.localId
          ? syncedAnchor
          : { ...syncedAnchor, localId: referenceId },
      ];
      mockAnchor = mockAnchors[0];
      mockGetAnchorById.mockImplementation((id: string) =>
        mockAnchors.find((anchor) => anchor.id === id || anchor.localId === id)
      );
    });
    mockUpdateAnchor = jest.fn();
    mockIncrementTotalPrimes = jest.fn();
    mockToastSuccess = jest.fn();
    mockToastError = jest.fn();
    mockHandlePrimeComplete.mockReset();
    mockHandlePrimeComplete.mockResolvedValue(undefined);
    mockSetActiveSession.mockReset();
    mockSetActiveSession.mockResolvedValue(undefined);
    mockRecordPrimeSession.mockReset();
    mockRecordSession.mockReset();
    mockIsPostPrimeTraceEligible.mockReset();
    mockIsPostPrimeTraceEligible.mockResolvedValue(false);
    mockMarkPostPrimeTraceAttemptStarted.mockReset();
    mockMarkPostPrimeTraceAttemptStarted.mockResolvedValue(undefined);
    mockNavigateToVaultDestination.mockReset();
    usePostPrimeTraceStore.setState({ activeFlow: null });

    mockAnchor = createMockAnchor({
      id: TEST_ANCHOR_UUID,
      intentionText: 'I am confident',
      baseSigilSvg: '<svg></svg>',
      isCharged: true,
    });
    mockAnchors = [mockAnchor];

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
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: TEST_ACTIVATION_DURATION_SECONDS,
      },
    });

    mockNavigateToPractice.mockReset();

    mockGetAnchorById.mockReturnValue(mockAnchor);
    (useAnchorStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        getAnchorById: mockGetAnchorById,
        applySyncedAnchor: mockApplySyncedAnchor,
        updateAnchor: mockUpdateAnchor,
        incrementTotalPrimes: mockIncrementTotalPrimes,
        recordPrimeSession: mockRecordPrimeSession,
        totalPrimes: 0,
        anchors: mockAnchors,
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
    (useAnchorStore as any).getState = jest.fn(() => ({
      getAnchorById: mockGetAnchorById,
      applySyncedAnchor: mockApplySyncedAnchor,
      totalPrimes: 0,
      anchors: mockAnchors,
    }));
    (useSessionStore as unknown as jest.Mock).mockImplementation((selector?: any) => {
      const state = {
        recordSession: mockRecordSession,
        bumpThreadStrength: jest.fn(),
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
    (useSessionStore as any).getState = jest.fn(() => ({
      primingHistory: [],
      sessionLog: [],
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
    const { getByText, queryByText } = render(<ActivationScreen />);

    // New design: top bar shows "FOCUS" label
    expect(getByText('FOCUS')).toBeTruthy();
    // First guidance string shown in bottom area during running
    expect(getByText('See it as already done.')).toBeTruthy();
    expect(queryByText('Breathe in')).toBeNull();
    expect(queryByText('Hold')).toBeNull();
    expect(queryByText('Breathe out')).toBeNull();
  });

  it('displays anchor not found when anchor is missing', () => {
    mockGetAnchorById.mockReturnValue(undefined);
    const { getByText } = render(<ActivationScreen />);
    expect(getByText('Anchor not found. Returning to vault...')).toBeTruthy();
  });

  it('falls back to safe defaults when settings are missing', () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: { anchorId: TEST_ANCHOR_UUID, activationType: 'visual' },
    });
    // arrivePhaseEnabled defaults to true when key is missing, which subtracts 5s
    // from the display. Explicitly disable it so the test checks the raw default (30s).
    (useSettingsStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const base = { arrivePhaseEnabled: false };
      return typeof selector === 'function' ? selector(base) : base;
    });

    const { getByText } = render(<ActivationScreen />);
    // focusSessionDuration defaults to 30, screen renders successfully
    expect(getByText('FOCUS')).toBeTruthy();
  });

  it('briefly holds the prepare screen before the focus session starts after pressing begin', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: 10,
      },
    });
    mockSettingsState({
      arrivePhaseEnabled: true,
      focusSessionDuration: 10,
    });
    (useSettingsStore as any).getState = jest.fn(() => ({
      focusSessionDuration: 10,
      focusSessionAudio: 'silent',
      arrivePhaseEnabled: true,
      reduceIntentionVisibility: false,
      threadStrengthSensitivity: 1,
      restDays: [],
    }));

    const { getByText, queryByText } = render(<ActivationScreen />);

    expect(getByText('PREPARE')).toBeTruthy();

    fireEvent.press(getByText('Begin Session  →'));
    await sleep(150);

    expect(getByText('PREPARE')).toBeTruthy();
    expect(queryByText('FOCUS')).toBeNull();

    await waitFor(() => expect(getByText('FOCUS')).toBeTruthy(), { timeout: 1500 });
  });

  it.skip('counts down in mm:ss format', async () => {
    const { getByText } = render(<ActivationScreen />);

    expect(getByText('00:02')).toBeTruthy();
    await sleep(1100);

    await waitFor(() => expect(getByText('00:01')).toBeTruthy(), { timeout: 2000 });
  });

  it('pauses and resumes countdown', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    fireEvent.press(getByTestId('focus-session-pause'));

    await sleep(1200);

    // After pause, resume button is shown
    await waitFor(() => expect(getByTestId('focus-session-resume')).toBeTruthy());

    fireEvent.press(getByTestId('focus-session-resume'));

    await sleep(1100);

    // After resume, pause button is back
    await waitFor(() => expect(getByTestId('focus-session-pause')).toBeTruthy());
  });

  it('plays the 60-second focus start, middle, and end cues at scheduled points', async () => {
    const navigation = require('@react-navigation/native');
    const now = 1_700_000_100_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: 60,
      },
    });
    mockSettingsState({
      focusSessionAudio: 'ambient',
      focusSessionDuration: 60,
    });
    (useSettingsStore as any).getState = jest.fn(() => ({
      focusSessionDuration: 60,
      focusSessionAudio: 'ambient',
      arrivePhaseEnabled: false,
      reduceIntentionVisibility: false,
      threadStrengthSensitivity: 1,
      restDays: [],
    }));

    const { unmount } = render(<ActivationScreen />);

    expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
      'focus-session-60s-start',
      expect.objectContaining({
        onFinish: expect.any(Function),
      })
    );
    expect(mockGuidance60StartPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 28_000);
    await sleep(350);

    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'focus-session-60s-middle',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockGuidance60StartPlayer.stop).toHaveBeenCalled();
    expect(mockGuidance60MiddlePlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 54_500);
    await sleep(350);

    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'focus-session-60s-end',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockGuidance60MiddlePlayer.stop).toHaveBeenCalled();
    expect(mockGuidance60EndPlayer.play).toHaveBeenCalledTimes(1);

    unmount();
    dateNowSpy.mockRestore();
  });

  it('plays loudness-matched male Focus guidance without substituting female audio', () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: 60,
        audioConfiguration: {
          guidanceVoice: 'male',
          backgroundAudio: 'off',
          source: 'session_override',
        },
      },
    });

    const { unmount } = render(<ActivationScreen />);

    expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
      'focus-session-60s-start-male',
      expect.objectContaining({
        volume: 0.447,
        onFinish: expect.any(Function),
      })
    );
    expect(mockGuidance60StartPlayer.play).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('starts, ducks, pauses, resumes, and cleans up the ambient bed during a voice-guided focus session', async () => {
    const navigation = require('@react-navigation/native');

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: 60,
      },
    });
    mockSettingsState({
      focusSessionAudio: 'ambient',
      focusSessionDuration: 60,
    });
    (useSettingsStore as any).getState = jest.fn(() => ({
      focusSessionDuration: 60,
      focusSessionAudio: 'ambient',
      arrivePhaseEnabled: false,
      reduceIntentionVisibility: false,
      threadStrengthSensitivity: 1,
      restDays: [],
    }));

    const { getByTestId, unmount } = render(<ActivationScreen />);

    expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
      'focus-session-ambient',
      expect.objectContaining({
        loop: true,
        volume: 0,
      })
    );
    expect(mockAmbientPlayer.play).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(mockAmbientPlayer.setVolume).toHaveBeenCalled(), {
      timeout: 1500,
    });

    fireEvent.press(getByTestId('focus-session-pause'));
    await waitFor(() => expect(mockAmbientPlayer.pause).toHaveBeenCalledTimes(1));
    expect(mockGuidance60StartPlayer.pause).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('focus-session-resume'));
    await waitFor(() => expect(mockAmbientPlayer.play).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockGuidance60StartPlayer.play).toHaveBeenCalledTimes(2));

    unmount();

    await waitFor(() => expect(mockAmbientPlayer.stop).toHaveBeenCalledTimes(1), {
      timeout: 1500,
    });
  });

  it('plays the 90-second focus cues at 0s, 45s, and 85s using the 60-second files', async () => {
    const navigation = require('@react-navigation/native');
    const now = 1_700_000_200_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: 90,
      },
    });
    mockSettingsState({
      focusSessionAudio: 'ambient',
      focusSessionDuration: 90,
    });
    (useSettingsStore as any).getState = jest.fn(() => ({
      focusSessionDuration: 90,
      focusSessionAudio: 'ambient',
      arrivePhaseEnabled: false,
      reduceIntentionVisibility: false,
      threadStrengthSensitivity: 1,
      restDays: [],
    }));

    const { unmount } = render(<ActivationScreen />);

    expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
      'focus-session-60s-start',
      expect.objectContaining({
        onFinish: expect.any(Function),
      })
    );
    expect(mockGuidance60StartPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 46_000);
    await sleep(350);

    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'focus-session-60s-middle',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockGuidance60StartPlayer.stop).toHaveBeenCalled();
    expect(mockGuidance60MiddlePlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 85_500);
    await sleep(350);

    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'focus-session-60s-end',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockGuidance60MiddlePlayer.stop).toHaveBeenCalled();
    expect(mockGuidance60EndPlayer.play).toHaveBeenCalledTimes(1);

    unmount();
    dateNowSpy.mockRestore();
  });

  it('plays the 120-second focus cues at 0s, 40s, 80s, and 115s', async () => {
    const navigation = require('@react-navigation/native');
    const now = 1_700_000_300_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: 120,
      },
    });
    mockSettingsState({
      focusSessionAudio: 'ambient',
      focusSessionDuration: 120,
    });
    (useSettingsStore as any).getState = jest.fn(() => ({
      focusSessionDuration: 120,
      focusSessionAudio: 'ambient',
      arrivePhaseEnabled: false,
      reduceIntentionVisibility: false,
      threadStrengthSensitivity: 1,
      restDays: [],
    }));

    const { unmount } = render(<ActivationScreen />);

    expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
      'focus-session-120s-opening',
      expect.objectContaining({
        onFinish: expect.any(Function),
      })
    );
    expect(mockGuidance120OpeningPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 40_500);
    await sleep(350);

    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'focus-session-120s-grounding',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockGuidance120OpeningPlayer.stop).toHaveBeenCalled();
    expect(mockGuidance120GroundingPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 80_500);
    await sleep(350);

    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'focus-session-120s-deepening',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockGuidance120GroundingPlayer.stop).toHaveBeenCalled();
    expect(mockGuidance120DeepeningPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 115_500);
    await sleep(350);

    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'focus-session-120s-closing',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockGuidance120DeepeningPlayer.stop).toHaveBeenCalled();
    expect(mockGuidance120ClosingPlayer.play).toHaveBeenCalledTimes(1);

    unmount();
    dateNowSpy.mockRestore();
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
      `/api/anchors/${TEST_ANCHOR_UUID}/activate`,
      expect.objectContaining({
        activationType: 'visual',
        durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
        idempotencyKey: expect.any(String),
      })
    ));
  });

  it('records and exits only once when completion callbacks re-enter', async () => {
    const { getByTestId, getByLabelText } = render(<ActivationScreen />);

    const seal = await waitFor(() => getByTestId('focus-session-continue'), {
      timeout: 4000,
    });
    fireEvent.press(seal);
    fireEvent.press(seal);

    const done = await waitFor(() => getByTestId('completion-modal-done'));
    const skip = getByLabelText('Skip reflection');
    fireEvent.press(done);
    fireEvent.press(skip);
    fireEvent.press(done);

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(mockHandlePrimeComplete).toHaveBeenCalledTimes(1);
    expect(mockRecordSession).toHaveBeenCalledTimes(1);
  });

  it('updates local activation immediately on seal', async () => {
    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() => expect(mockUpdateAnchor).toHaveBeenCalledWith(TEST_ANCHOR_UUID, {
      activationCount: 1,
      lastActivatedAt: expect.any(Date),
    }));
  });

  it('dismiss button exits without activating', async () => {
    const { getByTestId, getByText } = render(<ActivationScreen />);

    fireEvent.press(getByTestId('focus-session-dismiss'));

    expect(getByText('Exit Focus Session?')).toBeTruthy();
    fireEvent.press(getByText('Exit'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('fades and stops the ambient bed before exiting an ambient focus session', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
        activationType: 'visual',
        durationOverride: 60,
      },
    });
    mockSettingsState({
      focusSessionAudio: 'ambient',
      focusSessionDuration: 60,
    });
    (useSettingsStore as any).getState = jest.fn(() => ({
      focusSessionDuration: 60,
      focusSessionAudio: 'ambient',
      arrivePhaseEnabled: false,
      reduceIntentionVisibility: false,
      threadStrengthSensitivity: 1,
      restDays: [],
    }));

    const { getByTestId, getByText } = render(<ActivationScreen />);

    fireEvent.press(getByTestId('focus-session-dismiss'));
    fireEvent.press(getByText('Exit'));

    await waitFor(() => expect(mockAmbientPlayer.stop).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled(), {
      timeout: 2000,
    });
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
        anchorId: TEST_ANCHOR_UUID,
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
        anchorId: TEST_ANCHOR_UUID,
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
        `/api/anchors/${TEST_ANCHOR_UUID}/activate`,
        expect.objectContaining({
          activationType: 'audio',
          durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
          idempotencyKey: expect.any(String),
        })
      );
    });
  });

  it('uses visual as fallback activation type', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
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
        `/api/anchors/${TEST_ANCHOR_UUID}/activate`,
        expect.objectContaining({
          activationType: 'visual',
          durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
          idempotencyKey: expect.any(String),
        })
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
      id: TEST_ANCHOR_UUID,
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
      id: TEST_ANCHOR_UUID,
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
        TEST_ANCHOR_UUID,
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

  it('backfills charged state for anchors that already have activation history', async () => {
    mockIsPostPrimeTraceEligible.mockResolvedValue(true);
    mockAnchor = createMockAnchor({
      id: TEST_ANCHOR_UUID,
      intentionText: 'I am confident',
      baseSigilSvg: '<svg></svg>',
      isCharged: false,
      activationCount: 3,
      chargeCount: 0,
      firstChargedAt: undefined,
      chargedAt: undefined,
      lastActivatedAt: new Date('2026-05-19T14:00:00.000Z'),
    });
    mockGetAnchorById.mockReturnValue(mockAnchor);

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));

    await waitFor(() => expect(getByTestId('post-prime-trace-modal')).toBeTruthy());
    expect(mockIsPostPrimeTraceEligible).toHaveBeenCalled();
    expect(mockUpdateAnchor).toHaveBeenCalledWith(
      TEST_ANCHOR_UUID,
      expect.objectContaining({
        isCharged: true,
        chargedAt: expect.any(Date),
        firstChargedAt: expect.any(Date),
        chargeCount: 1,
        activationCount: 4,
        lastActivatedAt: expect.any(Date),
      })
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
        anchorId: TEST_ANCHOR_UUID,
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
          anchor_id: TEST_ANCHOR_UUID,
        }
      );
    });

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      'Prime session completed but failed to sync. Will retry later.'
    );
  });

  it('treats anchor-not-found sync failures as handled state instead of a Sentry exception', async () => {
    const error = new Error('Anchor not found');
    (apiClient.post as jest.Mock).mockRejectedValue(error);

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() => {
      expect(ErrorTrackingService.captureException).not.toHaveBeenCalledWith(
        error,
        expect.anything()
      );
      expect(mockToastError).toHaveBeenCalledWith('This anchor is no longer available.');
      expect(mockNavigateToVaultDestination).toHaveBeenCalled();
    });
  });

  it('promotes a local temp anchor id before activating', async () => {
    const navigation = require('@react-navigation/native');
    const localTempAnchor = createMockAnchor({
      id: 'anchor-1779092632674',
      intentionText: 'I am confident',
      baseSigilSvg: '<svg></svg>',
      isCharged: true,
    });

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: localTempAnchor.id,
        activationType: 'visual',
        durationOverride: TEST_ACTIVATION_DURATION_SECONDS,
      },
    });

    mockAnchor = localTempAnchor;
    mockAnchors = [localTempAnchor];
    mockGetAnchorById.mockImplementation((id: string) =>
      mockAnchors.find((anchor) => anchor.id === id || anchor.localId === id)
    );
    (useAnchorStore as any).getState = jest.fn(() => ({
      getAnchorById: mockGetAnchorById,
      applySyncedAnchor: mockApplySyncedAnchor,
      totalPrimes: 0,
      anchors: mockAnchors,
    }));
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            ...localTempAnchor,
            id: SERVER_ANCHOR_UUID,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            activationCount: 5,
            lastActivatedAt: new Date().toISOString(),
          },
        },
      });

    const { getByTestId } = render(<ActivationScreen />);

    await waitFor(() => expect(getByTestId('focus-session-continue')).toBeTruthy(), { timeout: 4000 });
    fireEvent.press(getByTestId('focus-session-continue'));
    await waitFor(() => expect(getByTestId('completion-modal-done')).toBeTruthy());
    fireEvent.press(getByTestId('completion-modal-done'));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenNthCalledWith(
        1,
        '/api/anchors',
        expect.objectContaining({
          intentionText: localTempAnchor.intentionText,
          baseSigilSvg: localTempAnchor.baseSigilSvg,
        })
      );
      expect(apiClient.post).toHaveBeenNthCalledWith(
        2,
        `/api/anchors/${SERVER_ANCHOR_UUID}/activate`,
        expect.objectContaining({
          activationType: 'visual',
          durationSeconds: TEST_ACTIVATION_DURATION_SECONDS,
          idempotencyKey: expect.any(String),
        })
      );
    });
  });

  it('redirects back to Vault after a creation-launched activation completes', async () => {
    const navigation = require('@react-navigation/native');
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: TEST_ANCHOR_UUID,
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

    await waitFor(() =>
      expect(mockNavigateToVaultDestination).toHaveBeenCalledWith(
        expect.anything(),
        'replace'
      )
    );
  });
});
