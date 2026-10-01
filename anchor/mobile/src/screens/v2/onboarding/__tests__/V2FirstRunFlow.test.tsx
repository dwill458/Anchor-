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

const draft: {
  currentStep: string;
  focusCategory?: string;
  desiredOutcome?: string;
  desiredWhy?: string;
  desiredFriction?: string;
} = { currentStep: 'welcome' };
const mockResetFirstRun = jest.fn();
const mockSetStep = jest.fn((step: string) => { draft.currentStep = step; });
const mockSetFocusCategory = jest.fn((category: string) => { draft.focusCategory = category; });
const mockSetDesiredOutcome = jest.fn((outcome: string) => { draft.desiredOutcome = outcome; });
const mockSetDesiredWhy = jest.fn((why: string) => { draft.desiredWhy = why; });
const mockSetDesiredFriction = jest.fn((friction: string) => { draft.desiredFriction = friction; });
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
    setDesiredWhy: mockSetDesiredWhy,
    setDesiredFriction: mockSetDesiredFriction,
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
      // Past CTA_READY_MS (11950ms): the mark forms and settles, the brand identity reveals
      // beneath it, then the editorial copy and CTA arm.
      await new Promise((resolve) => setTimeout(resolve, 12100));
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
    for (const [index, label] of ['More freedom', 'More confidence', 'More opportunity', 'Work I’m proud of'].entries()) {
      expect(screen.getByTestId(`outcome-row-${index}`).props.accessibilityState).toMatchObject({ selected: false });
      expect(screen.getByText(label)).toBeTruthy();
    }
    // A different category's outcomes are not shown.
    expect(screen.queryByText('A healthier life')).toBeNull();
    expect(screen.getByTestId('outcome-continue').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('selects one outcome, enables Continue, and advances to Screen 5', () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('outcome-row-1'));
    expect(mockSetDesiredOutcome).toHaveBeenLastCalledWith('More confidence');
    expect(mockSetStep).not.toHaveBeenCalledWith('meaning');

    draft.desiredOutcome = 'More confidence';
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByTestId('outcome-row-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('outcome-continue').props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(screen.getByTestId('outcome-continue'));
    expect(mockSetStep).toHaveBeenLastCalledWith('meaning');
  });

  it('goes back to Screen 3 (motivation)', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockSetStep).toHaveBeenLastCalledWith('motivation');
  });
});

describe('V2FirstRunFlow Screen 5 — emotional meaning', () => {
  beforeEach(() => {
    draft.currentStep = 'meaning';
    draft.focusCategory = 'health';
    draft.desiredOutcome = 'More energy';
    delete draft.desiredWhy;
    mockSetStep.mockClear();
    mockSetDesiredWhy.mockClear();
  });

  it('shows why options for the chosen category and displays the persistent pill', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('v2-onboarding-meaning')).toBeTruthy();
    expect(screen.getByLabelText('Step 5 of 8')).toBeTruthy();
    expect(screen.getByTestId('system-context-pill').props.children).toBe('HEALTH · MORE ENERGY');
    expect(screen.getByText(/Why does this matter\s+to you now\?/)).toBeTruthy();
    expect(screen.getByText('Choose what feels most true.')).toBeTruthy();

    for (const [index, label] of [
      'I want to feel like myself again',
      'I want to show up better every day',
      'I’m ready to stop putting this off',
      'I want to see what I’m capable of',
    ].entries()) {
      expect(screen.getByTestId(`meaning-row-${index}`).props.accessibilityState).toMatchObject({ selected: false });
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('selects an emotional reason, enables Continue, and advances to Screen 6', () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('meaning-row-0'));
    expect(mockSetDesiredWhy).toHaveBeenLastCalledWith('I want to feel like myself again');

    draft.desiredWhy = 'I want to feel like myself again';
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByTestId('meaning-row-0').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('meaning-continue').props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(screen.getByTestId('meaning-continue'));
    expect(mockSetStep).toHaveBeenLastCalledWith('friction');
  });

  it('goes back to Screen 4 (outcome)', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockSetStep).toHaveBeenLastCalledWith('outcome');
  });
});

describe('V2FirstRunFlow Screen 6 — friction', () => {
  beforeEach(() => {
    draft.currentStep = 'friction';
    draft.focusCategory = 'health';
    draft.desiredOutcome = 'More energy';
    draft.desiredWhy = 'I want to feel like myself again';
    delete draft.desiredFriction;
    mockSetStep.mockClear();
    mockSetDesiredFriction.mockClear();
  });

  it('shows friction options for the chosen category and displays Step 6 of 8', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('v2-onboarding-friction')).toBeTruthy();
    expect(screen.getByLabelText('Step 6 of 8')).toBeTruthy();
    expect(screen.getByText(/What usually gets\s+in the way\?/)).toBeTruthy();
    expect(screen.getByText('Choose the one you recognize most.')).toBeTruthy();

    for (const [index, label] of [
      'I lose momentum',
      'I struggle to stay consistent',
      'Life gets crowded',
      'I fall back into old habits',
    ].entries()) {
      expect(screen.getByTestId(`friction-row-${index}`).props.accessibilityState).toMatchObject({ selected: false });
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('selects a friction answer and advances to Screen 7', () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('friction-row-0'));
    expect(mockSetDesiredFriction).toHaveBeenLastCalledWith('I lose momentum');

    draft.desiredFriction = 'I lose momentum';
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByTestId('friction-row-0').props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(screen.getByTestId('friction-continue'));
    expect(mockSetStep).toHaveBeenLastCalledWith('system');
  });

  it('goes back to Screen 5 (meaning)', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockSetStep).toHaveBeenLastCalledWith('meaning');
  });
});

describe('V2FirstRunFlow Screen 7 — keep what matters in sight', () => {
  beforeEach(() => {
    draft.currentStep = 'system';
    draft.focusCategory = 'abundance';
    draft.desiredOutcome = 'More financial freedom';
    mockSetStep.mockClear();
  });

  it('shows SEE, REINFORCE and MOVE for the chosen category and outcome at Step 7 of 8', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByLabelText('Step 7 of 8')).toBeTruthy();
    expect(screen.getByTestId('system-context-pill').props.children).toBe('ABUNDANCE · MORE FINANCIAL FREEDOM');
    for (const [label, copy] of [
      ['SEE', /Picture where you’re going\./],
      ['REINFORCE', /Return to your Anchor to keep the intention present\./],
      ['MOVE', /Turn that clarity into your next step\./],
    ] as const) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByText(copy)).toBeTruthy();
    }
    for (const kind of ['see', 'reinforce', 'move']) {
      expect(screen.getByTestId(`system-art-${kind}`)).toBeTruthy();
    }
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

  it('continues to Screen 8 (handoff)', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('system-continue'));
    expect(mockSetStep).toHaveBeenLastCalledWith('handoff');
  });

  it('goes back to Screen 6 (friction)', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockSetStep).toHaveBeenLastCalledWith('friction');
  });
});

describe('V2FirstRunFlow Screen 8 — final handoff', () => {
  beforeEach(() => {
    draft.currentStep = 'handoff';
    draft.focusCategory = 'health';
    draft.desiredOutcome = 'More energy';
    mockSetStep.mockClear();
  });

  it('shows ONLY the hero Anchor and culmination copy at Step 8 of 8', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByLabelText('Step 8 of 8')).toBeTruthy();
    expect(screen.getByTestId('handoff-hero-anchor')).toBeTruthy();
    expect(screen.getByText(/You know what matters\.\s+Now give it a shape\./)).toBeTruthy();
    expect(screen.getByText('Create a visual Anchor for what you want to keep moving toward.')).toBeTruthy();
    expect(screen.getByText('Built around what matters to you.')).toBeTruthy();
    expect(screen.getByTestId('handoff-create-anchor')).toBeTruthy();
    expect(screen.getByText('Create My Anchor')).toBeTruthy();
  });

  it('transitions directly into the existing creation flow on CTA press', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('handoff-create-anchor'));
    expect(mockSetStep).toHaveBeenLastCalledWith('creation');
  });

  it('goes back to Screen 7 (system)', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockSetStep).toHaveBeenLastCalledWith('system');
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
