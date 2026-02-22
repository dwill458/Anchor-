import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PracticeScreen } from '../PracticeScreen';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  Reanimated.useReducedMotion = () => false;
  return Reanimated;
});

const mockNavigate = jest.fn();
const mockNavigateToVault = jest.fn();
const mockSetCurrentAnchor = jest.fn((id?: string) => {
  mockCurrentAnchorId = id;
});

let mockAnchors: any[] = [];
let mockCurrentAnchorId: string | undefined;

const mockSettingsState = {
  defaultActivation: { mode: 'silent', unit: 'seconds', value: 30 },
  defaultCharge: { mode: 'ritual', preset: '5m', customMinutes: undefined },
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
  }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: () => ({
    anchors: mockAnchors,
    getActiveAnchors: () => mockAnchors,
    currentAnchorId: mockCurrentAnchorId,
    setCurrentAnchor: mockSetCurrentAnchor,
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector
      ? selector({ user: { stabilizeStreakDays: 2, lastStabilizeAt: new Date().toISOString() } })
      : { user: { stabilizeStreakDays: 2, lastStabilizeAt: new Date().toISOString() } },
}));

jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: () => ({
    todayPractice: { sessionsCount: 0, totalSeconds: 0, date: '2026-02-21' },
    sessionLog: [],
    lastGraceDayUsedAt: null,
  }),
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: any) => (selector ? selector(mockSettingsState) : mockSettingsState),
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

describe('PracticeScreen', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    mockNavigate.mockReset();
    mockNavigateToVault.mockReset();
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
    mockAnchors = [];
  });

  it('renders core hierarchy and exact primary copy', async () => {
    mockAnchors = [buildAnchor('a1', 'Focus on clarity')];
    const screen = render(<PracticeScreen />);

    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Return to the symbol. Keep the thread.')).toBeTruthy();
    expect(screen.getByText('REINFORCE/DEEP CHARGE')).toBeTruthy();
    expect(screen.getByText('STABILIZE')).toBeTruthy();
    expect(screen.getByText('BURN & RELEASE')).toBeTruthy();
    expect(screen.getByText('Daily thread')).toBeTruthy();
    expect(screen.getByText('One session today keeps the current running.')).toBeTruthy();
  });

  it('opens anchor selector when charge is pressed without an anchor', async () => {
    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByText('REINFORCE/DEEP CHARGE'));

    await waitFor(() => {
      expect(screen.getAllByText('Choose your anchor').length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText('Search anchors')).toBeTruthy();
    });
  });

  it('shows all created anchors from home list in the selector', async () => {
    mockCurrentAnchorId = 'a1';
    mockAnchors = [
      buildAnchor('a1', 'Anchor One'),
      buildAnchor('a2', 'Anchor Two', { isReleased: true }),
    ];

    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByLabelText('Change current anchor'));

    await waitFor(() => {
      expect(screen.getByLabelText('Select Anchor One')).toBeTruthy();
      expect(screen.getByLabelText('Select Anchor Two')).toBeTruthy();
    });
  });

  it('navigates to Ritual with expected params when charging', async () => {
    mockAnchors = [buildAnchor('a99', 'Build consistency')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('REINFORCE/DEEP CHARGE'));

    await waitFor(() => {
      expect(mockNavigateToVault).toHaveBeenCalledWith('Ritual', {
        anchorId: 'a99',
        ritualType: 'ritual',
        durationSeconds: 300,
        returnTo: 'practice',
      });
    });
  });

  it('routes ritual flow using the anchor selected in current-anchor selector', async () => {
    mockCurrentAnchorId = 'a1';
    mockAnchors = [
      buildAnchor('a1', 'Primary anchor'),
      buildAnchor('a2', 'Secondary anchor'),
    ];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByLabelText('Change current anchor'));

    await waitFor(() => {
      expect(screen.getByLabelText('Select Secondary anchor')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Select Secondary anchor'));
    screen.rerender(<PracticeScreen />);
    fireEvent.press(screen.getByText('REINFORCE/DEEP CHARGE'));

    await waitFor(() => {
      expect(mockSetCurrentAnchor).toHaveBeenCalledWith('a2');
      expect(mockNavigateToVault).toHaveBeenCalledWith('Ritual', {
        anchorId: 'a2',
        ritualType: 'ritual',
        durationSeconds: 300,
        returnTo: 'practice',
      });
    });
  });

  it('uses the default deep charge duration from settings', async () => {
    mockSettingsState.defaultCharge.preset = 'custom';
    mockSettingsState.defaultCharge.customMinutes = 14;
    mockAnchors = [buildAnchor('a77', 'Steady growth')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('REINFORCE/DEEP CHARGE'));

    await waitFor(() => {
      expect(mockNavigateToVault).toHaveBeenCalledWith('Ritual', {
        anchorId: 'a77',
        ritualType: 'ritual',
        durationSeconds: 14 * 60,
        returnTo: 'practice',
      });
    });
  });

  it('opens teaching sheet from info icon', async () => {
    mockAnchors = [buildAnchor('a1', 'Calm focus')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByLabelText('Practice mode help'));

    await waitFor(() => {
      expect(screen.getByText('How the three modes work')).toBeTruthy();
      expect(screen.getByText('Got it')).toBeTruthy();
    });
  });
});
