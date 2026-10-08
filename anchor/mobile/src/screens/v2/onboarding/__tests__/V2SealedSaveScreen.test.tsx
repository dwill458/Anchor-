import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { V2SealedSaveScreen } from '../V2SealedSaveScreen';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';
import { AnalyticsService } from '@/services/AnalyticsService';
import { playCreationSound } from '@/services/CreationSounds';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));

let mockSignedInUser: { id: string; totalAnchorsCreated?: number; freeAnchorConsumed?: boolean } | null = null;
const mockAnchor = { id: 'pending-first-anchor-1', intentionText: 'I am financially free', baseSigilSvg: '<svg/>', category: 'abundance' };
const mockClearPendingFirstAnchorState = jest.fn();
const mockRemoveAnchor = jest.fn();
let mockHasActiveEntitlement = false;

jest.mock('@/stores/authStore', () => {
  const getMockState = () => ({
    user: mockSignedInUser,
    pendingFirstAnchorDraft: { tempAnchorId: 'pending-first-anchor-1' },
    signOut: jest.fn().mockResolvedValue(undefined),
    clearPendingFirstAnchorState: mockClearPendingFirstAnchorState,
  });
  const useAuthStore = (selector: (state: any) => unknown) => selector(getMockState());
  useAuthStore.getState = getMockState;
  return { useAuthStore };
});

jest.mock('@/stores/anchorStore', () => {
  const getMockState = () => ({
    anchors: [mockAnchor],
    removeAnchor: mockRemoveAnchor,
  });
  const useAnchorStore = (selector: (state: any) => unknown) => selector(getMockState());
  useAnchorStore.getState = getMockState;
  return { useAnchorStore };
});

jest.mock('@/stores/subscriptionStore', () => {
  const getMockState = () => ({
    hasActiveEntitlement: mockHasActiveEntitlement,
  });
  const useSubscriptionStore = (selector: (state: any) => unknown) => selector(getMockState());
  useSubscriptionStore.getState = getMockState;
  return { useSubscriptionStore };
});

jest.mock('@/screens/v2/paywall', () => ({
  V2PaywallScreen: (props: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="mock-v2-paywall">
        <Text>Paywall: {props.context}</Text>
        <Pressable testID="mock-paywall-entitle" onPress={() => props.onEntitled({ outcome: 'purchased' })}>
          <Text>Subscribe</Text>
        </Pressable>
        <Pressable testID="mock-paywall-dismiss" onPress={() => props.onDismiss()}>
          <Text>Dismiss</Text>
        </Pressable>
      </View>
    );
  },
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

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));

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

  it('plays the first sealed Anchor cue once per mount', () => {
    setup();
    expect(playCreationSound).toHaveBeenCalledTimes(1);
    expect(playCreationSound).toHaveBeenCalledWith('onboardingSealed');
  });

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
    expect(AnalyticsService.track).toHaveBeenCalledWith('auth_email_form_opened', { context: 'onboarding_save', mode: 'create' });
    expect(screen.getByTestId('v2-sealed-save-email-panel')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.queryByLabelText(/name/i)).toBeNull();
    expect(screen.getByLabelText('Continue with Google')).toBeTruthy();
  });

  it('counts only real email form opens, not mode switches while open', () => {
    setup();
    fireEvent.press(screen.getByTestId('v2-sealed-save-email-toggle'));
    const opened = () => (AnalyticsService.track as jest.Mock).mock.calls
      .filter(([event]) => event === 'auth_email_form_opened');
    expect(opened()).toHaveLength(1);

    fireEvent.press(screen.getByLabelText('Already have an account? Sign in'));
    fireEvent.press(screen.getByLabelText('Create a new account instead'));
    expect(opened()).toHaveLength(1);

    fireEvent.press(screen.getByLabelText('Collapse email sign up'));
    fireEvent.press(screen.getByTestId('v2-sealed-save-email-toggle'));
    expect(opened()).toHaveLength(2);
  });

  it('continue without an account keeps the Anchor on the device and confirms, then goes home', () => {
    const props = setup();
    fireEvent.press(screen.getByTestId('v2-sealed-save-skip'));
    expect(AnalyticsService.track).toHaveBeenCalledWith('auth_guest_chosen', { context: 'onboarding_save' });
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
    expect(AnalyticsService.track).toHaveBeenCalledWith('auth_started', expect.objectContaining({ context: 'onboarding_save', method: 'email', mode: 'create' }));
    expect(AnalyticsService.track).toHaveBeenCalledWith('auth_succeeded', expect.objectContaining({ context: 'onboarding_save', method: 'email', mode: 'create' }));
    expect(AnalyticsService.track).not.toHaveBeenCalledWith('auth_failed', expect.anything());
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
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'not-an-email');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'longenough1');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    expect(AnalyticsService.track).toHaveBeenCalledWith('auth_failed', expect.objectContaining({ stage: 'validation', error_code: 'email_invalid' }));
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'me@example.com');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'short');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(AuthService.signUpWithEmail).not.toHaveBeenCalled();
    expect(AnalyticsService.track).toHaveBeenCalledWith('auth_failed', expect.objectContaining({ stage: 'validation', error_code: 'password_short' }));
    expect(AnalyticsService.track).not.toHaveBeenCalledWith('auth_started', expect.anything());
  });

  it('records bad credentials as a provider failure without the error message', async () => {
    (AuthService.signInWithEmail as jest.Mock).mockRejectedValue(new Error('wrong-password private-email@example.com'));
    setup();
    fireEvent.press(screen.getByLabelText('Already have an account? Sign in'));
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'me@example.com');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'wrong-password');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    await waitFor(() => expect(AnalyticsService.track).toHaveBeenCalledWith('auth_failed', expect.objectContaining({ stage: 'provider', error_code: 'bad_credentials' })));
    expect(JSON.stringify((AnalyticsService.track as jest.Mock).mock.calls)).not.toContain('private-email@example.com');
  });

  it('reports a provider cancellation without recording an auth failure', async () => {
    (AuthService.signInWithGoogle as jest.Mock).mockRejectedValue(new Error('The request was cancelled'));
    setup();
    fireEvent.press(screen.getByLabelText('Continue with Google'));
    await waitFor(() => expect(AnalyticsService.track).toHaveBeenCalledWith('auth_cancelled', expect.objectContaining({ method: 'google', context: 'onboarding_save' })));
    expect(AnalyticsService.track).not.toHaveBeenCalledWith('auth_failed', expect.anything());
  });

  it('attributes a post-auth save rejection to anchor_save_failed only', async () => {
    (AuthService.signUpWithEmail as jest.Mock).mockResolvedValue({ user: { id: 'new-account' }, token: 'token' });
    (PostAuthFlowService.run as jest.Mock).mockRejectedValueOnce(new Error('network save failed'));
    setup();
    fireEvent.press(screen.getByTestId('v2-sealed-save-email-toggle'));
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'me@example.com');
    fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'longenough1');
    fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));
    await waitFor(() => expect(AnalyticsService.track).toHaveBeenCalledWith('anchor_save_failed', expect.objectContaining({ context: 'onboarding_save', error_code: 'network' })));
    const eventNames = (AnalyticsService.track as jest.Mock).mock.calls.map(([event]) => event);
    expect(eventNames).toEqual(expect.arrayContaining(['auth_succeeded', 'anchor_save_failed']));
    expect(eventNames).not.toContain('auth_failed');
    expect(eventNames.indexOf('auth_succeeded')).toBeLessThan(eventNames.indexOf('anchor_save_failed'));
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
    expect(AnalyticsService.track).toHaveBeenCalledWith('anchor_save_retry', { context: 'onboarding_save', attempt: 1 });
    expect(props.onAccountReady).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-account' }));
    expect(AuthService.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('can start on the confirmation after a relaunch', () => {
    setup({ initialSaved: 'account' });
    expect(screen.getByText('PROGRESS SAVED')).toBeTruthy();
    expect(screen.queryByLabelText('Continue with Google')).toBeNull();
  });

  describe('locked free user account handling', () => {
    it('shows paywall when signing into a locked free account that already consumed its free anchor', async () => {
      (AuthService.signInWithEmail as jest.Mock).mockResolvedValue({
        user: { id: 'locked-free-user', totalAnchorsCreated: 1, freeAnchorConsumed: true },
        token: 'token',
      });
      (PostAuthFlowService.run as jest.Mock).mockRejectedValueOnce(new Error('CREATE_ANCHOR_FREE_LOCKED'));

      setup();
      fireEvent.press(screen.getByLabelText('Already have an account? Sign in'));
      fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'freeuser@example.com');
      fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'password123');
      fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('v2-sealed-save-paywall-modal')).toBeTruthy();
      });
      expect(screen.getByText('Paywall: SECOND_ANCHOR')).toBeTruthy();
    });

    it('dismissing the paywall leaves the user on Anchor Pro required screen, and discarding permanently removes the anchor', async () => {
      (AuthService.signInWithEmail as jest.Mock).mockResolvedValue({
        user: { id: 'locked-free-user', totalAnchorsCreated: 1, freeAnchorConsumed: true },
        token: 'token',
      });
      (PostAuthFlowService.run as jest.Mock).mockRejectedValueOnce(new Error('CREATE_ANCHOR_FREE_LOCKED'));

      const props = setup();
      fireEvent.press(screen.getByLabelText('Already have an account? Sign in'));
      fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'freeuser@example.com');
      fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'password123');
      fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('v2-sealed-save-paywall-modal')).toBeTruthy();
      });

      // Dismiss the paywall
      fireEvent.press(screen.getByTestId('mock-paywall-dismiss'));

      // Paywall closes and screen shows Anchor Pro required
      expect(screen.queryByTestId('v2-sealed-save-paywall-modal')).toBeNull();
      expect(screen.getByText('Anchor Pro required')).toBeTruthy();
      expect(screen.getByTestId('v2-sealed-save-unlock-pro')).toBeTruthy();
      expect(screen.getByTestId('v2-sealed-save-discard')).toBeTruthy();

      // Tap Discard Anchor & Continue -> anchor is lost forever
      fireEvent.press(screen.getByTestId('v2-sealed-save-discard'));
      expect(mockRemoveAnchor).toHaveBeenCalledWith('pending-first-anchor-1');
      expect(mockClearPendingFirstAnchorState).toHaveBeenCalled();
      expect(props.onContinue).toHaveBeenCalledWith('account');
    });

    it('subscribing on paywall finalizes anchor and shows PROGRESS SAVED', async () => {
      (AuthService.signInWithEmail as jest.Mock).mockResolvedValue({
        user: { id: 'locked-free-user', totalAnchorsCreated: 1, freeAnchorConsumed: true },
        token: 'token',
      });
      (PostAuthFlowService.run as jest.Mock).mockRejectedValueOnce(new Error('CREATE_ANCHOR_FREE_LOCKED'));
      mockSignedInUser = null;

      const props = setup();
      fireEvent.press(screen.getByLabelText('Already have an account? Sign in'));
      fireEvent.changeText(screen.getByTestId('v2-sealed-save-email'), 'freeuser@example.com');
      fireEvent.changeText(screen.getByTestId('v2-sealed-save-password'), 'password123');
      fireEvent.press(screen.getByTestId('v2-sealed-save-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('v2-sealed-save-paywall-modal')).toBeTruthy();
      });

      // Complete subscription on paywall
      fireEvent.press(screen.getByTestId('mock-paywall-entitle'));

      await waitFor(() => {
        expect(screen.getByText('PROGRESS SAVED')).toBeTruthy();
      });
      expect(props.onAccountReady).toHaveBeenCalledWith(expect.objectContaining({ id: 'locked-free-user' }));
    });

    it('renders Anchor Pro required state directly when an already-authenticated user is a locked free user', () => {
      mockSignedInUser = { id: 'locked-user', totalAnchorsCreated: 1, freeAnchorConsumed: true };
      mockHasActiveEntitlement = false;

      setup();
      expect(screen.getByText('Anchor Pro required')).toBeTruthy();
      expect(screen.getByTestId('v2-sealed-save-unlock-pro')).toBeTruthy();
      expect(screen.getByTestId('v2-sealed-save-discard')).toBeTruthy();
      expect(screen.queryByTestId('v2-sealed-save-retry')).toBeNull();
    });
  });
});
