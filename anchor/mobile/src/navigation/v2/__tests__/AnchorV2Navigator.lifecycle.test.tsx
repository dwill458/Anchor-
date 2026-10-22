import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// Exercises the REAL onboarding lifecycle resolver inside AnchorV2Navigator —
// including the real, unmocked `shouldShowOnboardingFlow` production helper
// from rootNavigationState.ts. Only screen components are stubbed (matching
// this repo's existing convention in the sibling AnchorV2Navigator.test.tsx),
// so this suite verifies route SELECTION, not screen internals.
// react-navigation's real Navigator understands a <React.Fragment> of
// <Stack.Screen> children (used by the onboarding resolver to switch which
// screens exist), but plain React.Children.toArray does not recurse into
// Fragments — it returns the Fragment as one opaque child. Mirror
// react-navigation's actual flattening so this mock matches production.
function mockFlattenScreens(children: any): any[] {
  const React = require('react');
  const out: any[] = [];
  React.Children.forEach(children, (child: any) => {
    if (!child) return;
    if (child.type === React.Fragment) {
      out.push(...mockFlattenScreens(child.props.children));
    } else {
      out.push(child);
    }
  });
  return out;
}

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    // Mirrors real react-navigation's default behavior: the first
    // <Stack.Screen> in whichever branch is currently rendered is the
    // initial/active route.
    Navigator: ({ children, initialRouteName }: any) => {
      const screens = mockFlattenScreens(children);
      const active: any = screens.find((screen: any) => screen.props?.name === initialRouteName) ?? screens[0];
      const Comp = active?.props?.component;
      return Comp ? require('react').createElement(Comp) : null;
    },
    Screen: () => null,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), replace: jest.fn(), reset: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));

const mockAuthState: any = { hasCompletedOnboarding: false, user: null };
const mockCompleteOnboarding = jest.fn(() => {
  mockAuthState.hasCompletedOnboarding = true;
});
jest.mock('@/stores/authStore', () => {
  const useAuthStore: any = (selector?: (state: any) => any) => (selector ? selector(mockAuthState) : mockAuthState);
  useAuthStore.getState = () => ({ ...mockAuthState, completeOnboarding: mockCompleteOnboarding });
  return { useAuthStore };
});

const mockSettingsState: any = { developerMasterAccountEnabled: false, developerSkipOnboardingEnabled: false };
jest.mock('@/stores/settingsStore', () => {
  const useSettingsStore: any = (selector?: (state: any) => any) => (selector ? selector(mockSettingsState) : mockSettingsState);
  return { useSettingsStore };
});

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ addAnchor: jest.fn(), getAnchorById: jest.fn() }) },
}));

jest.mock('@/screens/v2/home', () => {
  const { Text: RNText } = require('react-native');
  return { V2DevelopmentHome: () => <RNText>home-screen</RNText> };
});
jest.mock('@/screens/v2/onboarding', () => {
  const { Text: RNText, Pressable: RNPressable } = require('react-native');
  const { Fragment, createElement } = require('react');
  return {
    V2FirstRunFlow: () => {
      const { useAuthStore } = require('@/stores/authStore');
      return createElement(
        Fragment,
        null,
        createElement(RNText, null, 'first-run-screen'),
        createElement(
          RNPressable,
          { accessibilityRole: 'button', onPress: () => useAuthStore.getState().completeOnboarding() },
          createElement(RNText, null, 'complete-first-run')
        )
      );
    },
  };
});
jest.mock('@/screens/v2/system', () => { const { Text: RNText } = require('react-native'); return { V2SystemGallery: () => <RNText>system-gallery</RNText>, V2EvolvingAnchorPrototype: () => <RNText>evolving-anchor</RNText> }; });
jest.mock('@/screens/v2/paywall', () => { const { Text: RNText } = require('react-native'); return { V2PaywallScreen: () => <RNText>paywall</RNText> }; });
jest.mock('@/screens/v2/practice', () => { const { Text: RNText } = require('react-native'); return { V2PracticeScreen: () => <RNText>practice</RNText>, V2PracticeSessionScreen: () => <RNText>practice-session</RNText> }; });
jest.mock('@/screens/v2/creation', () => { const { Text: RNText } = require('react-native'); return { V2CreationScreen: () => <RNText>creation</RNText> }; });
jest.mock('@/screens/v2/vision', () => { const { Text: RNText } = require('react-native'); return { V2VisionScreen: () => <RNText>vision</RNText> }; });
jest.mock('@/screens/v2/chart', () => { const { Text: RNText } = require('react-native'); return { V2ChartScreen: () => <RNText>chart</RNText> }; });
jest.mock('@/screens/v2/progress', () => { const { Text: RNText } = require('react-native'); return { V2ProgressScreen: () => <RNText>progress</RNText> }; });
jest.mock('@/screens/v2/anchors', () => { const { Text: RNText } = require('react-native'); return { V2AnchorLibraryScreen: () => <RNText>library</RNText>, V2AnchorDetailsScreen: () => <RNText>details</RNText> }; });
jest.mock('@/screens/v2/release', () => { const { Text: RNText } = require('react-native'); return { V2ReleaseScreen: () => <RNText>release</RNText> }; });
jest.mock('@/screens/v2/weeklyInsight', () => { const { Text: RNText } = require('react-native'); return { V2WeeklyInsightScreen: () => <RNText>weekly-insight</RNText> }; });

import { AnchorV2Navigator } from '../AnchorV2Navigator';

describe('AnchorV2Navigator onboarding lifecycle resolver', () => {
  beforeEach(() => {
    mockAuthState.hasCompletedOnboarding = false;
    mockAuthState.user = null;
    mockSettingsState.developerMasterAccountEnabled = false;
    mockSettingsState.developerSkipOnboardingEnabled = false;
    mockCompleteOnboarding.mockClear();
  });

  it('sends a fresh user (onboarding incomplete) into V2FirstRun', () => {
    mockAuthState.hasCompletedOnboarding = false;
    render(<AnchorV2Navigator />);
    expect(screen.getByText('first-run-screen')).toBeTruthy();
    expect(screen.queryByText('home-screen')).toBeNull();
  });

  it('sends an existing user (onboarding complete) straight to V2Home', () => {
    mockAuthState.hasCompletedOnboarding = true;
    mockAuthState.user = { id: 'existing-user' };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('home-screen')).toBeTruthy();
    expect(screen.queryByText('first-run-screen')).toBeNull();
  });

  it('never resolves to Home before authoritative onboarding state is known — defaults to first-run', () => {
    // Pre-hydration/pre-restore, hasCompletedOnboarding carries its store
    // default (false). The resolver must fail toward first-run, never Home,
    // for any not-yet-known value. App.tsx additionally withholds mounting
    // this navigator at all until auth restoration settles (useAppStartup's
    // authRestorationSettled), so this default is never actually rendered
    // to a real user mid-hydration — this test pins the resolver's own
    // fail-safe direction independent of that outer gate.
    mockAuthState.hasCompletedOnboarding = false;
    render(<AnchorV2Navigator />);
    expect(screen.getByText('first-run-screen')).toBeTruthy();
  });

  it('switches to Home once first-run completion persists canonical onboarding state', () => {
    mockAuthState.hasCompletedOnboarding = false;
    render(<AnchorV2Navigator />);
    expect(screen.getByText('first-run-screen')).toBeTruthy();

    fireEvent.press(screen.getByText('complete-first-run'));
    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(mockAuthState.hasCompletedOnboarding).toBe(true);
    mockAuthState.user = { id: 'newly-authenticated-user' };

    screen.rerender(<AnchorV2Navigator />);
    expect(screen.getByText('home-screen')).toBeTruthy();
    expect(screen.queryByText('first-run-screen')).toBeNull();
  });

  it('restarts a completed account directly at Home on relaunch (a fresh navigator mount)', () => {
    mockAuthState.hasCompletedOnboarding = true;
    mockAuthState.user = { id: 'existing-user' };
    const { unmount } = render(<AnchorV2Navigator />);
    expect(screen.getByText('home-screen')).toBeTruthy();
    unmount();

    render(<AnchorV2Navigator />);
    expect(screen.getByText('home-screen')).toBeTruthy();
  });

  it('re-evaluates to first-run after sign-out clears canonical onboarding state (production parity: authStore.signOut() resets hasCompletedOnboarding)', () => {
    mockAuthState.hasCompletedOnboarding = true;
    mockAuthState.user = { id: 'existing-user' };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('home-screen')).toBeTruthy();

    mockAuthState.hasCompletedOnboarding = false;
    mockAuthState.user = null;
    screen.rerender(<AnchorV2Navigator />);
    expect(screen.getByText('first-run-screen')).toBeTruthy();
  });

  it('a developer onboarding bypass reaches Home without completed onboarding, matching RootNavigator', () => {
    mockAuthState.hasCompletedOnboarding = false;
    mockSettingsState.developerSkipOnboardingEnabled = true;
    render(<AnchorV2Navigator />);
    expect(screen.getByText('home-screen')).toBeTruthy();
  });
});
