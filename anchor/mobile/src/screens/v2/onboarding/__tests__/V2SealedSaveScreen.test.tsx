import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { V2SealedSaveScreen } from '../V2SealedSaveScreen';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';

let mockSignedInUser: { id: string } | null = null;
const mockAnchor = { id: 'pending-first-anchor-1', intentionText: 'I am financially free', baseSigilSvg: '<svg/>', category: 'abundance' };

jest.mock('@/stores/authStore', () => {
  const getMockState = () => ({
    user: mockSignedInUser,
    pendingFirstAnchorDraft: { tempAnchorId: 'pending-first-anchor-1' },
    signOut: jest.fn().mockResolvedValue(undefined),
  });
  const useAuthStore = (selector: (state: any) => unknown) => selector(getMockState());
  useAuthStore.getState = getMockState;
  return { useAuthStore };
});

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: any) => unknown) => selector({ anchors: [mockAnchor] }),
}));

jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => ({
  CircularAnchorRenderer: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID} />;
  },
}));

jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true) }));

jest.mock('@/services/AuthService', () => ({
  AuthService: {
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/PostAuthFlowService', () => ({
  __esModule: true,
  default: { run: jest.fn().mockResolvedValue(undefined) },
}));

const setup = (overrides: Partial<React.ComponentProps<typeof V2SealedSaveScreen>> = {}) => {
  const props = {
    onAccountReady: jest.fn().mockResolvedValue(undefined),
    onContinueWithout: jest.fn(),
    onContinue: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
  render(<V2SealedSaveScreen {...props} />);
  return props;
};

describe('V2SealedSaveScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSignedInUser = null; });

  it('shows the sealed Anchor, the line, and all three account options plus the skip', () => {
    setup();
    expect(screen.getByTestId('v2-sealed-save-coin')).toBeTruthy();
    expect(screen.getByText(/YOUR ANCHOR/)).toBeTruthy();
    expect(screen.getByText(/I am financially free/)).toBeTruthy();
    expect(screen.getByText('Save your progress')).toBeTruthy();
    expect(screen.getByLabelText('Continue with Google')).toBeTruthy();
    expect(screen.getByLabelText('Continue with email')).toBeTruthy();
    expect(screen.getByLabelText('Continue without an account')).toBeTruthy();
    expect(screen.getByLabelText('Already have an account? Sign in')).toBeTruthy();
  });

  it('expands email in place with no name field', () => {
    setup();
    fireEvent.press(screen.getByTestId('v2-sealed-save-email-toggle'));
    expect(screen.getByTestId('v2-sealed-save-email-panel')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.queryByLabelText(/name/i)).toBeNull();
    expect(screen.getByLabelText('Continue with Google')).toBeTruthy();
  });

  it('continue without an account keeps the Anchor on the device and confirms, then goes home', () => {
    const props = setup();
    fireEvent.press(screen.getByTestId('v2-sealed-save-skip'));
    expect(props.onContinueWithout).toHaveBeenCalledTimes(1);
    expect(screen.getByText('PROGRESS SAVED')).toBeTruthy();
    expect(screen.getByText(/saved on this device/)).toBeTruthy();
    expect(AuthService.signUpWithEmail).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('v2-sealed-save-home'));
    expect(props.onContinue).toHaveBeenCalledWith('guest');
  });

  it('creating an account saves the Anchor, then confirms with cloud copy', async () => {
    (AuthService.signUpWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'new-account' }, token: 'token' });
    const props = setup();
    fireEvent.press(screen.getByTestId('v2-sealed-save-email-toggle'));
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'me@example.com');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'longenough1');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    await waitFor(() => expect(screen.getByText('PROGRESS SAVED')).toBeTruthy());
    expect(AuthService.signUpWithEmail).toHaveBeenCalledWith('me@example.com', 'longenough1');
    expect(PostAuthFlowService.run).toHaveBeenCalled();
    expect(props.onAccountReady).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-account' }));
    expect(screen.getByText(/saved to your account/)).toBeTruthy();
    expect(props.onContinueWithout).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('v2-sealed-save-home'));
    expect(props.onContinue).toHaveBeenCalledWith('account');
  });

  it('validates the email form before calling the backend', () => {
    setup();
    fireEvent.press(screen.getByTestId('v2-sealed-save-email-toggle'));
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'me@example.com');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'short');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(AuthService.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('"Already have an account? Sign in" switches the expanded form to sign in', async () => {
    (AuthService.signInWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'existing' }, token: 'token' });
    setup();
    fireEvent.press(screen.getByLabelText('Already have an account? Sign in'));
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'me@example.com');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'whatever');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    await waitFor(() => expect(AuthService.signInWithEmail).toHaveBeenCalledWith('me@example.com', 'whatever'));
  });

  it('keeps the form and shows the error when the Anchor could not be saved, and retries without registering again', async () => {
    (AuthService.signUpWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'new-account' }, token: 'token' });
    const onAccountReady = jest.fn().mockRejectedValueOnce(new Error('Your first Anchor has not finished saving. Try again.')).mockResolvedValue(undefined);
    setup({ onAccountReady });
    fireEvent.press(screen.getByTestId('v2-sealed-save-email-toggle'));
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'me@example.com');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'longenough1');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    await waitFor(() => expect(screen.getByText('Your first Anchor has not finished saving. Try again.')).toBeTruthy());
    expect(screen.queryByText('PROGRESS SAVED')).toBeNull();
  });

  it('with an account already created, offers Finish saving instead of a second sign up', async () => {
    mockSignedInUser = { id: 'new-account' };
    const props = setup();
    expect(screen.queryByLabelText('Email')).toBeNull();
    fireEvent.press(screen.getByTestId('v2-sealed-save-retry'));
    await waitFor(() => expect(screen.getByText('PROGRESS SAVED')).toBeTruthy());
    expect(props.onAccountReady).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-account' }));
    expect(AuthService.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('can start on the confirmation after a relaunch', () => {
    setup({ initialSaved: 'account' });
    expect(screen.getByText('PROGRESS SAVED')).toBeTruthy();
    expect(screen.queryByLabelText('Continue with Google')).toBeNull();
  });
});
