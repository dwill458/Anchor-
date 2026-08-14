import React from 'react';
import { Alert, Animated } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthService } from '@/services/AuthService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { LoginScreen } from '../LoginScreen';

const mockSetPreferredPlanId = jest.fn();
let mockReduceMotionEnabled = false;
const mockNavigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  getState: jest.fn(() => ({ routeNames: ['Login', 'Vault', 'SaveProgress'] })),
};

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  AppleAuthenticationButton: ({ onPress }: { onPress?: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>Continue with Apple</Text>
      </Pressable>
    );
  },
  AppleAuthenticationButtonType: {
    CONTINUE: 'CONTINUE',
  },
  AppleAuthenticationButtonStyle: {
    BLACK: 'BLACK',
  },
}));

jest.mock('@/stores/authStore', () => {
  const useAuthStore = jest.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      hasCompletedOnboarding: false,
      pendingFirstAnchorDraft: null,
    };

    return selector ? selector(state) : state;
  }) as jest.Mock & { getState: () => { pendingFirstAnchorDraft: null } };

  useAuthStore.getState = () => ({ pendingFirstAnchorDraft: null });

  return { useAuthStore };
});

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      setPreferredPlanId: mockSetPreferredPlanId,
    };

    return selector ? selector(state) : state;
  },
}));

jest.mock('@/services/PostAuthFlowService', () => ({
  __esModule: true,
  default: {
    run: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/navigation/firstAnchorGate', () => ({
  navigateToVaultDestination: jest.fn(),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotionEnabled,
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReduceMotionEnabled = false;
  });

  it('sends a password reset email for the entered address', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (AuthService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

    const screen = render(
      <LoginScreen
        navigation={mockNavigation as never}
        route={{ params: { initialTab: 'signin' } }}
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), '  USER@Example.COM  ');
    fireEvent.press(screen.getByText('Forgot password?'));

    await waitFor(() => {
      expect(AuthService.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com');
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Reset email sent',
      'If an Anchor account exists for user@example.com, a reset link will arrive shortly.'
    );
  });

  it('does not track TRIAL_STARTED when Apple sign-in links an existing account', async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (AuthService.signInWithApple as jest.Mock).mockResolvedValue({
      user: { id: 'existing-user' },
      token: 'token',
      isNewUser: false,
    });
    const trackSpy = jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);

    const screen = render(
      <LoginScreen
        navigation={mockNavigation as never}
        route={{ params: { initialTab: 'signup' } }}
      />
    );

    fireEvent.press(await screen.findByText('Continue with Apple'));

    await waitFor(() => {
      expect(AuthService.signInWithApple).toHaveBeenCalled();
    });

    expect(trackSpy).not.toHaveBeenCalledWith(
      AnalyticsEvents.TRIAL_STARTED,
      expect.anything()
    );
  });

  it('tracks TRIAL_STARTED when Apple sign-in creates a new account', async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    (AuthService.signInWithApple as jest.Mock).mockResolvedValue({
      user: { id: 'new-user' },
      token: 'token',
      isNewUser: true,
    });
    const trackSpy = jest.spyOn(AnalyticsService, 'track').mockImplementation(() => undefined);

    const screen = render(
      <LoginScreen
        navigation={mockNavigation as never}
        route={{ params: { initialTab: 'signup' } }}
      />
    );

    fireEvent.press(await screen.findByText('Continue with Apple'));

    await waitFor(() => {
      expect(trackSpy).toHaveBeenCalledWith(
        AnalyticsEvents.TRIAL_STARTED,
        expect.objectContaining({ provider: 'apple' })
      );
    });
  });

  it('labels auth controls and removes ambient animation when reduced motion is enabled', () => {
    mockReduceMotionEnabled = true;
    const timingSpy = jest.spyOn(Animated, 'timing');

    const screen = render(
      <LoginScreen
        navigation={mockNavigation as never}
        route={{ params: { initialTab: 'signin' }}}
      />
    );

    expect(screen.getByLabelText('EMAIL')).toBeTruthy();
    expect(screen.getByLabelText('PASSWORD')).toBeTruthy();
    expect(screen.getByLabelText('Show password')).toBeTruthy();
    expect(screen.getByLabelText('Sign in or sign up')).toBeTruthy();
    expect(timingSpy).not.toHaveBeenCalled();
    timingSpy.mockRestore();
  });
});
