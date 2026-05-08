import type { InitialState } from '@react-navigation/native';

export function shouldShowOnboardingFlow(
  hasCompletedOnboarding: boolean | undefined,
  shouldBypassOnboarding: boolean
): boolean {
  return !hasCompletedOnboarding && !shouldBypassOnboarding;
}

export function buildMainRootNavigationState(): InitialState {
  return {
    index: 0,
    routes: [{ name: 'Main' }],
  };
}

export function buildExpiredTrialPaywallNavigationState(): InitialState {
  return {
    index: 1,
    routes: [{ name: 'Main' }, { name: 'Paywall' }],
  };
}
