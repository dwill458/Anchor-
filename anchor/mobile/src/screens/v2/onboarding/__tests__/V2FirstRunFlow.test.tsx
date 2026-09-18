import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSetSession = jest.fn();
let mockHasCompletedOnboarding = true;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      setSession: mockSetSession,
      completeOnboarding: jest.fn(),
      get hasCompletedOnboarding() {
        return mockHasCompletedOnboarding;
      },
    }),
  },
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ getAnchorById: jest.fn(), addAnchor: jest.fn() }) },
}));

const mockSignInWithEmail = jest.fn();
jest.mock('@/services/AuthService', () => ({
  AuthService: {
    signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    signUpWithEmail: jest.fn(),
  },
}));

jest.mock('@/services/PracticeCompletionService', () => ({
  PracticeCompletionService: { completePracticeSession: jest.fn() },
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

const draft: { currentStep: string } = { currentStep: 'direction' };
const mockResetFirstRun = jest.fn();
jest.mock('@/stores/v2', () => ({
  useFirstRunStore: () => ({
    draft,
    hydrated: true,
    setDirection: jest.fn(),
    setIntention: jest.fn(),
    form: jest.fn(),
    setExpression: jest.fn(),
    setVisionChoice: jest.fn(),
    setStep: jest.fn(),
    markFocusCompleted: jest.fn(),
    markFocusRecorded: jest.fn(),
    markAuthCompleted: jest.fn(),
    markAnchorPersisted: jest.fn(),
    complete: jest.fn(),
    reset: mockResetFirstRun,
  }),
}));

import { V2FirstRunFlow } from '../V2FirstRunFlow';

describe('V2FirstRunFlow returning-user sign in', () => {
  beforeEach(() => {
    draft.currentStep = 'direction';
    mockSetSession.mockReset();
    mockSignInWithEmail.mockReset();
    mockResetFirstRun.mockReset();
    mockHasCompletedOnboarding = true;
  });

  it('discards a stale persisted "complete" draft instead of imperatively navigating (canonical onboarding state, not local UI progress, drives Home)', () => {
    draft.currentStep = 'complete';
    render(<V2FirstRunFlow />);
    expect(mockResetFirstRun).toHaveBeenCalled();
  });

  it('offers a secondary Sign In affordance on the entry surface without a full ritual replay', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByText('Already have an account? Sign in')).toBeTruthy();
  });

  it('signs a returning user with completed onboarding into the canonical auth store, leaving Home routing to the resolver', async () => {
    mockSignInWithEmail.mockResolvedValue({ user: { id: 'u1', hasCompletedOnboarding: true }, token: 't', isNewUser: false });
    mockHasCompletedOnboarding = true;
    render(<V2FirstRunFlow />);

    fireEvent.press(screen.getByText('Already have an account? Sign in'));
    fireEvent.changeText(screen.getByLabelText('Email address'), 'returning@user.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign in with email'));

    // AnchorV2Navigator's resolver (not this screen) is responsible for
    // swapping to V2DevelopmentHome once authStore.hasCompletedOnboarding
    // flips true — see AnchorV2Navigator.test.tsx.
    await waitFor(() => expect(mockSetSession).toHaveBeenCalledWith({ id: 'u1', hasCompletedOnboarding: true }, 't'));
    await waitFor(() => expect(screen.queryByText('Welcome back.')).toBeNull());
  });

  it('keeps a signed-in user with incomplete onboarding inside the first-run lifecycle instead of forcing Home', async () => {
    mockSignInWithEmail.mockResolvedValue({ user: { id: 'u2', hasCompletedOnboarding: false }, token: 't2', isNewUser: false });
    mockHasCompletedOnboarding = false;
    render(<V2FirstRunFlow />);

    fireEvent.press(screen.getByText('Already have an account? Sign in'));
    fireEvent.changeText(screen.getByLabelText('Email address'), 'incomplete@user.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign in with email'));

    await waitFor(() => expect(mockSetSession).toHaveBeenCalled());
    expect(screen.getByText('What are you moving toward?')).toBeTruthy();
  });

  it('surfaces an error and does not navigate when sign-in fails', async () => {
    mockSignInWithEmail.mockRejectedValue(new Error('Invalid credentials'));
    render(<V2FirstRunFlow />);

    fireEvent.press(screen.getByText('Already have an account? Sign in'));
    fireEvent.changeText(screen.getByLabelText('Email address'), 'bad@user.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByText('Sign in with email'));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeTruthy());
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('returns to the direction step via back without signing in', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByText('Already have an account? Sign in'));
    expect(screen.getByText('Welcome back.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(screen.getByText('What are you moving toward?')).toBeTruthy();
  });
});
