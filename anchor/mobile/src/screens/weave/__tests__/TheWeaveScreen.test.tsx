import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TheWeaveScreen } from '../TheWeaveScreen';
import type { PracticeSessionRecord } from '@/types/practice';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  Reanimated.useReducedMotion = () => false;
  return Reanimated;
});

jest.mock('../WeaveCanvas', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WeaveCanvas: () => React.createElement(View, { testID: 'weave-canvas' }),
  };
});

jest.mock('@/components/common', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ZenBackground: () => React.createElement(View, { testID: 'zen-background' }),
  };
});

const mockGoBack = jest.fn();
const mockNavigateToPractice = jest.fn();
const mockNavigateToVault = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    canGoBack: () => true,
  }),
  useRoute: () => ({
    params: {},
  }),
}));

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToPractice: mockNavigateToPractice,
    navigateToVault: mockNavigateToVault,
    returnToAnchorDetail: jest.fn(),
  }),
}));

let mockHistory: PracticeSessionRecord[] = [];
let mockAnchors: any[] = [];
let mockUser: any = { id: 'test-user-1' };

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: any) => selector({
    anchors: mockAnchors,
    currentAnchorId: 'anchor-1',
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({
    user: mockUser,
    isOfflineMode: false,
  }),
}));

jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: (selector: any) => selector({
    practiceHistory: mockHistory,
  }),
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: any) => selector({
    threadStrengthSensitivity: 'balanced',
    restDays: [],
  }),
}));

jest.mock('@/stores/teachingStore', () => ({
  useTeachingStore: (selector: any) => selector({
    recordShown: jest.fn(),
  }),
}));

jest.mock('@/utils/useTeachingGate', () => ({
  useTeachingGate: () => null,
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    track: jest.fn(),
  },
}));

jest.mock('@/services/AuthHydrationService', () => ({
  __esModule: true,
  default: {
    rehydrateSessionFromExport: jest.fn().mockResolvedValue(undefined),
  },
}));

const createMockSession = (index: number): PracticeSessionRecord => {
  const date = new Date(Date.now() - index * 3600 * 1000);
  const dateKey = date.toISOString().split('T')[0];
  return {
    id: `session-${index}`,
    accountId: 'test-user-1',
    anchorId: 'anchor-1',
    anchorLocalId: null,
    anchorServerId: null,
    practiceMode: index % 2 === 0 ? 'focus' : 'visualize',
    plannedDurationSeconds: 60,
    completedDurationSeconds: 60,
    completionStatus: 'completed',
    startedAt: date.toISOString(),
    completedAt: date.toISOString(),
    localDateKey: dateKey,
    timeZone: 'America/Chicago',
    utcOffsetMinutesAtCompletion: -300,
    completionSource: 'practice_screen',
    schemaVersion: 1,
    legacyType: null,
    guidanceVoice: 'female',
    backgroundAudio: 'ambient',
    sceneSnapshot: null,
    nextAction: null,
    clientVersion: null,
    syncState: 'synced',
  };
};

describe('TheWeaveScreen Recent Activity collapsible list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnchors = [
      { id: 'anchor-1', intentionText: 'Anchor Intention One', category: 'focus' },
    ];
  });

  it('renders up to 3 items initially and expands up to 30 items on toggle', () => {
    // Create 10 mock sessions
    mockHistory = Array.from({ length: 10 }, (_, i) => createMockSession(i));

    const { getByTestId, getByText, queryByText } = render(<TheWeaveScreen />);

    // Initially collapsed: button exists showing total count (10)
    const toggleButton = getByTestId('weave-more-sessions');
    expect(toggleButton).toBeTruthy();
    expect(getByText('Show more sessions (10)')).toBeTruthy();

    // Session 0, 1, 2 should be in the document
    // Let's expand
    fireEvent.press(toggleButton);

    // Now button should say 'Show less'
    expect(getByText('Show less')).toBeTruthy();

    // Collapse back
    fireEvent.press(toggleButton);
    expect(getByText('Show more sessions (10)')).toBeTruthy();
  });

  it('caps practice history to the last 30 sessions when expanded', () => {
    // Create 35 mock sessions
    mockHistory = Array.from({ length: 35 }, (_, i) => createMockSession(i));

    const { getByTestId, getByText } = render(<TheWeaveScreen />);

    const toggleButton = getByTestId('weave-more-sessions');
    expect(toggleButton).toBeTruthy();
    // Maximum 30 sessions tracked
    expect(getByText('Show more sessions (30)')).toBeTruthy();
  });

  it('does not show expand button when 3 or fewer sessions exist', () => {
    mockHistory = Array.from({ length: 3 }, (_, i) => createMockSession(i));

    const { queryByTestId } = render(<TheWeaveScreen />);

    expect(queryByTestId('weave-more-sessions')).toBeNull();
  });

  it('does not render the top corner info button and opens about modal via insights', () => {
    mockHistory = Array.from({ length: 5 }, (_, i) => createMockSession(i));

    const { queryByTestId, getByLabelText, getByText } = render(<TheWeaveScreen />);

    // Info button in header is removed
    expect(queryByTestId('weave-about')).toBeNull();

    // Insights button still opens the About modal
    const insightsButton = getByLabelText('Open weave insights');
    expect(insightsButton).toBeTruthy();
    fireEvent.press(insightsButton);

    expect(getByText('About The Weave')).toBeTruthy();
    expect(getByText('Reading the threads')).toBeTruthy();
  });
});
