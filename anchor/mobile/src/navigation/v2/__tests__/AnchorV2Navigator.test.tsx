import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// This suite drives AnchorV2Navigator's route-wrapper wiring directly (which
// route a callback navigates to, with what params) without depending on the
// real react-navigation runtime, matching this repo's convention elsewhere of
// mocking @react-navigation/native rather than rendering a live
// NavigationContainer + native-stack tree in Jest.
let mockRoute: { name: string; params?: any } = { name: 'V2DevelopmentHome' };
const mockSetRoute = jest.fn((name: string, params?: any) => {
  mockRoute = { name, params };
});

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
    Navigator: ({ children }: any) => {
      const { Fragment } = require('react');
      const screens = mockFlattenScreens(children);
      const active: any = screens.find((s: any) => s.props.name === mockRoute.name);
      const Comp = active?.props.component;
      return Comp ? require('react').createElement(Fragment, null, require('react').createElement(Comp)) : null;
    },
    Screen: () => null,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: (name: string, params?: any) => mockSetRoute(name, params),
    replace: (name: string, params?: any) => mockSetRoute(name, params),
    reset: (state: any) => mockSetRoute(state.routes[0].name, state.routes[0].params),
    goBack: jest.fn(),
    canGoBack: () => false,
  }),
  useRoute: () => mockRoute,
}));

jest.mock('@/screens/v2/home', () => { const { Text: RNText } = require('react-native'); return { V2DevelopmentHome: () => <RNText>home-screen</RNText> }; });
jest.mock('@/screens/v2/system', () => { const { Text: RNText } = require('react-native'); return { V2SystemGallery: () => <RNText>system-gallery</RNText>, V2EvolvingAnchorPrototype: () => <RNText>evolving-anchor</RNText> }; });
jest.mock('@/screens/v2/onboarding', () => { const { Text: RNText } = require('react-native'); return { V2FirstRunFlow: () => <RNText>first-run</RNText> }; });
jest.mock('@/screens/v2/paywall', () => { const { Text: RNText } = require('react-native'); return { V2PaywallScreen: () => <RNText>paywall</RNText> }; });
jest.mock('@/screens/v2/progress', () => {
  const { View: RNView, Pressable: RNPressable, Text: RNText } = require('react-native');
  return {
    V2ProgressScreen: (props: any) => (
      <RNView>
        <RNText>{`progress-for:${props.anchorId}`}</RNText>
        <RNPressable accessibilityRole="button" onPress={props.onBack}><RNText>progress-back</RNText></RNPressable>
        <RNPressable accessibilityRole="button" onPress={() => props.onNavigateToChart(props.anchorId)}><RNText>progress-chart</RNText></RNPressable>
        <RNPressable accessibilityRole="button" onPress={() => props.onNavigateToWeeklyInsight(props.anchorId)}><RNText>progress-weekly</RNText></RNPressable>
      </RNView>
    ),
  };
});
jest.mock('@/screens/v2/anchors', () => { const { Text: RNText } = require('react-native'); return { V2AnchorLibraryScreen: () => <RNText>library</RNText>, V2AnchorDetailsScreen: () => <RNText>details</RNText> }; });
jest.mock('@/screens/v2/release', () => { const { Text: RNText } = require('react-native'); return { V2ReleaseScreen: () => <RNText>release</RNText> }; });
jest.mock('@/screens/v2/weeklyInsight', () => { const { Text: RNText } = require('react-native'); return { V2WeeklyInsightScreen: () => <RNText>weekly-insight</RNText> }; });
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: { getState: () => ({ addAnchor: jest.fn(), getAnchorById: jest.fn() }) } }));

// Onboarding is complete for this suite, which exercises post-onboarding
// (Vision <-> Chart) wiring — the resolver is covered separately in
// AnchorV2Navigator.lifecycle.test.tsx. useAuthStore/useSettingsStore are
// used both as hooks (by the resolver) and via .getState() (by route
// wrappers), so the mock must support both call shapes.
const authState: any = { user: { id: 'u1' }, hasCompletedOnboarding: true };
jest.mock('@/stores/authStore', () => {
  const useAuthStore: any = (selector?: (state: any) => any) => (selector ? selector(authState) : authState);
  useAuthStore.getState = () => authState;
  return { useAuthStore };
});

const settingsState: any = { developerMasterAccountEnabled: false, developerSkipOnboardingEnabled: false };
jest.mock('@/stores/settingsStore', () => {
  const useSettingsStore: any = (selector?: (state: any) => any) => (selector ? selector(settingsState) : settingsState);
  return { useSettingsStore };
});

jest.mock('@/screens/v2/practice', () => {
  const { View: RNView, Text: RNText, Pressable: RNPressable } = require('react-native');
  return {
    V2PracticeScreen: (props: any) => (
      <RNView>
        <RNText>{`practice:${props.initialMode ?? 'default'}`}</RNText>
        <RNPressable accessibilityRole="button" onPress={props.onBack}>
          <RNText>practice-back</RNText>
        </RNPressable>
        <RNPressable
          accessibilityRole="button"
          onPress={() =>
            props.onSessionCompleted?.({
              mode: 'focus',
              durationSeconds: 60,
              saved: true,
              source: 'practice_hub',
            })
          }
        >
          <RNText>practice-complete-hub</RNText>
        </RNPressable>
        <RNPressable
          accessibilityRole="button"
          onPress={() =>
            props.onSessionCompleted?.({
              mode: 'focus',
              durationSeconds: 60,
              saved: true,
              source: 'external',
            })
          }
        >
          <RNText>practice-complete-external</RNText>
        </RNPressable>
      </RNView>
    ),
    V2PracticeSessionScreen: () => <RNText>practice-session</RNText>,
  };
});

jest.mock('@/screens/v2/creation', () => {
  const { Pressable: RNPressable, Text: RNText } = require('react-native');
  return {
    V2CreationScreen: (props: any) => (
      <RNPressable
        accessibilityRole="button"
        onPress={() => props.onPaywall()}
      >
        <RNText>creation-refused-second-anchor</RNText>
      </RNPressable>
    ),
  };
});

jest.mock('@/screens/v2/vision', () => {
  const { View: RNView, Pressable: RNPressable, Text: RNText } = require('react-native');
  return {
    V2VisionScreen: (props: any) => (
      <RNView>
        <RNText>{`vision-for:${props.anchorId}`}</RNText>
        <RNPressable accessibilityRole="button" onPress={() => props.onChart(props.anchorId)}>
          <RNText>open-chart</RNText>
        </RNPressable>
        <RNPressable accessibilityRole="button" onPress={() => props.onVisualize({ visionId: 'v1', activeVisionAsset: null, seenToday: false, hasVision: true })}>
          <RNText>{props.onVisualize ? 'external-visualize' : 'local-prepared-visualize'}</RNText>
        </RNPressable>
      </RNView>
    ),
  };
});

jest.mock('@/screens/v2/chart', () => {
  const { Text: RNText } = require('react-native');
  const { useRoute } = require('@react-navigation/native');
  return {
    V2ChartScreen: (props: any) => {
      const route: any = useRoute();
      const anchorId = props.anchorId ?? route.params?.anchorId;
      return <RNText>{`chart-for:${anchorId}`}</RNText>;
    },
  };
});

import { AnchorV2Navigator } from '../AnchorV2Navigator';

describe('AnchorV2Navigator Progress wiring', () => {
  beforeEach(() => {
    mockSetRoute.mockClear();
  });

  it('gives Progress its Anchor from the route params', () => {
    mockRoute = { name: 'V2Progress', params: { anchorId: 'anchor-4' } };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('progress-for:anchor-4')).toBeTruthy();
  });

  it('opens Weekly Insight and the Chart for the same Anchor', () => {
    mockRoute = { name: 'V2Progress', params: { anchorId: 'anchor-4' } };
    render(<AnchorV2Navigator />);
    fireEvent.press(screen.getByText('progress-weekly'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2WeeklyInsight', { anchorId: 'anchor-4' });

    mockRoute = { name: 'V2Progress', params: { anchorId: 'anchor-4' } };
    screen.rerender(<AnchorV2Navigator />);
    fireEvent.press(screen.getByText('progress-chart'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-4' });
  });

  it('falls back to Home on back when nothing is behind Progress', () => {
    mockRoute = { name: 'V2Progress', params: { anchorId: 'anchor-4' } };
    render(<AnchorV2Navigator />);
    fireEvent.press(screen.getByText('progress-back'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2DevelopmentHome', undefined);
  });
});

describe('AnchorV2Navigator Vision <-> Chart wiring', () => {
  beforeEach(() => {
    mockSetRoute.mockClear();
  });

  it('wires Vision’s "Open on your Chart" CTA to real Chart navigation (fixes the vision_and_chart dead end)', () => {
    mockRoute = { name: 'V2Vision', params: { anchorId: 'anchor-9' } };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('vision-for:anchor-9')).toBeTruthy();

    fireEvent.press(screen.getByText('open-chart'));
    screen.rerender(<AnchorV2Navigator />);
    expect(screen.getByText('chart-for:anchor-9')).toBeTruthy();
  });

  it('lets Vision own its prepared Visualize handoff without a Practice setup redirect', () => {
    mockRoute = { name: 'V2Vision', params: { anchorId: 'anchor-9' } };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('local-prepared-visualize')).toBeTruthy();
    expect(mockSetRoute).not.toHaveBeenCalled();
  });

  it('sends a refused second Anchor to the SECOND_ANCHOR paywall, resuming creation after', () => {
    mockRoute = { name: 'V2Creation' };
    render(<AnchorV2Navigator />);

    fireEvent.press(screen.getByText('creation-refused-second-anchor'));
    expect(mockRoute).toEqual({ name: 'V2Paywall', params: { context: 'SECOND_ANCHOR', resumeIntent: { type: 'create_anchor' } } });
  });
});

describe('AnchorV2Navigator Practice launch source and return on session complete', () => {
  beforeEach(() => {
    mockSetRoute.mockClear();
  });

  it('returns to Vision when practice launched from Vision ends', () => {
    mockRoute = {
      name: 'V2Practice',
      params: { anchorId: 'anchor-1', resumeMode: 'visualize', returnRoute: 'V2Vision', source: 'vision' },
    };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('practice:default')).toBeTruthy();

    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2Vision', { anchorId: 'anchor-1' });
  });

  it('returns to Chart when practice launched from Chart ends', () => {
    mockRoute = {
      name: 'V2Practice',
      params: { anchorId: 'anchor-1', recommendedMode: 'focus', returnRoute: 'V2Chart', source: 'chart' },
    };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('practice:focus')).toBeTruthy();

    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1' });
  });

  it('returns to Home when practice launched from Home ends', () => {
    mockRoute = {
      name: 'V2Practice',
      params: { anchorId: 'anchor-1', recommendedMode: 'focus', returnRoute: 'V2DevelopmentHome', source: 'home' },
    };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('practice:focus')).toBeTruthy();

    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2DevelopmentHome', undefined);
  });

  it('stays on Practice screen when practice launched from the practice screen ends', () => {
    mockRoute = {
      name: 'V2Practice',
      params: { anchorId: 'anchor-1', source: 'practice_hub' },
    };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('practice:default')).toBeTruthy();

    fireEvent.press(screen.getByText('practice-complete-hub'));
    expect(mockSetRoute).not.toHaveBeenCalled();
  });

  it('infers return destination from source parameter when returnRoute is omitted', () => {
    mockRoute = {
      name: 'V2Practice',
      params: { anchorId: 'anchor-1', source: 'chart' },
    };
    render(<AnchorV2Navigator />);

    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1' });
  });
});

