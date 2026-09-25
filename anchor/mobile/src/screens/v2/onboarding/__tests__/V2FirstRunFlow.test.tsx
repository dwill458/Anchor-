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

const draft: { currentStep: string; focusCategory?: string; desiredOutcome?: string } = { currentStep: 'welcome' };
const mockResetFirstRun = jest.fn();
const mockSetStep = jest.fn((step: string) => { draft.currentStep = step; });
const mockSetFocusCategory = jest.fn((category: string) => { draft.focusCategory = category; });
const mockSetDesiredOutcome = jest.fn((outcome: string) => { draft.desiredOutcome = outcome; });
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
    setDesiredOutcome: mockSetDesiredOutcome,
    toggleLifeChange: jest.fn(),
    setPrimaryNeed: jest.fn(),
    markAnswersComplete: jest.fn(),
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

    // The CTA only arms once the intention has been written, transformed into the Anchor,
    // and the finished Anchor has held.
    fireEvent.press(screen.getByLabelText('Continue'));
    expect(mockSetStep).not.toHaveBeenCalledWith('motivation');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 11500));
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
  }, 25000);
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
    // Continuous handoff: no navigation until every Screen 3 layer has faded and the
    // selected artwork has finished travelling to Screen 4.
    expect(mockSetStep).not.toHaveBeenCalledWith('outcome');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
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

describe('V2FirstRunFlow Screen 4 — what would changing this give you', () => {
  beforeEach(() => {
    draft.currentStep = 'outcome';
    draft.focusCategory = 'career';
    delete draft.desiredOutcome;
    mockSetStep.mockClear();
    mockSetDesiredOutcome.mockClear();
  });

  it('shows outcomes for the Screen 3 category chosen, none selected, with Continue disabled', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('v2-onboarding-outcome')).toBeTruthy();
    expect(screen.getByText(/What would changing\s+this give you\?/)).toBeTruthy();
    expect(screen.getByText('Choose what feels closest.')).toBeTruthy();
    expect(screen.getByText('CAREER')).toBeTruthy();
    for (const [index, label] of ['More freedom', 'More confidence', 'More stability', 'A bigger impact'].entries()) {
      expect(screen.getByTestId(`outcome-row-${index}`).props.accessibilityState).toMatchObject({ selected: false });
      expect(screen.getByText(label)).toBeTruthy();
    }
    // A different category's outcomes are not shown.
    expect(screen.queryByText('A healthier life')).toBeNull();
    expect(screen.getByTestId('outcome-continue').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('selects one outcome, enables Continue, and persists it as onboarding context', () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('outcome-row-1'));
    expect(mockSetDesiredOutcome).toHaveBeenLastCalledWith('More confidence');
    expect(mockSetStep).not.toHaveBeenCalledWith('system');

    draft.desiredOutcome = 'More confidence';
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByTestId('outcome-row-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('outcome-continue').props.accessibilityState).toMatchObject({ disabled: false });

  });

  it('hands off to Screen 5 continuously, carrying the category and outcome', async () => {
    draft.focusCategory = 'health';
    draft.desiredOutcome = 'More energy';
    const view = render(<V2FirstRunFlow />);
    // Screen 5 is mounted beneath Screen 4 before Continue, so its artwork is decoded.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    expect(screen.getByTestId('v2-onboarding-system')).toBeTruthy();
    expect(screen.getByTestId('v2-onboarding-outcome')).toBeTruthy();

    fireEvent.press(screen.getByTestId('outcome-continue'));
    // No navigation cut: Screen 4 stays until Screen 5's cream fully covers it.
    expect(mockSetStep).not.toHaveBeenCalledWith('system');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 760));
    });
    expect(mockSetStep).toHaveBeenLastCalledWith('system');
    view.rerender(<V2FirstRunFlow />);

    expect(screen.getByTestId('v2-onboarding-system')).toBeTruthy();
    expect(screen.getByLabelText('Step 5 of 8')).toBeTruthy();
    expect(screen.getByTestId('system-context-pill').props.children).toBe('HEALTH · MORE ENERGY');
    expect(screen.getByText(/Keep what matters\s+in sight\./)).toBeTruthy();
    expect(screen.getByText('See it. Reinforce it. Move toward it.')).toBeTruthy();
  });
});

describe('V2FirstRunFlow Screen 5 — keep what matters in sight', () => {
  beforeEach(() => {
    draft.currentStep = 'system';
    draft.focusCategory = 'abundance';
    draft.desiredOutcome = 'More freedom';
    mockSetStep.mockClear();
  });

  it('shows SEE, REINFORCE and MOVE for the chosen category and outcome', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByLabelText('Step 5 of 8')).toBeTruthy();
    expect(screen.getByTestId('system-context-pill').props.children).toBe('ABUNDANCE · MORE FREEDOM');
    for (const [label, copy] of [
      ['SEE', /Your future\s+clearly\./],
      ['REINFORCE', /Keep your\s+intention strong\./],
      ['MOVE', /Take the\s+next step\./],
    ] as const) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByText(copy)).toBeTruthy();
    }
    for (const kind of ['see', 'reinforce', 'move']) {
      expect(screen.getByTestId(`system-art-${kind}`)).toBeTruthy();
    }
    // SEE is an explanation, not a door into another screen.
    fireEvent.press(screen.getByText('SEE'));
    expect(mockSetStep).not.toHaveBeenCalled();
  });

  it('resolves the category artwork: the gold Anchor belongs to Abundance', () => {
    const { rerender } = render(<V2FirstRunFlow />);
    const anchorSource = () =>
      screen.getByTestId('system-art-reinforce').findByType(require('react-native').Image).props.source;
    const abundance = anchorSource();
    expect(abundance).toBe(require('@/assets/onboarding/screen5/anchor-gold-leaf.png'));
    draft.focusCategory = 'health';
    rerender(<V2FirstRunFlow />);
    expect(anchorSource()).toBe(require('@/assets/onboarding/screen5/anchor-tideglass.png'));
  });

  it('keeps Custom working through the system', () => {
    draft.focusCategory = 'custom';
    draft.desiredOutcome = 'A better life';
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('system-context-pill').props.children).toBe('CUSTOM · A BETTER LIFE');
    expect(screen.getByTestId('system-art-see')).toBeTruthy();
  });

  it('continues to the next question once the CTA has arrived', async () => {
    render(<V2FirstRunFlow />);
    // Not before it is visible.
    fireEvent.press(screen.getByTestId('system-continue'));
    expect(mockSetStep).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
    fireEvent.press(screen.getByTestId('system-continue'));
    expect(mockSetStep).toHaveBeenLastCalledWith('need');
  });

  it('resumes a draft saved on the retired step on Screen 5', () => {
    draft.currentStep = 'life';
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('v2-onboarding-system')).toBeTruthy();
    expect(screen.getByLabelText('Step 5 of 8')).toBeTruthy();
  });

  it('goes back to Screen 4 with the outcome still chosen', () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockSetStep).toHaveBeenLastCalledWith('outcome');
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByLabelText('Step 4 of 8')).toBeTruthy();
    expect(screen.getByTestId('outcome-row-0').props.accessibilityState).toMatchObject({ selected: true });
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
