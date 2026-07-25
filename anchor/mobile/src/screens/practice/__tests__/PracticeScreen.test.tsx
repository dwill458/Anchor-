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

  it('renders the updated primary CTA and current mode labels', async () => {
    mockAnchors = [buildAnchor('a1', 'Focus on clarity')];
    const screen = render(<PracticeScreen />);

    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Return to the symbol. Keep the thread.')).toBeTruthy();
    expect(screen.getByText("TODAY'S GOAL")).toBeTruthy();
    expect(screen.getByText('0 of 3 sessions complete')).toBeTruthy();
    expect(screen.getByText('3 sessions remaining today')).toBeTruthy();
    expect(screen.getByText('Restore Thread')).toBeTruthy();
    expect(screen.getByText('Focus Session · 10–60 sec to restore')).toBeTruthy();
    expect(screen.getByText('DEEP PRIME')).toBeTruthy();
    expect(screen.getAllByText('FOCUS SESSION').length).toBeGreaterThan(0);
    expect(screen.getByText('RELEASE')).toBeTruthy();
  });

  it('opens anchor selector when charge is pressed without an anchor', async () => {
    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByText('DEEP PRIME'));

    await waitFor(() => {
      expect(screen.getAllByText('Choose your anchor').length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText('Search anchors')).toBeTruthy();
    });
  });

  it('uses one hero Pressable for center, text, subtitle, and arrow taps', async () => {
    mockThreadStrength = 80;
    mockAnchors = [buildAnchor('hero-anchor', 'Hero target')];
    // buildAnchor defaults to an already-primed anchor, so Deep Prime skips
    // the Choose Your Prime setup screen and starts the ritual directly.
    const targetExpectation = {
      anchorId: 'hero-anchor',
      ritualType: 'ritual',
      durationSeconds: 120,
      audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
      returnTo: 'practice',
      source: 'practice_hero',
    };

    const tapTargets = [
      'practice-hero-deep-prime',
      "TODAY'S PRACTICE",
      'Begin Priming',
      'Deep Prime · 2 min to custom',
      'practice-hero-deep-prime-arrow',
    ];

    for (const target of tapTargets) {
      mockNavigateToPractice.mockClear();
      const screen = render(<PracticeScreen />);
      fireEvent.press(
        target.startsWith('practice-') ? screen.getByTestId(target) : screen.getByText(target)
      );

      await waitFor(() => {
        expect(mockNavigateToPractice).toHaveBeenCalledTimes(1);
        expect(mockNavigateToPractice).toHaveBeenCalledWith('Ritual', targetExpectation);
      });
      expect(mockNavigateToVault).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalledWith('AnchorDetail', expect.anything());
      screen.unmount();
    }
  });

  it('locks the hero and smaller Deep Prime card against repeated navigation', async () => {
    mockThreadStrength = 80;
    mockAnchors = [buildAnchor('rapid-anchor', 'Rapid target')];
    const screen = render(<PracticeScreen />);
    const hero = screen.getByTestId('practice-hero-deep-prime');

    fireEvent.press(hero);
    fireEvent.press(hero);
    fireEvent.press(hero);
    fireEvent.press(hero);
    fireEvent.press(hero);

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigateToPractice).toHaveBeenCalledWith('Ritual', {
      anchorId: 'rapid-anchor',
      ritualType: 'ritual',
      durationSeconds: 120,
      audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
      returnTo: 'practice',
      source: 'practice_hero',
    });
    expect(mockNavigateToVault).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('AnchorDetail', expect.anything());
  });

  it('routes the smaller Deep Prime card through the same canonical entry', async () => {
    mockAnchors = [buildAnchor('card-anchor', 'Card target')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByTestId('practice-deep-prime-card'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledTimes(1);
      expect(mockNavigateToPractice).toHaveBeenCalledWith('Ritual', {
        anchorId: 'card-anchor',
        ritualType: 'ritual',
        durationSeconds: 120,
        audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
        returnTo: 'practice',
        source: 'practice_deep_prime_card',
      });
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

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('ChargeSetup', {
        anchorId: 'unprimed-anchor',
        returnTo: 'practice',
        initialDuration: 'deep',
        source: 'practice_deep_prime_card',
      });
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

  it('routes generic deep-prime entry directly into the ritual for an already-primed anchor', async () => {
    mockAnchors = [buildAnchor('a99', 'Build consistency')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('DEEP PRIME'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('Ritual', {
        anchorId: 'a99',
        ritualType: 'ritual',
        durationSeconds: 120,
        audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
        returnTo: 'practice',
        source: 'practice_deep_prime_card',
      });
    });
  });

  it('uses a location preset from the primary CTA without exposing place data in analytics', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('Prime at Studio')).toBeTruthy();
      expect(screen.getByText('Focus Session · 1 min')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Prime at Studio'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('ActivationRitual', {
        anchorId: 'a66',
        activationType: 'visual',
        durationOverride: 60,
        audioConfiguration: {
          guidanceVoice: 'none',
          backgroundAudio: 'off',
          source: 'session_override',
        },
        returnTo: 'practice',
        source: 'practice_hero',
      });
    });
    expect(mockAnalyticsTrack).toHaveBeenCalledWith('charge_started', {
      source: 'practice_location_preset',
      location_preset_applied: true,
      session_type: 'focus',
      duration_seconds: 60,
    });
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

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('Ritual', {
        anchorId: 'a2',
        ritualType: 'ritual',
        durationSeconds: 120,
        audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
        returnTo: 'practice',
        source: 'practice_deep_prime_card',
      });
    });
  });

  it('uses the default deep charge duration from settings', async () => {
    mockSettingsState.primeSessionDuration = 14 * 60;
    mockAnchors = [buildAnchor('a77', 'Steady growth')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('DEEP PRIME'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('Ritual', {
        anchorId: 'a77',
        ritualType: 'ritual',
        durationSeconds: 14 * 60,
        audioConfiguration: { guidanceVoice: 'female', backgroundAudio: 'ambient', source: 'default' },
        returnTo: 'practice',
        source: 'practice_deep_prime_card',
      });
    });
  });

  it('uses the primary CTA to quick-restart the last ritual type for the selected anchor', async () => {
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
    fireEvent.press(screen.getByText('Restore Thread'));

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('ActivationRitual', {
        anchorId: 'a55',
        activationType: 'visual',
        durationOverride: 30,
        audioConfiguration: {
          guidanceVoice: 'female',
          backgroundAudio: 'ambient',
          source: 'default',
        },
        returnTo: 'practice',
        source: 'practice_hero',
      });
    });
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

    await waitFor(() => {
      expect(mockNavigateToPractice).toHaveBeenCalledWith('ConfirmBurn', {
        anchorId: 'a88',
        intention: 'Legacy intention',
        sigilSvg: '<svg>reinforced</svg>',
        enhancedImageUrl: undefined,
        returnTo: 'practice',
        source: 'practice_release_card',
      });
    });
  });

  it('shows focus-session sub-copy after the user has already primed today', async () => {
    mockAnchors = [buildAnchor('a3', 'Keep momentum')];
    mockLastPrimedAt = localDateString(new Date());

    const screen = render(<PracticeScreen />);

    expect(screen.getByText('Focus Session · 10–60 sec')).toBeTruthy();
  });

  it('shows partial progress toward the daily goal from activate and reinforce sessions', async () => {
    mockAnchors = [buildAnchor('a4', 'Keep the thread')];
    mockPracticeHistory = [canonicalEvent('s1', 'focus'), canonicalEvent('s2', 'deep_prime')];

    const screen = render(<PracticeScreen />);

    expect(screen.getByText('2 of 3 sessions complete')).toBeTruthy();
    expect(screen.getByText('1 session remaining today')).toBeTruthy();
  });

  it('shows a terminal state when the daily goal is complete', async () => {
    mockAnchors = [buildAnchor('a5', 'Finish strong')];
    mockPracticeHistory = [
      canonicalEvent('s1', 'focus'),
      canonicalEvent('s2', 'deep_prime'),
      canonicalEvent('s3', 'release'),
    ];

    const screen = render(<PracticeScreen />);

    expect(screen.getByText('3 of 3 sessions complete')).toBeTruthy();
    expect(screen.getByText('Goal complete for today')).toBeTruthy();
  });

  it('opens teaching sheet from info icon', async () => {
    mockAnchors = [buildAnchor('a1', 'Calm focus')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByLabelText('Practice mode help'));

    await waitFor(() => {
      expect(screen.getByText('Four Ways to Practice')).toBeTruthy();
      expect(screen.getByText('Focus Session')).toBeTruthy();
      expect(screen.getByText('Deep Prime')).toBeTruthy();
      expect(screen.getByText('Visualize')).toBeTruthy();
      expect(screen.getByText('Release')).toBeTruthy();
      expect(screen.getByText('Got It')).toBeTruthy();
    });
  });
});
