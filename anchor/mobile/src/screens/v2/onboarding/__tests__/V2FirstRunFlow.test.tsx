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

const draft: { currentStep: string; focusCategory?: string } = { currentStep: 'welcome' };
const mockResetFirstRun = jest.fn();
const mockSetStep = jest.fn((step: string) => { draft.currentStep = step; });
const mockSetFocusCategory = jest.fn((category: string) => { draft.focusCategory = category; });
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
    setFocusCategory: mockSetFocusCategory,
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
    delete draft.focusCategory;
    mockSetFocusCategory.mockClear();
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
    expect(screen.getByLabelText('Step 2 of 8')).toBeTruthy();
    expect(screen.getByText('02', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(/Give what matters\s+a/)).toBeTruthy();
    expect(screen.getByText('shape.')).toBeTruthy();
    expect(
      screen.getByText('Anchor turns an intention into a visual you can return to, reinforce, and act on.'),
    ).toBeTruthy();
    expect(screen.getByText('SEE · REINFORCE · MOVE')).toBeTruthy();
    // A demonstration, not the user's Anchor.
    expect(screen.queryByText(/your anchor/i)).toBeNull();

    // The CTA only arms once the explanation has formed.
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(mockSetStep).not.toHaveBeenCalledWith('motivation');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    });

    // Screen 3 is already mounted beneath Screen 2 (decoded before Continue), with nothing chosen.
    expect(screen.getByTestId('v2-onboarding-focus')).toBeTruthy();
    expect(screen.getByTestId('v2-onboarding-bridge')).toBeTruthy();

    fireEvent.press(screen.getByTestId('v2-onboarding-bridge').findByProps({ accessibilityLabel: 'Continue' }));
    // Continuous handoff: no navigation until every Screen 2 layer has faded.
    expect(mockSetStep).not.toHaveBeenCalledWith('motivation');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(mockSetStep).toHaveBeenLastCalledWith('motivation');
    view.rerender(<V2FirstRunFlow />);
    expect(screen.queryByTestId('v2-onboarding-bridge')).toBeNull();
    expect(screen.getByTestId('v2-onboarding-focus')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 8')).toBeTruthy();
    expect(screen.getByText(/What matters most\s+to you right now\?/)).toBeTruthy();
  }, 15000);
});

describe('V2FirstRunFlow Screen 3 — what matters most', () => {
  beforeEach(() => {
    draft.currentStep = 'motivation';
    delete draft.focusCategory;
    mockSetStep.mockClear();
    mockSetFocusCategory.mockClear();
  });

  it('shows four areas, none chosen, with Continue disabled', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByText('Choose what you want to move toward first.')).toBeTruthy();
    for (const id of ['health', 'career', 'relationships', 'something_else']) {
      expect(screen.getByTestId(`focus-card-${id}`).props.accessibilityState).toMatchObject({ selected: false });
    }
    expect(screen.getByText('Something else')).toBeTruthy();
    // Progressive disclosure: the remaining categories are not on screen yet.
    expect(screen.queryByText('Creativity')).toBeNull();
    expect(screen.queryByText('Desire')).toBeNull();
    expect(screen.getByTestId('focus-continue').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('focus-continue'));
    expect(mockSetStep).not.toHaveBeenCalledWith('outcome');
  });

  it('selects one area, enables Continue, and leaves for Screen 4', async () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('focus-card-career'));
    expect(mockSetFocusCategory).toHaveBeenLastCalledWith('career');
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByTestId('focus-card-career').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('focus-card-health').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('focus-continue').props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(screen.getByTestId('focus-card-health'));
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByTestId('focus-card-career').props.accessibilityState).toMatchObject({ selected: false });

    fireEvent.press(screen.getByTestId('focus-continue'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(mockSetStep).toHaveBeenLastCalledWith('outcome');
  });

  it('reveals the remaining areas behind Something else and keeps the choice on Screen 3', async () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('focus-card-something_else'));
    expect(mockSetStep).not.toHaveBeenCalled();
    for (const label of ['Desire', 'Creativity', 'Spirituality', 'Abundance', 'Family', 'Learning', 'Adventure', 'Custom']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Choose what fits best.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('focus-more-creativity'));
    expect(mockSetFocusCategory).toHaveBeenLastCalledWith('creativity');
    // The sheet closes on its own once the choice registers.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
    });
    view.rerender(<V2FirstRunFlow />);
    expect(screen.queryByTestId('focus-more-sheet')).toBeNull();
    expect(screen.getByTestId('focus-more-sheet', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('focus-card-something_else').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('focus-card-something_else').props.accessibilityLabel).toBe('Creativity');
    expect(screen.getByTestId('focus-continue').props.accessibilityState).toMatchObject({ disabled: false });
    expect(draft.currentStep).toBe('motivation');
  });
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
