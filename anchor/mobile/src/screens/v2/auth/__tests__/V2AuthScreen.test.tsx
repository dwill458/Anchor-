import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { V2AuthScreen } from '../V2AuthScreen';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
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
    // "Welcome back." is removed per Anchor 2.0 design
    expect(screen.queryByText('Welcome back.')).toBeNull();
    // Editorial contextual copy for Sign In
    expect(screen.getByText('Return to what matters.')).toBeTruthy();

    // Switch to Create Account via segmented control
    fireEvent.press(screen.getByRole('tab', { name: 'CREATE ACCOUNT' }));
    expect(screen.getByText(/A stronger tomorrow/)).toBeTruthy();
    expect(screen.getByLabelText('Name (optional)')).toBeTruthy();
    expect(screen.getByText('At least 8 characters')).toBeTruthy();

    // Switch back to Sign In
    fireEvent.press(screen.getByRole('tab', { name: 'SIGN IN' }));
    expect(screen.queryByLabelText('Name (optional)')).toBeNull();
    expect(screen.getByText('Forgot password?')).toBeTruthy();
    expect(screen.getByText('Return to what matters.')).toBeTruthy();
  });

  it('switches mode via top header contextual action', () => {
    render(<V2AuthScreen onBack={jest.fn()} />);
    expect(screen.getByText('Return to what matters.')).toBeTruthy();

    // In Sign In mode, top header has "CREATE ACCOUNT"
    fireEvent.press(screen.getByLabelText('Switch to Create account'));
    expect(screen.getByText(/A stronger tomorrow/)).toBeTruthy();
    expect(screen.getByLabelText('Name (optional)')).toBeTruthy();

    // In Create Account mode, top header has "SIGN IN"
    fireEvent.press(screen.getByLabelText('Switch to Sign in'));
    expect(screen.getByText('Return to what matters.')).toBeTruthy();
    expect(screen.queryByLabelText('Name (optional)')).toBeNull();
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
    const onSuccess = jest.fn();
    (AuthService.signInWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'existing', hasCompletedOnboarding: true }, token: 'token' });
    render(<V2AuthScreen onBack={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-auth-submit'));
    await waitFor(() => expect(AuthService.signInWithEmail).toHaveBeenCalledWith('person@example.com', 'password123'));
    expect(PostAuthFlowService.run).toHaveBeenCalledWith(expect.objectContaining({ preserveCompletedOnboarding: true }));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'existing' }));
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

  it('triggers Google social authentication', async () => {
    (AuthService.signInWithGoogle as jest.Mock).mockResolvedValue({ user: { id: 'google-user' }, token: 'token' });
    render(<V2AuthScreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Continue with Google'));
    await waitFor(() => expect(AuthService.signInWithGoogle).toHaveBeenCalledWith({ allowBackendCreate: false }));
    expect(PostAuthFlowService.run).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 'google-user' } }));
  });

  it('triggers Apple social authentication', async () => {
    (AuthService.signInWithApple as jest.Mock).mockResolvedValue({ user: { id: 'apple-user' }, token: 'token' });
    render(<V2AuthScreen onBack={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Continue with Apple'));
    await waitFor(() => expect(AuthService.signInWithApple).toHaveBeenCalledWith({ allowBackendCreate: false }));
    expect(PostAuthFlowService.run).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 'apple-user' } }));
  });
});
