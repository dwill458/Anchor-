import React from 'react';
import { TextInput } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ReturningIntentionScreen from '../ReturningIntentionScreen';

const mockNavigate = jest.fn();
const mockSetPendingForgeIntent = jest.fn();
const mockClearPendingForgeIntent = jest.fn();
const mockSetPendingForgeResumeTarget = jest.fn();

let mockPendingForgeIntent: string | null = null;
let mockIsAuthenticated = true;
let mockHasActiveEntitlement = true;
let mockAnchorCount = 1;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      isAuthenticated: mockIsAuthenticated,
      pendingForgeIntent: mockPendingForgeIntent,
      setPendingForgeIntent: mockSetPendingForgeIntent,
      clearPendingForgeIntent: mockClearPendingForgeIntent,
      setPendingForgeResumeTarget: mockSetPendingForgeResumeTarget,
    }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      anchors: Array.from({ length: mockAnchorCount }, (_, index) => ({ id: `anchor-${index}` })),
    }),
}));

jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({ hasActiveEntitlement: mockHasActiveEntitlement }),
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
    mockSetPendingForgeIntent.mockClear();
    mockClearPendingForgeIntent.mockClear();
    mockSetPendingForgeResumeTarget.mockClear();
    mockPendingForgeIntent = null;
    mockIsAuthenticated = true;
    mockHasActiveEntitlement = true;
    mockAnchorCount = 1;
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Advance past the longest animation (600ms) so RAF-backed animations complete
    // before we clear timers — prevents TRLN cleanup from restarting them with real timers.
    act(() => { jest.advanceTimersByTime(1000); });
    jest.clearAllTimers();
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
    expect(mockNavigate).toHaveBeenCalledWith('Paywall');
  });

  it.each([
    ['zzzzzz', "That doesn't look like an intention. What do you actually want?"],
    ['I will focus today', 'Try present tense: "I choose…" "I am…" or "I return…"'],
    ["I don't check social media", 'Try affirmative: "I choose…" instead of "I don\'t…"'],
  ])('shows shared intention guidance for %s', (text, guidance) => {
    render(<ReturningIntentionScreen />);
    const input = screen.UNSAFE_getByType(TextInput);

    fireEvent.changeText(input, text);
    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.getByText(guidance)).toBeTruthy();
  });
});
