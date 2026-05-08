import {
  buildExpiredTrialPaywallNavigationState,
  buildMainRootNavigationState,
  shouldShowOnboardingFlow,
} from '../rootNavigationState';

describe('rootNavigationState', () => {
  it('shows onboarding only when the user has not completed it and bypass is disabled', () => {
    expect(shouldShowOnboardingFlow(false, false)).toBe(true);
    expect(shouldShowOnboardingFlow(undefined, false)).toBe(true);
    expect(shouldShowOnboardingFlow(true, false)).toBe(false);
    expect(shouldShowOnboardingFlow(false, true)).toBe(false);
  });

  it('builds the main root state', () => {
    expect(buildMainRootNavigationState()).toEqual({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  });

  it('stacks paywall on top of main for expired-trial sessions', () => {
    expect(buildExpiredTrialPaywallNavigationState()).toEqual({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'Paywall' }],
    });
  });
});
