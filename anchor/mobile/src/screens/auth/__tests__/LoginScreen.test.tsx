import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthService } from '@/services/AuthService';
import { LoginScreen } from '../LoginScreen';

const mockSetPreferredPlanId = jest.fn();
const mockNavigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  getState: jest.fn(() => ({ routeNames: ['Login', 'Vault', 'FirstAnchorAccountGate'] })),
};

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');

    return (
      <Pressable onPress={onPress} accessibilityRole="button">
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

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      hasCompletedOnboarding: false,
      pendingFirstAnchorDraft: null,
    };

    return selector ? selector(state) : state;
  },
}));

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

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AuthService as unknown as {
      signInWithApple: jest.Mock;
      signInWithGoogle: jest.Mock;
    }).signInWithApple = jest.fn();
    (AuthService as unknown as {
      signInWithApple: jest.Mock;
      signInWithGoogle: jest.Mock;
    }).signInWithGoogle = jest.fn();
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

  it('allows backend account creation for Apple SSO from the sign-in tab', async () => {
    (AuthService.signInWithApple as jest.Mock).mockResolvedValue({
      user: { id: 'apple-user', email: 'apple@example.com' },
      token: 'token',
      isNewUser: false,
    });

    const screen = render(
      <LoginScreen
        navigation={mockNavigation as never}
        route={{ params: { initialTab: 'signin' } }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Continue with Apple')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Continue with Apple'));

    await waitFor(() => {
      expect(AuthService.signInWithApple).toHaveBeenCalledWith(
        expect.objectContaining({
          allowBackendCreate: true,
        })
      );
    });
  });

  it('allows backend account creation for Google SSO from the sign-in tab', async () => {
    (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue({
      user: { id: 'google-user', email: 'google@example.com' },
      token: 'token',
      isNewUser: false,
    });

    const screen = render(
      <LoginScreen
        navigation={mockNavigation as never}
        route={{ params: { initialTab: 'signin' } }}
      />
    );

    fireEvent.press(screen.getByText('Continue with Google'));

    await waitFor(() => {
      expect(AuthService.signInWithGoogle).toHaveBeenCalledWith(
        expect.objectContaining({
          allowBackendCreate: true,
        })
      );
    });
  });
});
