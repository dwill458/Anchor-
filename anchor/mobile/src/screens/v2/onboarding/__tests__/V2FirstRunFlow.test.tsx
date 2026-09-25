import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockSetSession = jest.fn();
let mockHasCompletedOnboarding = true;
jest.mock('@/stores/authStore', () => {
  const state = {
    user: null,
      setSession: mockSetSession,
      completeOnboarding: jest.fn(),
      get hasCompletedOnboarding() {
        return mockHasCompletedOnboarding;
      },
  };
  const useAuthStore: any = (selector: (value: typeof state) => unknown) => selector(state);
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: Object.assign(
    (select: (state: { anchors: unknown[] }) => unknown) => select({ anchors: [] }),
    { getState: () => ({ getAnchorById: jest.fn(), addAnchor: jest.fn() }) },
  ),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: jest.fn() }),
}));

const draft: { currentStep: string } = { currentStep: 'welcome' };
const mockResetFirstRun = jest.fn();
const mockSetStep = jest.fn((step: string) => { draft.currentStep = step; });
jest.mock('@/stores/v2/firstRunStore', () => ({
  useFirstRunStore: Object.assign(() => ({
    draft,
    hydrated: true,
    setDirection: jest.fn(),
    setIntention: jest.fn(),
    form: jest.fn(),
    setExpression: jest.fn(),
    setVisionChoice: jest.fn(),
    setStep: mockSetStep,
    markFocusCompleted: jest.fn(),
    markFocusRecorded: jest.fn(),
    markAuthCompleted: jest.fn(),
    markAnchorPersisted: jest.fn(),
    complete: jest.fn(),
    reset: mockResetFirstRun,
  }), { getState: () => ({ draft }) }),
}));

import { V2FirstRunFlow } from '../V2FirstRunFlow';

describe('V2FirstRunFlow returning-user sign in', () => {
  beforeEach(() => {
    draft.currentStep = 'welcome';
    mockSetSession.mockReset();
    mockNavigate.mockReset();
    mockResetFirstRun.mockReset();
    mockSetStep.mockClear();
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

  it('explains what Anchor does on Screen 2 before personalization begins', async () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByText('Get started'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(mockSetStep).toHaveBeenCalledWith('bridge');
    view.rerender(<V2FirstRunFlow />);

    expect(screen.getByTestId('v2-onboarding-bridge')).toBeTruthy();
    expect(screen.getByText('2 / 8')).toBeTruthy();
    expect(screen.getByText(/Give what matters\s+a/)).toBeTruthy();
    expect(screen.getByText('shape.')).toBeTruthy();
    expect(
      screen.getByText('Anchor turns an intention into a visual you can return to, reinforce, and act on.'),
    ).toBeTruthy();
    expect(screen.getByText('SEE · REINFORCE · MOVE')).toBeTruthy();
    // A demonstration, not the user's Anchor.
    expect(screen.queryByText(/your anchor/i)).toBeNull();

    // The CTA only arms once the explanation has formed.
    fireEvent.press(screen.getByText('Continue'));
    expect(mockSetStep).not.toHaveBeenCalledWith('motivation');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    });
    fireEvent.press(screen.getByText('Continue'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(mockSetStep).toHaveBeenLastCalledWith('motivation');
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByText(/What are you hoping\s+will change/)).toBeTruthy();
    expect(screen.queryByText('Career')).toBeNull();
  }, 15000);
});

describe('V2FirstRunFlow first Anchor', () => {
  beforeEach(() => {
    draft.currentStep = 'creation';
  });

  it('makes the first Anchor with the same creation flow as every later one', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('v2-creation-intention')).toBeTruthy();
    expect(screen.getByText('Every Anchor starts')).toBeTruthy();
  });
});
