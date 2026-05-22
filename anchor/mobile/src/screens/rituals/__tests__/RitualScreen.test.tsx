import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { RitualScreen } from '../RitualScreen';
import { createMockAnchor } from '@/__tests__/utils/testUtils';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mockCreateManagedPlayer = jest.fn();
const mockPlaySound = jest.fn();
const mockHandlePrimeComplete = jest.fn();
const mockNavigateToPractice = jest.fn();
const mockNavigateToVaultDestination = jest.fn();
const mockUpdateAnchor = jest.fn();
const mockRecordSession = jest.fn();
const mockQueueProgressionMilestones = jest.fn();

const createMockManagedPlayer = () => ({
  pause: jest.fn(),
  play: jest.fn(),
  setVolume: jest.fn(),
  stop: jest.fn(),
});

const mockPrimeAmbientPlayer = createMockManagedPlayer();
const mockPrimeOpeningPlayer = createMockManagedPlayer();
const mockPrimeIntentionPlayer = createMockManagedPlayer();
const mockPrimeDeepeningPlayer = createMockManagedPlayer();
const mockPrimeClosingPlayer = createMockManagedPlayer();
const mockPrime5mOpeningPlayer = createMockManagedPlayer();
const mockPrime5mIntentionPlayer = createMockManagedPlayer();
const mockPrime5mDeepeningPlayer = createMockManagedPlayer();
const mockPrime5mReturnPlayer = createMockManagedPlayer();
const mockPrime5mReinforcementPlayer = createMockManagedPlayer();
const mockPrime5mClosingPlayer = createMockManagedPlayer();
const mockPrime10mOpeningPlayer = createMockManagedPlayer();
const mockPrime10mIntentionPlayer = createMockManagedPlayer();
const mockPrime10mDeepeningPlayer = createMockManagedPlayer();
const mockPrime10mReturnPlayer = createMockManagedPlayer();
const mockPrime10mReinforcementPlayer = createMockManagedPlayer();
const mockPrime10mVisualizationPlayer = createMockManagedPlayer();
const mockPrime10mSettlingPlayer = createMockManagedPlayer();
const mockPrime10mClosingPlayer = createMockManagedPlayer();
const mockPrime15mOpeningPlayer = createMockManagedPlayer();
const mockPrime15mIntentionPlayer = createMockManagedPlayer();
const mockPrime15mDeepeningPlayer = createMockManagedPlayer();
const mockPrime15mReturnPlayer = createMockManagedPlayer();
const mockPrime15mReinforcementPlayer = createMockManagedPlayer();
const mockPrime15mVisualizationPlayer = createMockManagedPlayer();
const mockPrime15mSettlingPlayer = createMockManagedPlayer();
const mockPrime15mClosingPlayer = createMockManagedPlayer();

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useRoute: jest.fn(() => ({
      params: {
        anchorId: 'test-anchor-id',
        ritualType: 'ritual',
        durationSeconds: 120,
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
  Reanimated.default.call = () => {};
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
  Reanimated.useSharedValue = (init: any) => {
    const ref = React.useRef({ value: init });
    return ref.current;
  };
  return Reanimated;
});

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToPractice: mockNavigateToPractice,
  }),
}));

jest.mock('@/stores/anchorStore');
jest.mock('@/stores/authStore');
jest.mock('@/stores/sessionStore');
jest.mock('@/stores/settingsStore');
jest.mock('@/hooks/useAudio', () => ({
  useAudio: () => ({
    createManagedPlayer: mockCreateManagedPlayer,
    playSound: mockPlaySound,
  }),
}));
jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    handlePrimeComplete: mockHandlePrimeComplete,
  }),
}));
jest.mock('@/services/AuthService', () => ({
  AuthService: {
    getIdToken: jest.fn().mockResolvedValue('mock-jwt-token'),
  },
}));
jest.mock('@/services/BackendAnchorService', () => ({
  __esModule: true,
  default: {
    ensureServerAnchor: jest.fn().mockResolvedValue({ id: 'test-anchor-id' }),
  },
  isBackendAnchorId: jest.fn(() => false),
}));
jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({ data: {} }),
  },
}));
jest.mock('@/utils/postPrimeTraceEligibility', () => ({
  isPostPrimeTraceEligible: jest.fn().mockResolvedValue(false),
  markPostPrimeTraceAttemptStarted: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/utils/progressionMilestones', () => ({
  queueProgressionMilestonesFromStores: (...args: any[]) =>
    mockQueueProgressionMilestones(...args),
}));
jest.mock('@/navigation/firstAnchorGate', () => ({
  navigateToVaultDestination: (...args: any[]) => mockNavigateToVaultDestination(...args),
}));
jest.mock('../utils/useMissingAnchorRedirect', () => ({
  useMissingAnchorRedirect: jest.fn(),
}));
jest.mock('expo-speech', () => ({
  stop: jest.fn(),
  speak: jest.fn(),
}));
jest.mock('@/components/common', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SigilSvg: ({ width, height }: { width: number; height: number }) => (
      <View testID="sigil-svg" style={{ width, height }} />
    ),
    OptimizedImage: ({ style }: { style: any }) => <View testID="optimized-image" style={style} />,
    PremiumAnchorGlow: () => <View testID="premium-anchor-glow" />,
    ZenBackground: () => <View testID="zen-background" />,
  };
});

const mockSettingsState = (overrides: Record<string, unknown> = {}) => {
  const base = {
    soundEffectsEnabled: true,
    focusSessionDuration: 30,
    primeSessionDuration: 120,
    primeSessionAudio: 'ambient',
    reduceIntentionVisibility: false,
    debugLoggingEnabled: false,
    ...overrides,
  };

  (useSettingsStore as unknown as jest.Mock).mockImplementation((selector: any) =>
    typeof selector === 'function' ? selector(base) : base
  );
  (useSettingsStore as any).getState = jest.fn(() => base);
};

describe('RitualScreen', () => {
  let mockGoBack: jest.Mock;
  let mockNavigate: jest.Mock;
  let mockReplace: jest.Mock;
  let mockAddListener: jest.Mock;
  let mockAnchor: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateManagedPlayer.mockImplementation((key: string) => {
      if (key === 'deep-prime-ambient') return mockPrimeAmbientPlayer;
      if (key === 'deep-prime-2m-opening') return mockPrimeOpeningPlayer;
      if (key === 'deep-prime-2m-intention') return mockPrimeIntentionPlayer;
      if (key === 'deep-prime-2m-deepening') return mockPrimeDeepeningPlayer;
      if (key === 'deep-prime-2m-closing') return mockPrimeClosingPlayer;
      if (key === 'deep-prime-5m-opening') return mockPrime5mOpeningPlayer;
      if (key === 'deep-prime-5m-intention') return mockPrime5mIntentionPlayer;
      if (key === 'deep-prime-5m-deepening') return mockPrime5mDeepeningPlayer;
      if (key === 'deep-prime-5m-return') return mockPrime5mReturnPlayer;
      if (key === 'deep-prime-5m-reinforcement') return mockPrime5mReinforcementPlayer;
      if (key === 'deep-prime-5m-closing') return mockPrime5mClosingPlayer;
      if (key === 'deep-prime-10m-opening') return mockPrime10mOpeningPlayer;
      if (key === 'deep-prime-10m-intention') return mockPrime10mIntentionPlayer;
      if (key === 'deep-prime-10m-deepening') return mockPrime10mDeepeningPlayer;
      if (key === 'deep-prime-10m-return') return mockPrime10mReturnPlayer;
      if (key === 'deep-prime-10m-reinforcement') return mockPrime10mReinforcementPlayer;
      if (key === 'deep-prime-10m-visualization') return mockPrime10mVisualizationPlayer;
      if (key === 'deep-prime-10m-settling') return mockPrime10mSettlingPlayer;
      if (key === 'deep-prime-10m-closing') return mockPrime10mClosingPlayer;
      if (key === 'deep-prime-15m-opening') return mockPrime15mOpeningPlayer;
      if (key === 'deep-prime-15m-intention') return mockPrime15mIntentionPlayer;
      if (key === 'deep-prime-15m-deepening') return mockPrime15mDeepeningPlayer;
      if (key === 'deep-prime-15m-return') return mockPrime15mReturnPlayer;
      if (key === 'deep-prime-15m-reinforcement') return mockPrime15mReinforcementPlayer;
      if (key === 'deep-prime-15m-visualization') return mockPrime15mVisualizationPlayer;
      if (key === 'deep-prime-15m-settling') return mockPrime15mSettlingPlayer;
      if (key === 'deep-prime-15m-closing') return mockPrime15mClosingPlayer;
      return null;
    });

    [
      mockPrimeAmbientPlayer,
      mockPrimeOpeningPlayer,
      mockPrimeIntentionPlayer,
      mockPrimeDeepeningPlayer,
      mockPrimeClosingPlayer,
      mockPrime5mOpeningPlayer,
      mockPrime5mIntentionPlayer,
      mockPrime5mDeepeningPlayer,
      mockPrime5mReturnPlayer,
      mockPrime5mReinforcementPlayer,
      mockPrime5mClosingPlayer,
      mockPrime10mOpeningPlayer,
      mockPrime10mIntentionPlayer,
      mockPrime10mDeepeningPlayer,
      mockPrime10mReturnPlayer,
      mockPrime10mReinforcementPlayer,
      mockPrime10mVisualizationPlayer,
      mockPrime10mSettlingPlayer,
      mockPrime10mClosingPlayer,
      mockPrime15mOpeningPlayer,
      mockPrime15mIntentionPlayer,
      mockPrime15mDeepeningPlayer,
      mockPrime15mReturnPlayer,
      mockPrime15mReinforcementPlayer,
      mockPrime15mVisualizationPlayer,
      mockPrime15mSettlingPlayer,
      mockPrime15mClosingPlayer,
    ].forEach((player) => {
      player.pause.mockReset();
      player.play.mockReset();
      player.setVolume.mockReset();
      player.stop.mockReset();
    });

    mockGoBack = jest.fn();
    mockNavigate = jest.fn();
    mockReplace = jest.fn();
    mockAddListener = jest.fn(() => jest.fn());
    mockHandlePrimeComplete.mockReset();
    mockHandlePrimeComplete.mockResolvedValue(undefined);
    mockNavigateToPractice.mockReset();
    mockNavigateToVaultDestination.mockReset();
    mockUpdateAnchor.mockReset();
    mockUpdateAnchor.mockResolvedValue(undefined);
    mockRecordSession.mockReset();
    mockQueueProgressionMilestones.mockReset();
    mockQueueProgressionMilestones.mockResolvedValue(undefined);

    mockAnchor = createMockAnchor({
      id: 'test-anchor-id',
      intentionText: 'I am focused',
      baseSigilSvg: '<svg></svg>',
      isCharged: true,
    });

    const navigation = require('@react-navigation/native');
    navigation.useNavigation.mockReturnValue({
      goBack: mockGoBack,
      navigate: mockNavigate,
      replace: mockReplace,
      addListener: mockAddListener,
    });
    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        ritualType: 'ritual',
        durationSeconds: 120,
      },
    });

    (useAnchorStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        getAnchorById: jest.fn(() => mockAnchor),
        updateAnchor: mockUpdateAnchor,
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        pendingFirstAnchorDraft: null,
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
    (useSessionStore as unknown as jest.Mock).mockImplementation((selector: any) => {
      const state = {
        recordSession: mockRecordSession,
        bumpThreadStrength: jest.fn(),
      };
      return typeof selector === 'function' ? selector(state) : state;
    });

    mockSettingsState();
  });

  it('removes active Deep Prime breath text and schedules the 2-minute immersive cues', async () => {
    const now = 1_700_000_400_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const { getByText, queryByText, unmount } = render(<RitualScreen />);

    fireEvent.press(getByText(/Begin priming/i));

    await waitFor(() => expect(getByText(/breathwork/i)).toBeTruthy());
    expect(queryByText('Breathe in')).toBeNull();
    expect(queryByText('Hold')).toBeNull();
    expect(queryByText('Breathe out')).toBeNull();
    expect(queryByText('Slow inhale. Longer exhale.')).toBeNull();

    expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
      'deep-prime-ambient',
      expect.objectContaining({
        loop: true,
        volume: 0,
      })
    );
    expect(mockPrimeAmbientPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPrimeOpeningPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 30_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-2m-intention',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrimeOpeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrimeIntentionPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 70_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-2m-deepening',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrimeIntentionPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrimeDeepeningPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 110_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-2m-closing',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrimeDeepeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrimeClosingPlayer.play).toHaveBeenCalledTimes(1);

    unmount();
    dateNowSpy.mockRestore();
  });

  it('renders the active Deep Prime sigil at the Focus Session hero size', async () => {
    const { getByText, getByTestId } = render(<RitualScreen />);

    fireEvent.press(getByText(/Begin priming/i));

    await waitFor(() => expect(getByText(/breathwork/i)).toBeTruthy());
    expect(getByTestId('sigil-svg').props.style).toEqual(
      expect.objectContaining({
        width: 280,
        height: 280,
      })
    );
  });

  it('auto-saves and returns to Practice after the Deep Prime seal hold', async () => {
    const navigation = require('@react-navigation/native');
    const now = 1_700_001_000_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        ritualType: 'ritual',
        durationSeconds: 30,
        returnTo: 'practice',
      },
    });

    const { getByText, getByTestId, queryByTestId, unmount } = render(<RitualScreen />);

    fireEvent.press(getByText(/Begin priming/i));
    dateNowSpy.mockReturnValue(now + 30_500);

    await waitFor(() => expect(getByTestId('deep-prime-seal')).toBeTruthy(), {
      timeout: 2000,
    });

    dateNowSpy.mockReturnValue(now + 30_600);
    fireEvent(getByTestId('deep-prime-seal'), 'pressIn');
    dateNowSpy.mockReturnValue(now + 33_500);

    await waitFor(() => expect(mockUpdateAnchor).toHaveBeenCalled(), {
      timeout: 4000,
    });
    expect(mockRecordSession).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorId: 'test-anchor-id',
        type: 'reinforce',
        durationSeconds: 30,
      })
    );
    expect(mockHandlePrimeComplete).toHaveBeenCalled();
    expect(mockNavigateToPractice).toHaveBeenCalled();
    expect(queryByTestId('completion-modal-done')).toBeNull();

    unmount();
    dateNowSpy.mockRestore();
  });

  it('pauses, resumes, and cleans up immersive Deep Prime audio on exit', async () => {
    const { getByLabelText, getByText } = render(<RitualScreen />);

    fireEvent.press(getByText(/Begin priming/i));

    await waitFor(() => expect(mockPrimeAmbientPlayer.play).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPrimeOpeningPlayer.play).toHaveBeenCalledTimes(1));

    fireEvent.press(getByText('Pause'));
    await waitFor(() => expect(mockPrimeAmbientPlayer.pause).toHaveBeenCalledTimes(1));
    expect(mockPrimeOpeningPlayer.pause).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Resume'));
    await waitFor(() => expect(mockPrimeAmbientPlayer.play).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockPrimeOpeningPlayer.play).toHaveBeenCalledTimes(2));

    await act(async () => {
      fireEvent.press(getByLabelText('Exit ritual'));
    });
    fireEvent.press(getByText('Exit'));

    await waitFor(() => expect(mockPrimeOpeningPlayer.stop).toHaveBeenCalled(), {
      timeout: 2000,
    });
    await waitFor(() => expect(mockPrimeAmbientPlayer.stop).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    await waitFor(() => expect(mockNavigateToVaultDestination).toHaveBeenCalled(), {
      timeout: 2000,
    });
  });

  it('plays the 5-minute Deep Prime cues at the scheduled timestamps', async () => {
    const navigation = require('@react-navigation/native');
    const now = 1_700_000_500_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        ritualType: 'ritual',
        durationSeconds: 300,
      },
    });
    mockSettingsState({
      primeSessionDuration: 300,
      primeSessionAudio: 'ambient',
    });

    const { getByText, unmount } = render(<RitualScreen />);

    fireEvent.press(getByText(/Begin priming/i));

    await waitFor(() => expect(mockPrime5mOpeningPlayer.play).toHaveBeenCalledTimes(1));

    dateNowSpy.mockReturnValue(now + 35_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-5m-intention',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime5mOpeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime5mIntentionPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 100_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-5m-deepening',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime5mIntentionPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime5mDeepeningPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 165_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-5m-return',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime5mDeepeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime5mReturnPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 240_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-5m-reinforcement',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime5mReturnPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime5mReinforcementPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 290_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-5m-closing',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime5mReinforcementPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime5mClosingPlayer.play).toHaveBeenCalledTimes(1);

    unmount();
    dateNowSpy.mockRestore();
  });

  it('plays the 10-minute Deep Prime cues at the scheduled timestamps', async () => {
    const navigation = require('@react-navigation/native');
    const now = 1_700_000_600_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        ritualType: 'ritual',
        durationSeconds: 600,
      },
    });
    mockSettingsState({
      primeSessionDuration: 600,
      primeSessionAudio: 'ambient',
    });

    const { getByText, unmount } = render(<RitualScreen />);

    fireEvent.press(getByText(/Begin priming/i));

    await waitFor(() => expect(mockPrime10mOpeningPlayer.play).toHaveBeenCalledTimes(1));

    dateNowSpy.mockReturnValue(now + 45_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-10m-intention',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime10mOpeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime10mIntentionPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 120_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-10m-deepening',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime10mIntentionPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime10mDeepeningPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 210_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-10m-return',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime10mDeepeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime10mReturnPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 300_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-10m-reinforcement',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime10mReturnPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime10mReinforcementPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 390_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-10m-visualization',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime10mReinforcementPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime10mVisualizationPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 495_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-10m-settling',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime10mVisualizationPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime10mSettlingPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 585_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-10m-closing',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime10mSettlingPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime10mClosingPlayer.play).toHaveBeenCalledTimes(1);

    unmount();
    dateNowSpy.mockRestore();
  });

  it('plays the 15-minute Deep Prime cues at the scaled timestamps', async () => {
    const navigation = require('@react-navigation/native');
    const now = 1_700_000_700_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    navigation.useRoute.mockReturnValue({
      params: {
        anchorId: 'test-anchor-id',
        ritualType: 'ritual',
        durationSeconds: 900,
      },
    });
    mockSettingsState({
      primeSessionDuration: 900,
      primeSessionAudio: 'ambient',
    });

    const { getByText, unmount } = render(<RitualScreen />);

    fireEvent.press(getByText(/Begin priming/i));

    await waitFor(() => expect(mockPrime15mOpeningPlayer.play).toHaveBeenCalledTimes(1));

    dateNowSpy.mockReturnValue(now + 68_000);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-15m-intention',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime15mOpeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime15mIntentionPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 180_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-15m-deepening',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime15mIntentionPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime15mDeepeningPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 315_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-15m-return',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime15mDeepeningPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime15mReturnPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 450_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-15m-reinforcement',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime15mReturnPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime15mReinforcementPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 585_500);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-15m-visualization',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime15mReinforcementPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime15mVisualizationPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 743_000);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-15m-settling',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime15mVisualizationPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime15mSettlingPlayer.play).toHaveBeenCalledTimes(1);

    dateNowSpy.mockReturnValue(now + 878_000);
    await sleep(350);
    await waitFor(() =>
      expect(mockCreateManagedPlayer).toHaveBeenCalledWith(
        'deep-prime-15m-closing',
        expect.objectContaining({
          onFinish: expect.any(Function),
        })
      )
    );
    expect(mockPrime15mSettlingPlayer.stop).toHaveBeenCalledTimes(1);
    expect(mockPrime15mClosingPlayer.play).toHaveBeenCalledTimes(1);

    unmount();
    dateNowSpy.mockRestore();
  });
});
