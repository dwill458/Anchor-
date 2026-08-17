import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NarrativeOnboardingScreen } from '../NarrativeOnboardingScreen';

const mockCompleteOnboarding = jest.fn();
const mockSetShouldRedirectToCreation = jest.fn();
const mockIsGuest = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    completeOnboarding: mockCompleteOnboarding,
    setShouldRedirectToCreation: mockSetShouldRedirectToCreation,
    setIsGuest: mockIsGuest,
  }),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => true,
}));

jest.mock('@/stores/firstAnchorFlowStore', () => ({
  useFirstAnchorFlowStore: {
    getState: () => ({
      draft: {
        onboardingName: 'Alex',
        onboardingUseCase: 'deep_work',
      },
      updateDraft: jest.fn(),
    }),
  },
}));

jest.mock('@/components/onboarding/ForgeDemo', () => ({
  ForgeDemo: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('NarrativeOnboardingScreen Android Back Button', () => {
  let backHandlerCallbacks: Array<() => boolean> = [];
  const originalPlatformOS = require('react-native').Platform.OS;

  beforeEach(() => {
    jest.useFakeTimers();
    backHandlerCallbacks = [];
    require('react-native').Platform.OS = 'android';
    jest.spyOn(require('react-native').BackHandler, 'addEventListener').mockImplementation(
      (...args: any[]) => {
        const [event, callback] = args;
        if (event === 'hardwareBackPress') {
          backHandlerCallbacks.push(callback);
        }
        return {
          remove: jest.fn(() => {
            backHandlerCallbacks = backHandlerCallbacks.filter((cb) => cb !== callback);
          }),
        } as any;
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    require('react-native').Platform.OS = originalPlatformOS;
    jest.restoreAllMocks();
  });

  it('returns false on first slide (slide 0) allowing normal back/exit', () => {
    const mockNav = { navigate: jest.fn() } as any;
    render(<NarrativeOnboardingScreen navigation={mockNav} route={{} as any} />);

    const handler = backHandlerCallbacks[backHandlerCallbacks.length - 1];
    expect(handler()).toBe(false);
  });

  it('steps back to previous slide and returns true when on slide > 0', () => {
    const mockNav = { navigate: jest.fn() } as any;
    const { getByText } = render(
      <NarrativeOnboardingScreen navigation={mockNav} route={{} as any} />
    );

    // Initial slide 0
    expect(getByText('The Problem')).toBeTruthy();

    // Advance to slide 1
    act(() => {
      fireEvent.press(getByText('NEXT'));
      jest.advanceTimersByTime(500);
    });
    expect(getByText('The Gap')).toBeTruthy();

    // Press Android hardware back
    const handler = backHandlerCallbacks[backHandlerCallbacks.length - 1];
    let handled: boolean | undefined;
    act(() => {
      handled = handler();
      jest.advanceTimersByTime(500);
    });
    expect(handled).toBe(true);

    // Back to slide 0
    expect(getByText('The Problem')).toBeTruthy();
  });
});

