import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

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

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: jest.fn() }),
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
    mockNavigate.mockReset();
    mockResetFirstRun.mockReset();
    mockHasCompletedOnboarding = true;
  });

  it('offers a secondary Sign In affordance on the entry surface without a full ritual replay', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('opens the unified V2 auth route for a returning user', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Auth', { initialMode: 'signin' });
  });
});
