import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { AnalyticsService } from '@/services/AnalyticsService';
import { OnboardingAnalytics } from '@/services/v2/onboardingAnalytics';

const mockSetSession = jest.fn();
let mockHasCompletedOnboarding = true;
let mockUser: { id: string; hasCompletedOnboarding?: boolean } | null = null;
jest.mock('@/stores/authStore', () => {
  const state = {
    get user() { return mockUser; },
    isGuest: true,
      setSession: mockSetSession,
      completeOnboarding: jest.fn(),
      setIsGuest: jest.fn(),
      clearPendingFirstAnchorState: jest.fn(),
      get hasCompletedOnboarding() {
        return mockHasCompletedOnboarding;
      },
  };
  const useAuthStore: any = (selector: (value: typeof state) => unknown) => selector(state);
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

const mockRemoveAnchor = jest.fn();
const mockAnchorsStoreState = {
  anchors: [] as any[],
  getAnchorById: jest.fn(),
  addAnchor: jest.fn(),
  removeAnchor: mockRemoveAnchor,
};
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: Object.assign(
    (select: (s: typeof mockAnchorsStoreState) => unknown) => select(mockAnchorsStoreState),
    { getState: () => mockAnchorsStoreState }
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

jest.mock('@/screens/create/IntentionInputScreen', () => ({
  __esModule: true,
  default: (props: unknown) => {
    const { View } = require('react-native');
    return <View testID="tactile-creation-entry" {...props as object} />;
  },
}));

jest.mock('../V2SealedSaveScreen', () => ({
  V2SealedSaveScreen: ({ onContinue }: { onContinue: (kind: 'guest') => void }) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable testID="mock-save-continue" onPress={() => onContinue('guest')}><Text>Mock save continue</Text></Pressable>;
  },
}));

import { V2FirstRunFlow } from '../V2FirstRunFlow';

beforeEach(() => {
  OnboardingAnalytics.reset();
  (AnalyticsService.track as jest.Mock).mockClear();
  mockUser = null;
});

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
    mockUser = null;
  });

  it('tracks a fresh start and first welcome view once', () => {
    render(<V2FirstRunFlow />);
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_started', expect.objectContaining({ resumed: false, restored_step: 'welcome' }));
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_step_viewed', expect.objectContaining({ step: 'welcome', step_index: 1 }));
    expect((AnalyticsService.track as jest.Mock).mock.calls.filter(([event]) => event === 'onboarding_started')).toHaveLength(1);
  });

  it('tracks a restored creation step as a resumed session', () => {
    draft.currentStep = 'creation';
    render(<V2FirstRunFlow />);
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_started', expect.objectContaining({ resumed: true, restored_step: 'creation' }));
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_step_viewed', expect.objectContaining({ step: 'creation', step_index: 4 }));
  });

  it('tracks both bypass branches before resetting navigation', () => {
    mockUser = { id: 'returning', hasCompletedOnboarding: true };
    const first = render(<V2FirstRunFlow />);
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_bypassed', { flow_session_id: expect.any(String), reason: 'returning_user' });
    expect((AnalyticsService.track as jest.Mock).mock.calls.map(([event]) => event))
      .not.toEqual(expect.arrayContaining(['onboarding_started', 'onboarding_step_viewed']));
    first.unmount();
    OnboardingAnalytics.reset();
    (AnalyticsService.track as jest.Mock).mockClear();
    mockUser = null;
    draft.currentStep = 'complete';
    render(<V2FirstRunFlow />);
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_bypassed', { flow_session_id: expect.any(String), reason: 'already_complete' });
    expect((AnalyticsService.track as jest.Mock).mock.calls.map(([event]) => event))
      .not.toEqual(expect.arrayContaining(['onboarding_started', 'onboarding_step_viewed']));
  });

  it('purges unconfirmed local drafts when a returning locked free user bypasses onboarding', () => {
    const unconfirmedAnchor = { id: 'local-temp-draft' };
    const confirmedAnchor = { id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d' };
    mockAnchorsStoreState.anchors = [unconfirmedAnchor, confirmedAnchor];

    mockUser = { id: 'returning-locked', hasCompletedOnboarding: true, totalAnchorsCreated: 1, freeAnchorConsumed: true } as any;
    render(<V2FirstRunFlow />);

    expect(mockRemoveAnchor).toHaveBeenCalledWith('local-temp-draft');
    expect(mockRemoveAnchor).not.toHaveBeenCalledWith('a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d');
  });

  it('keeps earlier welcome analytics without duplicating them after sign in and bypass', () => {
    const view = render(<V2FirstRunFlow />);
    expect((AnalyticsService.track as jest.Mock).mock.calls.map(([event]) => event)
      .filter((event) => event === 'onboarding_started')).toHaveLength(1);
    expect((AnalyticsService.track as jest.Mock).mock.calls.map(([event]) => event)
      .filter((event) => event === 'onboarding_step_viewed')).toHaveLength(1);

    mockUser = { id: 'returning', hasCompletedOnboarding: true };
    view.rerender(<V2FirstRunFlow />);
    const events = (AnalyticsService.track as jest.Mock).mock.calls.map(([event]) => event);
    expect(events.filter((event) => event === 'onboarding_started')).toHaveLength(1);
    expect(events.filter((event) => event === 'onboarding_step_viewed')).toHaveLength(1);
    expect(events).toContain('onboarding_bypassed');
  });

  it('records guest completion before clearing the first-run draft', () => {
    draft.currentStep = 'auth';
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('mock-save-continue'));
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_completed', expect.objectContaining({ path: 'guest', session_ms: expect.any(Number) }));
  });

  it('records one background event for the current step visit', () => {
    draft.currentStep = 'motivation';
    let listener: ((state: string) => void) | undefined;
    const addListener = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, callback: (state: string) => void) => {
      listener = callback;
      return { remove: jest.fn() } as any;
    }) as any);
    render(<V2FirstRunFlow />);
    act(() => { listener?.('background'); listener?.('background'); });
    expect((AnalyticsService.track as jest.Mock).mock.calls.filter(([event]) => event === 'onboarding_backgrounded')).toHaveLength(1);
    addListener.mockRestore();
  });

  it('offers a secondary Sign In affordance on the entry surface without a full ritual replay', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('opens the unified V2 auth route for a returning user', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Auth', { initialMode: 'signin' });
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_cta_tapped', expect.objectContaining({ step: 'welcome', cta: 'sign_in' }));
  });

  it('explains what Anchor does on Screen 2 before personalization begins', async () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByText('Get started'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(mockSetStep).toHaveBeenCalledWith('bridge');
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_cta_tapped', expect.objectContaining({ step: 'welcome', cta: 'start' }));
    view.rerender(<V2FirstRunFlow />);

    expect(screen.getByTestId('v2-onboarding-bridge')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('02', { includeHiddenElements: true })).toBeNull();
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
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText(/What matters most\s+to you right now\?/)).toBeTruthy();
  }, 25000);
});

describe('V2FirstRunFlow Screen 3 — the one question', () => {
  beforeEach(() => {
    draft.currentStep = 'motivation';
    delete draft.focusCategory;
    mockSetStep.mockClear();
    mockSetFocusCategory.mockClear();
  });

  it('shows six areas, none chosen, and no Continue: choosing is the whole interaction', () => {
    render(<V2FirstRunFlow />);
    expect(screen.getByText(/What matters most/)).toBeTruthy();
    for (const id of ['health', 'career', 'relationships', 'money', 'family', 'something_else']) {
      expect(screen.getByTestId(`focus-card-${id}`).props.accessibilityState).toMatchObject({ selected: false });
    }
    for (const label of ['Health', 'Career', 'Relationships', 'Money', 'Family', 'Something else']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByTestId('focus-continue')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    // Nothing else is asked: no benefit, why or obstacle question exists to reach.
    expect(screen.queryByText(/what would changing this give you/i)).toBeNull();
  });

  it.each([
    ['health', 'health'],
    ['career', 'career'],
    ['relationships', 'relationships'],
    ['money', 'abundance'],
    ['family', 'family'],
    ['something_else', 'custom'],
  ])('tapping %s sets the Anchor category to %s', (card, category) => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId(`focus-card-${card}`));
    expect(mockSetFocusCategory).toHaveBeenCalledTimes(1);
    expect(mockSetFocusCategory).toHaveBeenLastCalledWith(category);
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_category_selected', expect.objectContaining({ category }));
  });

  it('answers once, holds a line, and opens creation without any further screen', async () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('focus-card-health'));
    // A second tap during the handoff changes nothing.
    fireEvent.press(screen.getByTestId('focus-card-career'));
    expect(mockSetFocusCategory).toHaveBeenCalledTimes(1);
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByText('Health. Good — let’s give it a shape.', { includeHiddenElements: true })).toBeTruthy();
    // Creation opens only once every layer of the question has faded.
    expect(mockSetStep).not.toHaveBeenCalledWith('creation');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });
    expect(mockSetStep).toHaveBeenCalledTimes(1);
    expect(mockSetStep).toHaveBeenLastCalledWith('creation');
  });

  it('names "Something else" as "Yours" in the line', () => {
    const view = render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('focus-card-something_else'));
    view.rerender(<V2FirstRunFlow />);
    expect(screen.getByText('Yours. Good — let’s give it a shape.', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(/Something else\. Good/, { includeHiddenElements: true })).toBeNull();
  });

  it('goes back to the cinema', () => {
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockSetStep).toHaveBeenLastCalledWith('bridge');
  });

  it.each(['outcome', 'meaning', 'friction', 'system', 'handoff'])(
    'resumes a draft saved on the retired %s step at the question',
    (retired) => {
      draft.currentStep = retired;
      render(<V2FirstRunFlow />);
      expect(screen.getByTestId('focus-card-health')).toBeTruthy();
      expect(screen.queryByRole('progressbar')).toBeNull();
    },
  );
});

describe('V2FirstRunFlow resume', () => {
  it('resumes in the cinema, not the splash, after the app is killed mid-onboarding', () => {
    draft.currentStep = 'bridge';
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('v2-onboarding-bridge')).toBeTruthy();
    expect(screen.queryByTestId('v2-onboarding-welcome')).toBeNull();
  });

  it('records a bridge skip with a non-negative animation duration', () => {
    draft.currentStep = 'bridge';
    render(<V2FirstRunFlow />);
    fireEvent.press(screen.getByTestId('v2-onboarding-bridge'));
    expect(AnalyticsService.track).toHaveBeenCalledWith('onboarding_bridge_skipped', expect.objectContaining({ ms_into_animation: expect.any(Number) }));
    const [, properties] = (AnalyticsService.track as jest.Mock).mock.calls.find(([event]) => event === 'onboarding_bridge_skipped')!;
    expect(properties.ms_into_animation).toBeGreaterThanOrEqual(0);
  });
});

describe('V2FirstRunFlow first Anchor', () => {
  beforeEach(() => {
    draft.currentStep = 'creation';
    delete draft.focusCategory;
  });

  it.each(['creation', 'intention', 'formation', 'anchor', 'expression'])(
    'opens the new tactile creation entry for the %s step', (step) => {
      draft.currentStep = step;
      render(<V2FirstRunFlow />);
      expect(screen.getByTestId('tactile-creation-entry').props.fromOnboarding).toBe(true);
      expect(screen.queryByTestId('v2-creation-intention')).toBeNull();
    },
  );

  it.each(['health', 'abundance', 'career', 'relationships', 'family'])(
    'passes the selected %s category to the new creation entry', (category) => {
      draft.focusCategory = category;
      render(<V2FirstRunFlow />);
      expect(screen.getByTestId('tactile-creation-entry').props.chosenCategory).toBe(category);
    },
  );

  it('lets the intention determine the category for Something else', () => {
    draft.focusCategory = 'custom';
    render(<V2FirstRunFlow />);
    expect(screen.getByTestId('tactile-creation-entry').props.chosenCategory).toBeUndefined();
  });

  it('returns to the onboarding question on Back', () => {
    render(<V2FirstRunFlow />);
    act(() => screen.getByTestId('tactile-creation-entry').props.onBack());
    expect(mockSetStep).toHaveBeenLastCalledWith('motivation');
  });
});
