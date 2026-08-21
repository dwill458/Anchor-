import React from 'react';
import { TextInput } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import ReturningIntentionScreen from '../ReturningIntentionScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
};
const mockSetPendingForgeIntent = jest.fn();
const mockClearPendingForgeIntent = jest.fn();
const mockSetPendingForgeResumeTarget = jest.fn();
const mockBindChartAccount = jest.fn();

let mockPendingForgeIntent: string | null = null;
let mockIsAuthenticated = true;
let mockHasActiveEntitlement = true;
let mockAnchorCount = 1;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@/stores/authStore', () => {
  const getState = () => ({
      isAuthenticated: mockIsAuthenticated,
      user: mockIsAuthenticated ? { id: 'returning-test-account' } : null,
      pendingForgeIntent: mockPendingForgeIntent,
      setPendingForgeIntent: mockSetPendingForgeIntent,
      clearPendingForgeIntent: mockClearPendingForgeIntent,
      setPendingForgeResumeTarget: mockSetPendingForgeResumeTarget,
  });
  const useAuthStore: any = (selector: (state: Record<string, unknown>) => unknown) => selector(getState());
  useAuthStore.getState = getState;
  return { useAuthStore };
});

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      anchors: Array.from({ length: mockAnchorCount }, (_, index) => ({ id: `anchor-${index}` })),
    }),
}));

jest.mock('@/stores/chartJourneyStore', () => {
  const getState = () => ({
    accountId: 'returning-test-account',
    hydrated: true,
    anchorCreationHandoff: null,
    bindAccount: mockBindChartAccount,
  });
  const useChartJourneyStore: any = (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = getState();
    return selector ? selector(state) : state;
  };
  useChartJourneyStore.getState = getState;
  return { useChartJourneyStore };
});

jest.mock('@/services/ChartAnchorHandoffService', () => ({
  cancelChartAnchorCreationHandoff: jest.fn(),
}));

jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({
    isTrialActive: false,
    isSubscribed: mockHasActiveEntitlement,
    trialExpired: !mockHasActiveEntitlement,
    hasActiveEntitlement: mockHasActiveEntitlement,
  }),
}));

jest.mock('@/stores/teachingStore', () => ({
  useTeachingStore: () => ({ recordShown: jest.fn() }),
}));

jest.mock('@/utils/useTeachingGate', () => ({
  useTeachingGate: () => null,
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

jest.mock('@/utils/sigil/distillation', () => ({
  distillIntention: (text: string) => ({
    finalLetters: text.split(' ').map((word: string) => word[0]?.toUpperCase()).filter(Boolean),
  }),
}));

jest.mock('@/utils/categoryDetection', () => ({
  detectCategoryFromText: () => 'custom',
}));

jest.mock('@/components/common', () => ({
  ZenBackground: () => null,
  UndertoneLine: ({ text }: { text: string }) => {
    const { Text } = require('react-native');
    return <Text>{text}</Text>;
  },
}));

describe('ReturningIntentionScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockCanGoBack.mockClear();
    mockSetPendingForgeIntent.mockClear();
    mockClearPendingForgeIntent.mockClear();
    mockSetPendingForgeResumeTarget.mockClear();
    mockBindChartAccount.mockReset().mockResolvedValue(undefined);
    mockPendingForgeIntent = null;
    mockIsAuthenticated = true;
    mockHasActiveEntitlement = true;
    mockAnchorCount = 1;
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Flush all pending timers (animations, debounce) then explicitly unmount while
    // fake timers are still active. TRLN's automatic afterEach cleanup then finds
    // nothing to do, avoiding a hang when it calls act() with real timers running
    // alongside JS-driven (useNativeDriver:false) Animated.timing callbacks.
    act(() => { jest.advanceTimersByTime(1000); });
    jest.clearAllTimers();
    act(() => { cleanup(); });
    jest.useRealTimers();
  });

  it('prefills the pending forge intent and clears it after consuming', () => {
    mockPendingForgeIntent = 'Return to calm';

    render(<ReturningIntentionScreen />);

    expect(screen.getByDisplayValue('Return to calm')).toBeTruthy();
    expect(mockClearPendingForgeIntent).toHaveBeenCalled();
  });

  it('routes unauthenticated users to auth gate and preserves the typed intention', () => {
    mockIsAuthenticated = false;
    render(<ReturningIntentionScreen />);

    const input = screen.UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, 'Hold steady');
    act(() => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByText('Begin'));

    expect(mockSetPendingForgeIntent).toHaveBeenCalledWith('Hold steady');
    expect(mockSetPendingForgeResumeTarget).toHaveBeenCalledWith('CreateAnchor');
    expect(mockNavigate).toHaveBeenCalledWith('AuthGate');
  });

  it('routes authenticated users without entitlement to paywall', () => {
    mockHasActiveEntitlement = false;
    render(<ReturningIntentionScreen />);

    const input = screen.UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, 'Hold steady');
    act(() => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByText('Begin'));

    expect(mockSetPendingForgeIntent).toHaveBeenCalledWith('Hold steady');
    expect(mockSetPendingForgeResumeTarget).toHaveBeenCalledWith('CreateAnchor');
    expect(mockNavigate).toHaveBeenCalledWith('Paywall', {
      source: 'create_anchor_free_locked',
      preferredPlanId: 'annual',
    });
  });

  it.each([
    ['zzzzzz', "That doesn't look like an intention. What do you actually want?"],
    ['I will focus today', 'Try present tense: "I choose…" "I am…" or "I return…"'],
    ["I don't check social media", 'Try affirmative: "I choose…" instead of "I don\'t…"'],
  ])('shows shared intention guidance for %s', async (text, guidance) => {
    render(<ReturningIntentionScreen />);
    await act(async () => {
      await Promise.resolve();
    });
    const input = screen.UNSAFE_getByType(TextInput);

    fireEvent.changeText(input, text);
    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.getByText(guidance)).toBeTruthy();
  });
});
