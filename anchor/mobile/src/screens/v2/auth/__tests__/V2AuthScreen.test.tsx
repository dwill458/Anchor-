import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { V2AuthScreen } from '../V2AuthScreen';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress}><Text>Continue with Apple</Text></Pressable>;
  },
  AppleAuthenticationButtonType: { CONTINUE: 'CONTINUE' },
  AppleAuthenticationButtonStyle: { BLACK: 'BLACK' },
}));

jest.mock('@/services/AuthService', () => ({
  AuthService: {
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  },
}));

jest.mock('@/services/PostAuthFlowService', () => ({
  __esModule: true,
  default: { run: jest.fn().mockResolvedValue(undefined) },
}));

describe('V2AuthScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('transforms one screen between sign in and create account without stale validation', () => {
    render(<V2AuthScreen onBack={jest.fn()} />);
    expect(screen.getByText('Welcome back.')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Create account' }));
    expect(screen.getByLabelText('Name (optional)')).toBeTruthy();
    expect(screen.getByText('At least 8 characters')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Sign in' }));
    expect(screen.queryByLabelText('Name (optional)')).toBeNull();
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('gives a plain-language validation error before calling auth', () => {
    render(<V2AuthScreen initialMode="create" onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    fireEvent.press(screen.getByTestId('v2-auth-submit'));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(AuthService.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('supports password visibility and email sign-in through the real service boundary', async () => {
    (AuthService.signInWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'existing', hasCompletedOnboarding: true }, token: 'token' });
    render(<V2AuthScreen onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-auth-submit'));
    await waitFor(() => expect(AuthService.signInWithEmail).toHaveBeenCalledWith('person@example.com', 'password123'));
    expect(PostAuthFlowService.run).toHaveBeenCalledWith(expect.objectContaining({ preserveCompletedOnboarding: true }));
  });

  it('uses the existing reset operation and does not expose raw messages', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (AuthService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
    render(<V2AuthScreen onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com');
    fireEvent.press(screen.getByText('Forgot password?'));
    await waitFor(() => expect(AuthService.sendPasswordResetEmail).toHaveBeenCalledWith('person@example.com'));
    expect(alertSpy).toHaveBeenCalledWith('Reset email sent', expect.stringContaining('person@example.com'));
  });
});
