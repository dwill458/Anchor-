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
  getState: jest.fn(() => ({ routeNames: ['Login', 'Vault', 'SaveProgress'] })),
};

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  AppleAuthenticationButton: () => null,
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
});
