import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AIGeneratingScreen from '../AIGeneratingScreen';
import { useAuthStore } from '@/stores/authStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

const mockDefaultRouteParams = {
  intentionText: 'I cultivate stillness and clarity',
  category: 'mindfulness' as const,
  distilledLetters: ['S', 'T', 'L'],
  baseSigilSvg: '<svg></svg>',
  reinforcedSigilSvg: undefined,
  structureVariant: 'balanced' as const,
  styleChoice: 'watercolor' as const,
  reinforcementMetadata: undefined,
};

let mockCurrentRouteParams = { ...mockDefaultRouteParams };

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: mockReplace,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: mockCurrentRouteParams,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: any) => {
    const { View } = require('react-native');
    return <View style={style}>{children}</View>;
  },
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn().mockResolvedValue(undefined),
    notification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({
    hasActiveEntitlement: true,
    isTrialActive: true,
    isSubscribed: false,
    hasExpired: false,
    daysRemaining: 7,
    subscriptionStatus: 'trial',
  }),
}));

jest.mock('@/services/PerformanceMonitoring', () => ({
  PerformanceMonitoring: {
    startTrace: () => ({
      putAttribute: jest.fn(),
      stop: jest.fn(),
    }),
  },
}));

jest.mock('@/services/AuthService', () => ({
  AuthService: {
    getIdToken: jest.fn().mockResolvedValue('mock-token'),
  },
}));

let mockReduceMotionEnabled = false;

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotionEnabled,
}));

describe('AIGeneratingScreen (Anchor 1.5)', () => {
  beforeEach(() => {
    mockReduceMotionEnabled = false;
    jest.clearAllMocks();
    mockCurrentRouteParams = { ...mockDefaultRouteParams };
    useFirstAnchorFlowStore.getState().clearDraft();
    useAuthStore.setState({
      user: { id: 'test-user' } as any,
      isAuthenticated: true,
      anchorCount: 1,
    });
    (global as any).fetch = jest.fn();
  });

  it('renders the Anchor 1.5 header, structure hero, and continuity metadata', async () => {
    (global as any).fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    render(<AIGeneratingScreen />);

    expect(screen.getByText('GENERATING')).toBeTruthy();
    expect(screen.getByText('Generating Your Anchor')).toBeTruthy();
    expect(
      screen.getByText('Creating expressions from your structure and selected style.')
    ).toBeTruthy();
    expect(screen.getByText('STRUCTURE · STYLE')).toBeTruthy();
    expect(screen.getByText('Focused · Watercolor')).toBeTruthy();
    expect(screen.getByText('Usually ready in about 30 seconds.')).toBeTruthy();
    expect(screen.getByText('PREPARING STRUCTURE')).toBeTruthy();
  });

  it('progresses to ready and replaces screen with EnhancedVersionPicker upon API success', async () => {
    const mockVariations = [
      { id: 'var_1', imageUrl: 'https://example.com/1.png' },
      { id: 'var_2', imageUrl: 'https://example.com/2.png' },
    ];

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        variations: mockVariations,
        prompt: 'test prompt',
        generationTime: 3.2,
      }),
    });

    render(<AIGeneratingScreen />);

    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith(
          'EnhancedVersionPicker',
          expect.objectContaining({
            intentionText: 'I cultivate stillness and clarity',
            styleChoice: 'watercolor',
            variations: mockVariations,
          })
        );
      },
      { timeout: 3000 }
    );
  });

  it('displays in-screen error state when generation fails and allows retry', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Server overloaded' }),
    });

    render(<AIGeneratingScreen />);

    await waitFor(() => {
      expect(screen.getByText("We couldn't finish this generation.")).toBeTruthy();
    });

    expect(screen.getByText('Your structure and style are still here.')).toBeTruthy();
    const retryBtn = screen.getByRole('button', { name: 'Try Again' });
    expect(retryBtn).toBeTruthy();

    const backBtn = screen.getByRole('button', { name: 'Back to Style' });
    expect(backBtn).toBeTruthy();

    act(() => {
      fireEvent.press(backBtn);
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders gracefully when reduce motion is enabled', async () => {
    mockReduceMotionEnabled = true;
    (global as any).fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

    render(<AIGeneratingScreen />);

    expect(screen.getByText('GENERATING')).toBeTruthy();
    expect(screen.getByText('Generating Your Anchor')).toBeTruthy();
    expect(screen.getByText('PREPARING STRUCTURE')).toBeTruthy();
  });
});
