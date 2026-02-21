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

let mockAnchors: any[] = [];

const mockSettingsState = {
  defaultActivation: { mode: 'silent', unit: 'seconds', value: 30 },
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
    getActiveAnchors: () => mockAnchors,
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

function buildAnchor(id: string, intention: string) {
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
  } as any;
}

describe('PracticeScreen', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    mockNavigate.mockReset();
    mockNavigateToVault.mockReset();
    mockSettingsState.defaultActivation.unit = 'seconds';
    mockSettingsState.defaultActivation.value = 30;
    mockAnchors = [];
  });

  it('renders core hierarchy and exact primary copy', async () => {
    mockAnchors = [buildAnchor('a1', 'Focus on clarity')];
    const screen = render(<PracticeScreen />);

    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Return to the symbol. Reinforce the path.')).toBeTruthy();
    expect(screen.getByText('CHARGE')).toBeTruthy();
    expect(screen.getByText('STABILIZE')).toBeTruthy();
    expect(screen.getByText('BURN & RELEASE')).toBeTruthy();
    expect(screen.getByText('Daily thread')).toBeTruthy();
    expect(screen.getByText('1 session today keeps the current alive.')).toBeTruthy();
  });

  it('opens anchor selector when charge is pressed without an anchor', async () => {
    const screen = render(<PracticeScreen />);
    fireEvent.press(screen.getByText('CHARGE'));

    await waitFor(() => {
      expect(screen.getAllByText('Choose your anchor').length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText('Search anchors')).toBeTruthy();
    });
  });

  it('navigates to ActivationRitual with expected params when charging', async () => {
    mockAnchors = [buildAnchor('a99', 'Build consistency')];
    const screen = render(<PracticeScreen />);

    fireEvent.press(screen.getByText('CHARGE'));

    await waitFor(() => {
      expect(mockNavigateToVault).toHaveBeenCalledWith('ActivationRitual', {
        anchorId: 'a99',
        activationType: 'visual',
        durationOverride: 30,
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
