import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PracticeScreen } from '../PracticeScreen';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  Reanimated.useReducedMotion = () => false;
  // ChargedGlowCanvas uses useFrameCallback which is not in the standard mock
  Reanimated.useFrameCallback = jest.fn();
  return Reanimated;
});

const mockNavigate = jest.fn();
const mockNavigateToVault = jest.fn();
const mockNavigateToPractice = jest.fn();
const mockNavigateToPaywall = jest.fn();
const mockRegisterTabNav = jest.fn();
const mockSetCurrentAnchor = jest.fn((id?: string) => {
  mockCurrentAnchorId = id;
});

let mockAnchors: any[] = [];
let mockCurrentAnchorId: string | undefined;
let mockSessionLog: any[] = [];
let mockPracticeHistory: any[] = [];
let mockThreadStrength = 10;
let mockTotalSessionsCount = 0;
let mockLastPrimedAt: string | null = null;
let mockWeekHistory = [false, false, false, false, false, false, false];
const mockApplyDecay = jest.fn();
let mockLocationPrimingSuggestion: any = null;
const mockResolveLocationPrimingSuggestion = jest.fn(() =>
  Promise.resolve(mockLocationPrimingSuggestion)
);
const mockAnalyticsTrack = jest.fn();

const mockSettingsState: any = {
  defaultActivation: { mode: 'silent', unit: 'seconds', value: 30 },
  defaultCharge: { mode: 'ritual', preset: '5m', customMinutes: undefined },
  dailyPracticeGoal: 3,
  threadStrengthSensitivity: 'balanced',
  restDays: [],
  primeSessionDuration: 120,
  focusSessionDuration: 30,
  sessionAudioDefaults: {
    focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
  },
};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
    }),
    useRoute: () => ({ params: undefined }),
    useFocusEffect: (callback: any) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToVault: mockNavigateToVault,
    navigateToPractice: mockNavigateToPractice,
    navigateToPaywall: mockNavigateToPaywall,
    registerTabNav: mockRegisterTabNav,
    activeTabIndex: 1,
  }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector?: (state: any) => any) => {
    const state = {
      anchors: mockAnchors,
      getActiveAnchors: () => mockAnchors,
      currentAnchorId: mockCurrentAnchorId,
      setCurrentAnchor: mockSetCurrentAnchor,
      getAnchorById: (id: string) => mockAnchors.find((anchor) => anchor.id === id),
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector
      ? selector({ user: { id: 'u1', stabilizeStreakDays: 2, lastStabilizeAt: new Date().toISOString() } })
      : { user: { id: 'u1', stabilizeStreakDays: 2, lastStabilizeAt: new Date().toISOString() } },
}));

jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: (selector?: (state: any) => any) => {
    const state = {
      todayPractice: { sessionsCount: 0, totalSeconds: 0, date: '2026-02-21' },
      sessionLog: mockSessionLog,
      practiceHistory: mockPracticeHistory,
      primingHistory: [],
      threadStrength: mockThreadStrength,
      totalSessionsCount: mockTotalSessionsCount,
      lastPrimedAt: mockLastPrimedAt,
      weekHistory: mockWeekHistory,
      applyDecay: mockApplyDecay,
      lastGraceDayUsedAt: null,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: any) => (selector ? selector(mockSettingsState) : mockSettingsState),
}));

jest.mock('@/stores/locationPrimingStore', () => ({
  useLocationPrimingStore: (selector: any) =>
    selector({
      resolveActiveSuggestion: mockResolveLocationPrimingSuggestion,
    }),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsEvents: {
    CHARGE_STARTED: 'charge_started',
  },
  AnalyticsService: {
    track: (...args: any[]) => mockAnalyticsTrack(...args),
  },
}));

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    selection: jest.fn(),
    impact: jest.fn(),
  },
}));

function buildAnchor(id: string, intention: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId: 'u1',
    intentionText: intention,
    category: 'career',
    distilledLetters: [],
    baseSigilSvg: '<svg></svg>',
    structureVariant: 'balanced',
    isCharged: true,
    activationCount: 2,
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    ...overrides,
  } as any;
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function canonicalEvent(id: string, mode: 'deep_prime' | 'visualize' | 'focus' | 'release') {
  const completedAt = new Date().toISOString();
  return {
    id, accountId: 'u1', anchorId: 'a4', anchorLocalId: 'a4', anchorServerId: 'a4',
    practiceMode: mode, plannedDurationSeconds: 60, completedDurationSeconds: 60,
    completionStatus: 'completed', startedAt: completedAt, completedAt,
    localDateKey: localDateString(new Date()), timeZone: 'UTC', utcOffsetMinutesAtCompletion: 0,
    completionSource: 'practice_screen', schemaVersion: 2, legacyType: null,
    guidanceVoice: 'none', backgroundAudio: 'off', sceneSnapshot: null,
    nextAction: null, clientVersion: 'test', syncState: 'synced',
  };
}

// ChargeSetup only appears for an anchor's first prime; once an anchor is
// charged, Deep Prime routes straight to Ritual using the saved duration.
const chargeSetupExpectation = (anchorId: string, source: string) => ({
  anchorId,
  returnTo: 'practice',
  initialDuration: 'deep',
  source,
});

const ritualExpectation = (anchorId: string, source: string, durationSeconds: number) => ({
  anchorId,
  ritualType: 'ritual',
  durationSeconds,
  audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
  returnTo: 'practice',
  source,
});

describe('PracticeScreen', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    mockNavigate.mockReset();
    mockNavigateToVault.mockReset();
    mockNavigateToPractice.mockReset();
    mockNavigateToPaywall.mockReset();
    mockRegisterTabNav.mockReset();
    mockSetCurrentAnchor.mockClear();
    mockSetCurrentAnchor.mockImplementation((id?: string) => {
      mockCurrentAnchorId = id;
    });
    mockCurrentAnchorId = undefined;
    mockSettingsState.defaultActivation.unit = 'seconds';
    mockSettingsState.defaultActivation.value = 30;
    mockSettingsState.defaultCharge.mode = 'ritual';
    mockSettingsState.defaultCharge.preset = '5m';
    mockSettingsState.defaultCharge.customMinutes = undefined;
    mockSettingsState.primeSessionDuration = 120;
    mockSettingsState.dailyPracticeGoal = 3;
    mockAnchors = [];
    mockSessionLog = [];
    mockPracticeHistory = [];
    mockThreadStrength = 10;
    mockTotalSessionsCount = 0;
    mockLastPrimedAt = null;
    mockWeekHistory = [false, false, false, false, false, false, false];
    mockApplyDecay.mockReset();
    mockLocationPrimingSuggestion = null;
    mockResolveLocationPrimingSuggestion.mockClear();
    mockAnalyticsTrack.mockClear();
  });

  it('renders the compact anchor selector, mode list, and selected-mode CTA', async () => {
    mockAnchors = [buildAnchor('a1', 'Focus on clarity')];
    const screen = render(<PracticeScreen />);

    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Return to the symbol. Keep the thread.')).toBeTruthy();
    expect(screen.getByText('CURRENT ANCHOR')).toBeTruthy();
    expect(screen.getByText('Focus on clarity')).toBeTruthy();
    expect(screen.getByText('Choose your practice')).toBeTruthy();
    expect(screen.getByText('DEEP PRIME')).toBeTruthy();
    expect(screen.getByText('FOCUS')).toBeTruthy();
    expect(screen.getByText('RELEASE')).toBeTruthy();
    expect(screen.getByText('BEGIN DEEP PRIME →')).toBeTruthy();
    expect(screen.getByText('THE WEAVE')).toBeTruthy();
  });

  it('opens anchor selector when the selected practice CTA has no anchor', async () => {
    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByText('DEEP PRIME'));
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(screen.getByText('CHOOSE YOUR ANCHOR')).toBeTruthy();
      expect(screen.getByPlaceholderText('Search your anchors')).toBeTruthy();
    });
  });

  it('routes the selected Focus mode through the canonical entry', async () => {
    mockAnchors = [buildAnchor('hero-anchor', 'Hero target')];
    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByTestId('practice-focus-card'));
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('ActivationRitual', expect.objectContaining({
        anchorId: 'hero-anchor',
        source: 'practice_focus_card',
      }));
    });
  });

  it('locks the selected Deep Prime CTA against repeated navigation', async () => {
    mockAnchors = [buildAnchor('rapid-anchor', 'Rapid target')];
    const screen = render(<PracticeScreen />);
    const cta = screen.getByTestId('practice-selected-mode-cta');

    fireEvent.press(cta);
    fireEvent.press(cta);
    fireEvent.press(cta);
    fireEvent.press(cta);
    fireEvent.press(cta);

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigateToPractice).toHaveBeenCalledWith(
      'Ritual',
      ritualExpectation('rapid-anchor', 'practice_deep_prime_card', 120),
    );
    expect(mockNavigateToVault).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('AnchorDetail', expect.anything());
  });

  it('routes the selected Deep Prime tool through the canonical entry', async () => {
    mockAnchors = [buildAnchor('card-anchor', 'Card target')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByTestId('practice-deep-prime-card'));
    expect(mockNavigateToPractice).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledTimes(1);
      expect(mockNavigateToPractice).toHaveBeenCalledWith(
        'Ritual',
        ritualExpectation('card-anchor', 'practice_deep_prime_card', 120),
      );
    });
    expect(mockNavigateToVault).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('AnchorDetail', expect.anything());
  });

  it('shows the Choose Your Prime setup screen for an anchor that has never been primed', async () => {
    mockAnchors = [
      buildAnchor('unprimed-anchor', 'Fresh anchor', { isCharged: false, activationCount: 0 }),
    ];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByTestId('practice-deep-prime-card'));
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith(
        'ChargeSetup',
        chargeSetupExpectation('unprimed-anchor', 'practice_deep_prime_card'),
      );
    });
  });

  it('shows all created anchors from home list in the selector', async () => {
    mockCurrentAnchorId = 'a1';
    mockAnchors = [
      buildAnchor('a1', 'Anchor One'),
      buildAnchor('a2', 'Anchor Two'),
    ];

    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByLabelText('Current anchor, Anchor One. Double tap to choose another anchor.'));

    await waitFor(() => {
      expect(screen.getByLabelText('Select Anchor One')).toBeTruthy();
      expect(screen.getByLabelText('Select Anchor Two')).toBeTruthy();
    });
  });

  it('switches the current anchor from the hero without starting a ritual', async () => {
    mockCurrentAnchorId = 'a1';
    mockAnchors = [
      buildAnchor('a1', 'Anchor One'),
      buildAnchor('a2', 'Anchor Two'),
    ];

    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByLabelText('Current anchor, Anchor One. Double tap to choose another anchor.'));
    fireEvent.press(screen.getByLabelText('Select Anchor Two'));

    await waitFor(() => {
      expect(mockSetCurrentAnchor).toHaveBeenCalledWith('a2');
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockNavigateToVault).not.toHaveBeenCalled();
      expect(screen.getByText('Anchor Two')).toBeTruthy();
    });
  });

  it('opens The Weave scoped to the current Anchor from the history entry', () => {
    mockCurrentAnchorId = 'weave-anchor';
    mockAnchors = [buildAnchor('weave-anchor', 'Track my returns')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByTestId('practice-open-weave'));

    expect(mockNavigate).toHaveBeenCalledWith('Evolve');
  });

  it('routes the selected deep-prime tool straight to Ritual for an already-primed anchor', async () => {
    mockAnchors = [buildAnchor('a99', 'Build consistency')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('DEEP PRIME'));
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith(
        'Ritual',
        ritualExpectation('a99', 'practice_deep_prime_card', 120),
      );
    });
  });

  it('keeps a location suggestion from displacing the selected mode CTA', async () => {
    mockAnchors = [buildAnchor('a66', 'Practice at the studio')];
    mockLocationPrimingSuggestion = {
      distanceMeters: 12,
      zone: {
        id: 'zone-1',
        label: 'Studio',
        preset: {
          sessionType: 'focus',
          durationSeconds: 60,
          audioConfiguration: { guidanceVoice: 'none', backgroundAudio: 'off' },
        },
      },
    };
    const screen = render(<PracticeScreen />);

    await waitFor(() => expect(screen.getByText('BEGIN DEEP PRIME →')).toBeTruthy());
    expect(screen.queryByText('Prime at Studio')).toBeNull();
  });

  it('routes ritual flow using the anchor selected in current-anchor selector', async () => {
    // handleSelectAnchor now routes immediately on anchor selection (no separate
    // confirm step). The charge ritual navigates to the correct anchor when it is
    // the currently active anchor. We test this by pre-setting a2 as active.
    mockCurrentAnchorId = 'a2';
    mockAnchors = [
      buildAnchor('a1', 'Primary anchor'),
      buildAnchor('a2', 'Secondary anchor'),
    ];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('DEEP PRIME'));
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith(
        'Ritual',
        ritualExpectation('a2', 'practice_deep_prime_card', 120),
      );
    });
  });

  it('uses the default deep charge duration from settings', async () => {
    mockSettingsState.primeSessionDuration = 14 * 60;
    mockAnchors = [buildAnchor('a77', 'Steady growth')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('DEEP PRIME'));
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith(
        'Ritual',
        ritualExpectation('a77', 'practice_deep_prime_card', 14 * 60),
      );
    });
  });

  it('keeps an existing session history from changing the selected practice mode', async () => {
    mockAnchors = [buildAnchor('a55', 'Stay steady')];
    mockSessionLog = [
      {
        id: 's1',
        anchorId: 'a55',
        type: 'stabilize',
        durationSeconds: 90,
        mode: 'silent',
        completedAt: new Date().toISOString(),
      },
    ];

    const screen = render(<PracticeScreen />);
    expect(screen.getByText('BEGIN DEEP PRIME →')).toBeTruthy();
  });

  it('uses burn fallbacks when launching release from practice', async () => {
    mockAnchors = [
      buildAnchor('a88', 'Fallback should be used', {
        intentionText: undefined,
        intention: 'Legacy intention',
        reinforcedSigilSvg: '<svg>reinforced</svg>',
        enhancedImageUrl: undefined,
      }),
    ];

    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByText('RELEASE'));
    fireEvent.press(screen.getByTestId('practice-selected-mode-cta'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('ConfirmBurn', expect.objectContaining({
        anchorId: 'a88',
        intention: 'Legacy intention',
        sigilSvg: '<svg>reinforced</svg>',
        enhancedImageUrl: undefined,
        returnTo: 'practice',
        source: 'practice_release_card',
      }));
    });
  });

  it('expands Focus copy when Focus is selected', async () => {
    mockAnchors = [buildAnchor('a3', 'Keep momentum')];
    mockLastPrimedAt = localDateString(new Date());

    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByTestId('practice-focus-card'));
    expect(screen.getByText('Return your attention to the Anchor.')).toBeTruthy();
  });


  it('opens teaching sheet from info icon', async () => {
    mockAnchors = [buildAnchor('a1', 'Calm focus')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByLabelText('Practice mode help'));

    await waitFor(() => {
      expect(screen.getByText('CHOOSE WHAT YOU NEED')).toBeTruthy();
      expect(screen.getByText('Each practice strengthens your anchor differently.')).toBeTruthy();
      expect(screen.getByText('Stay with it longer.')).toBeTruthy();
      expect(screen.getByText('See the outcome before it happens.')).toBeTruthy();
      expect(screen.getByText('Come back to what matters.')).toBeTruthy();
      expect(screen.getByText('Close the loop.')).toBeTruthy();
      expect(screen.getByText('Got It')).toBeTruthy();
    });
  });
});
