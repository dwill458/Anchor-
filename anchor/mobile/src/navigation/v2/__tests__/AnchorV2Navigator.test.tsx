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

jest.mock('@/components/v2/milestones/MilestoneCelebrationHost', () => ({ MilestoneCelebrationHost: () => null }));
jest.mock('@/screens/v2/home', () => { const { Text: RNText } = require('react-native'); return { V2DevelopmentHome: () => <RNText>home-screen</RNText> }; });
jest.mock('@/screens/v2/system', () => { const { Text: RNText } = require('react-native'); return { V2SystemGallery: () => <RNText>system-gallery</RNText>, V2EvolvingAnchorPrototype: () => <RNText>evolving-anchor</RNText> }; });
jest.mock('@/screens/v2/onboarding', () => { const { Text: RNText } = require('react-native'); return { V2FirstRunFlow: () => <RNText>first-run</RNText> }; });
jest.mock('@/screens/v2/paywall', () => {
  const { Pressable: RNPressable, Text: RNText } = require('react-native');
  return {
    V2PaywallScreen: (props: any) => (
      <RNPressable accessibilityRole="button" onPress={() => props.onEntitled?.({ outcome: 'purchased' })}>
        <RNText>paywall</RNText>
      </RNPressable>
    ),
  };
});
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
const mockStoreAnchors: any[] = [];
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: { getState: () => ({ addAnchor: jest.fn(), getAnchorById: jest.fn(), anchors: mockStoreAnchors }) } }));
const mockHandOffPracticeToHome = jest.fn(() => Promise.resolve('started'));
jest.mock('../practiceHandoff', () => ({ handOffPracticeToHome: (...args: any[]) => (mockHandOffPracticeToHome as any)(...args) }));
const mockHandOffPracticeToInvitation = jest.fn(() => Promise.resolve('started'));
jest.mock('../invitationHandoff', () => ({
  handOffPracticeToInvitation: (...args: any[]) => (mockHandOffPracticeToInvitation as any)(...args),
  leaveInvitationFlowToHome: jest.fn(() => Promise.resolve()),
}));
const mockMarkFirstPractice = jest.fn(() => Promise.resolve());
jest.mock('@/hooks/useNotificationController', () => ({
  ...jest.requireActual('@/hooks/useNotificationController'),
  markFirstPracticeCompletedInStorage: () => mockMarkFirstPractice(),
}));
let mockCelebrationReduceMotion = false;
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({ useCelebrationReduceMotion: () => mockCelebrationReduceMotion }));
/** What the practice screen was told when the last completion came back from the route. */
let mockCompletionReturn: unknown;

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
        <RNText>{`leaveOnSetupBack:${Boolean(props.leaveOnSetupBack)}`}</RNText>
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
          onPress={() => {
            mockCompletionReturn = props.onSessionCompleted?.({
              mode: 'focus',
              durationSeconds: 60,
              saved: true,
              source: 'external',
            });
          }}
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
        <RNPressable accessibilityRole="button" onPress={() => props.onAddNote({ anchorId: props.anchorId, visionId: 'vision-9' })}>
          <RNText>open-note-composer</RNText>
        </RNPressable>
      </RNView>
    ),
  };
});
jest.mock('@/screens/v2/vision/V2VisionNoteComposer', () => {
  const { Text: RNText } = require('react-native');
  return { V2VisionNoteComposer: () => <RNText>vision-note-composer</RNText> };
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
import { offerPracticeDeparture, takePracticeDeparture, type PracticeDeparture } from '@/stores/v2/practiceDeparture';

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

describe('AnchorV2Navigator premium action continuation', () => {
  beforeEach(() => {
    mockSetRoute.mockClear();
  });

  it('resumes Vision creation after entitlement succeeds', () => {
    mockRoute = {
      name: 'V2Paywall',
      params: {
        context: 'VISION_PREMIUM_ACTION',
        resumeIntent: { type: 'vision_premium_action', anchorId: 'anchor-9', action: 'create' },
      },
    };

    render(<AnchorV2Navigator />);
    fireEvent.press(screen.getByText('paywall'));

    expect(mockSetRoute).toHaveBeenCalledWith('V2Vision', {
      anchorId: 'anchor-9',
      initialMode: 'create',
      resumeGeneration: false,
    });
  });

  it('resumes the requested Vision generation after entitlement succeeds', () => {
    mockRoute = {
      name: 'V2Paywall',
      params: {
        context: 'VISION_PREMIUM_ACTION',
        resumeIntent: { type: 'vision_premium_action', anchorId: 'anchor-9', action: 'generate' },
      },
    };

    render(<AnchorV2Navigator />);
    fireEvent.press(screen.getByText('paywall'));

    expect(mockSetRoute).toHaveBeenCalledWith('V2Vision', {
      anchorId: 'anchor-9',
      initialMode: 'create',
      resumeGeneration: true,
    });
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

  it('navigates from Vision into the registered note composer with anchor and Vision context', () => {
    mockRoute = { name: 'V2Vision', params: { anchorId: 'anchor-9' } };
    render(<AnchorV2Navigator />);
    fireEvent.press(screen.getByText('open-note-composer'));
    expect(mockRoute).toEqual({ name: 'V2VisionNoteComposer', params: { anchorId: 'anchor-9', visionId: 'vision-9' } });
    render(<AnchorV2Navigator />);
    expect(screen.getByText('vision-note-composer')).toBeTruthy();
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

  it('opens the Practice Hub with leaveOnSetupBack=false when launched from Anchor Details All practice modes', () => {
    mockRoute = {
      name: 'V2Practice',
      params: { anchorId: 'anchor-1', recommendedMode: undefined, returnRoute: 'V2AnchorDetails', source: 'anchor_details' },
    };
    render(<AnchorV2Navigator />);
    expect(screen.getByText('practice:default')).toBeTruthy();
    expect(screen.getByText('leaveOnSetupBack:false')).toBeTruthy();

    fireEvent.press(screen.getByText('practice-back'));
    expect(mockSetRoute).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'anchor-1' });
  });
});

describe('AnchorV2Navigator Complete to Home', () => {
  const homeRoute = {
    name: 'V2Practice',
    params: { anchorId: 'anchor-1', recommendedMode: 'focus', returnRoute: 'V2DevelopmentHome', source: 'home' },
  };
  const departure = (): PracticeDeparture => ({ sessionId: 'session-1', at: Date.now(), measure: async () => null });

  beforeEach(() => {
    mockSetRoute.mockClear();
    mockHandOffPracticeToHome.mockClear();
    mockCompletionReturn = undefined;
    mockCelebrationReduceMotion = false;
    mockStoreAnchors.length = 0;
    mockStoreAnchors.push({ id: 'anchor-1', category: 'career', baseSigilSvg: '<svg/>' });
    takePracticeDeparture();
  });

  it('hands the Anchor to Home, and tells the practice screen to keep the complete screen up, when the practice came from Home', () => {
    mockRoute = homeRoute;
    render(<AnchorV2Navigator />);
    const offered = departure();
    offerPracticeDeparture(offered);
    fireEvent.press(screen.getByText('practice-complete-external'));

    expect(mockHandOffPracticeToHome).toHaveBeenCalledTimes(1);
    const [, input, options] = (mockHandOffPracticeToHome.mock.calls[0] as unknown) as [unknown, { anchor: { id: string }; departure: PracticeDeparture }, { reduceMotion: boolean }];
    expect(input.anchor.id).toBe('anchor-1');
    expect(input.departure).toBe(offered);
    expect(options).toEqual({ reduceMotion: false });
    expect(mockCompletionReturn).toBe(true);
    // The hand-off changes the route itself, after the complete screen has faded.
    expect(mockSetRoute).not.toHaveBeenCalled();
  });

  it('gives the hand-off the same Reduce Motion source Home reads', () => {
    mockCelebrationReduceMotion = true;
    mockRoute = homeRoute;
    render(<AnchorV2Navigator />);
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect((mockHandOffPracticeToHome.mock.calls[0] as unknown[])[2]).toEqual({ reduceMotion: true });
  });

  it('returns to Home the ordinary way when the complete screen offered nothing', () => {
    mockRoute = homeRoute;
    render(<AnchorV2Navigator />);
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToHome).not.toHaveBeenCalled();
    expect(mockCompletionReturn).toBeUndefined();
    expect(mockSetRoute).toHaveBeenCalledWith('V2DevelopmentHome', undefined);
  });

  it('does not hand off a practice that returns anywhere but Home', () => {
    mockRoute = { name: 'V2Practice', params: { anchorId: 'anchor-1', returnRoute: 'V2Chart', source: 'chart' } };
    render(<AnchorV2Navigator />);
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToHome).not.toHaveBeenCalled();
    expect(mockSetRoute).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1' });
    // And what was offered is not left behind for a later completion.
    expect(takePracticeDeparture()).toBeNull();
  });

  it('does not hand off when the Anchor is not in the store', () => {
    mockStoreAnchors.length = 0;
    mockRoute = homeRoute;
    render(<AnchorV2Navigator />);
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToHome).not.toHaveBeenCalled();
    expect(mockSetRoute).toHaveBeenCalledWith('V2DevelopmentHome', undefined);
  });

  it('keeps the practice hub as a hub: nothing is handed off and the route does not change', () => {
    mockRoute = { name: 'V2Practice', params: { anchorId: 'anchor-1', source: 'practice_hub' } };
    render(<AnchorV2Navigator />);
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-hub'));
    expect(mockHandOffPracticeToHome).not.toHaveBeenCalled();
    expect(mockSetRoute).not.toHaveBeenCalled();
  });
});


describe('AnchorV2Navigator reminder invitation after the first practice', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  const { useReminderInvitationStore } = require('@/stores/v2/reminderInvitationStore');
  const { act } = require('@testing-library/react-native');
  const homeRoute = {
    name: 'V2Practice',
    params: { anchorId: 'anchor-1', recommendedMode: 'focus', returnRoute: 'V2DevelopmentHome', source: 'home' },
  };
  const departure = (): PracticeDeparture => ({ sessionId: 'session-1', at: Date.now(), measure: async () => null });
  const savedState = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({ personalDailyReminderOptedIn: false, firstPracticeCompletedAt: null, reminderInvitationOutcome: null, ...overrides });

  const renderAndLoad = async () => {
    render(<AnchorV2Navigator />);
    // The notification snapshot is read on mount.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  };

  beforeEach(() => {
    mockSetRoute.mockClear();
    mockHandOffPracticeToHome.mockClear();
    mockHandOffPracticeToInvitation.mockClear();
    mockMarkFirstPractice.mockClear();
    mockCompletionReturn = undefined;
    mockCelebrationReduceMotion = false;
    mockStoreAnchors.length = 0;
    mockStoreAnchors.push({ id: 'anchor-1', category: 'career', baseSigilSvg: '<svg/>' });
    takePracticeDeparture();
    useReminderInvitationStore.getState().reset();
    authState.isAuthenticated = true;
    authState.isGuest = false;
    authState.hasCompletedOnboarding = true;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(savedState()));
    mockRoute = homeRoute;
  });
  afterEach(() => {
    delete authState.isAuthenticated;
    delete authState.isGuest;
    authState.hasCompletedOnboarding = true;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(null));
  });

  it('opens the invitation (not Home) with the same Anchor and departure, and records the first practice', async () => {
    await renderAndLoad();
    const offered = departure();
    offerPracticeDeparture(offered);
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToInvitation).toHaveBeenCalledTimes(1);
    const [, input, options] = (mockHandOffPracticeToInvitation.mock.calls[0] as unknown) as [unknown, { anchor: { id: string }; departure: PracticeDeparture }, { reduceMotion: boolean }];
    expect(input.anchor.id).toBe('anchor-1');
    expect(input.departure).toBe(offered);
    expect(options).toEqual({ reduceMotion: false });
    expect(mockHandOffPracticeToHome).not.toHaveBeenCalled();
    expect(mockCompletionReturn).toBe(true);
    expect(mockSetRoute).not.toHaveBeenCalled();
    expect(mockMarkFirstPractice).toHaveBeenCalledTimes(1);
  });

  it('once recorded, a later completion on the same route goes Home as before', async () => {
    // The first hand-off is refused (another is running), so the route falls back Home and stays.
    mockHandOffPracticeToInvitation.mockImplementationOnce(() => Promise.resolve('ignored'));
    await renderAndLoad();
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    mockHandOffPracticeToHome.mockClear();
    offerPracticeDeparture({ ...departure(), sessionId: 'session-2' });
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToInvitation).toHaveBeenCalledTimes(1);
    expect(mockHandOffPracticeToHome).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a guest', () => { authState.isAuthenticated = false; authState.isGuest = true; }],
    ['mid-onboarding', () => { authState.hasCompletedOnboarding = false; }],
    ['already opted in', () => { (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(savedState({ personalDailyReminderOptedIn: true }))); }],
    ['previously dismissed', () => { (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(savedState({ reminderInvitationOutcome: 'dismissed' }))); }],
    ['not the first practice', () => { (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(savedState({ firstPracticeCompletedAt: '2026-10-01T00:00:00.000Z' }))); }],
    ['already shown this launch', () => { useReminderInvitationStore.getState().markShown(); }],
  ])('%s: the Home hand-off is exactly as before', async (_label, arrange) => {
    arrange();
    await renderAndLoad();
    const offered = departure();
    offerPracticeDeparture(offered);
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToInvitation).not.toHaveBeenCalled();
    expect(mockHandOffPracticeToHome).toHaveBeenCalledTimes(1);
    const [, input, options] = (mockHandOffPracticeToHome.mock.calls[0] as unknown) as [unknown, { anchor: { id: string }; departure: PracticeDeparture }, { reduceMotion: boolean }];
    expect(input.departure).toBe(offered);
    expect(options).toEqual({ reduceMotion: false });
    expect(mockCompletionReturn).toBe(true);
    expect(mockSetRoute).not.toHaveBeenCalled();
  });

  it('a practice that returns elsewhere never opens the invitation and leaves eligibility for the next one', async () => {
    mockRoute = { name: 'V2Practice', params: { anchorId: 'anchor-1', returnRoute: 'V2Chart', source: 'chart' } };
    await renderAndLoad();
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToInvitation).not.toHaveBeenCalled();
    expect(mockSetRoute).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1' });
    expect(mockMarkFirstPractice).not.toHaveBeenCalled();
  });

  it('a practice that returns elsewhere for a non-eligible person still records the practice', async () => {
    authState.isAuthenticated = false;
    authState.isGuest = true;
    mockRoute = { name: 'V2Practice', params: { anchorId: 'anchor-1', returnRoute: 'V2Chart', source: 'chart' } };
    await renderAndLoad();
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockMarkFirstPractice).toHaveBeenCalledTimes(1);
  });

  it('a double Continue on the invitation path starts one hand-off and nothing else', async () => {
    await renderAndLoad();
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    mockCompletionReturn = undefined;
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockCompletionReturn).toBe(true);
    expect(mockHandOffPracticeToInvitation).toHaveBeenCalledTimes(1);
    expect(mockHandOffPracticeToHome).not.toHaveBeenCalled();
    expect(mockSetRoute).not.toHaveBeenCalled();
    expect(mockMarkFirstPractice).toHaveBeenCalledTimes(1);
  });

  it('falls back to the Home hand-off when the invitation hand-off is ignored', async () => {
    mockHandOffPracticeToInvitation.mockImplementationOnce(() => Promise.resolve('ignored'));
    await renderAndLoad();
    const offered = departure();
    offerPracticeDeparture(offered);
    fireEvent.press(screen.getByText('practice-complete-external'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(mockHandOffPracticeToHome).toHaveBeenCalledTimes(1);
    expect(((mockHandOffPracticeToHome.mock.calls[0] as unknown) as unknown[])[1]).toMatchObject({ departure: offered });
  });

  it('the practice hub stays a hub', async () => {
    mockRoute = { name: 'V2Practice', params: { anchorId: 'anchor-1', source: 'practice_hub' } };
    await renderAndLoad();
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-hub'));
    expect(mockHandOffPracticeToInvitation).not.toHaveBeenCalled();
    expect(mockHandOffPracticeToHome).not.toHaveBeenCalled();
    expect(mockSetRoute).not.toHaveBeenCalled();
    // Eligible but staying on the hub: the first practice is not consumed.
    expect(mockMarkFirstPractice).not.toHaveBeenCalled();
  });

  it('before the snapshot has loaded nothing is assumed: the ordinary Home hand-off runs', () => {
    render(<AnchorV2Navigator />);
    offerPracticeDeparture(departure());
    fireEvent.press(screen.getByText('practice-complete-external'));
    expect(mockHandOffPracticeToInvitation).not.toHaveBeenCalled();
    expect(mockHandOffPracticeToHome).toHaveBeenCalledTimes(1);
    // Unknown state: nothing is recorded, so eligibility is not lost.
    expect(mockMarkFirstPractice).not.toHaveBeenCalled();
  });
});

describe('AnchorV2Navigator invitation route options', () => {
  const { INVITATION_OPTIONS } = require('../AnchorV2Navigator');
  const optionsFor = (params: Record<string, unknown>) => INVITATION_OPTIONS({ route: { key: 'k', name: 'V2NotificationInvitation', params } });
  it('does not animate the push when the mark flies in, nor under Reduce Motion', () => {
    expect(optionsFor({ anchorId: 'a', anchorTransition: true }).animation).toBe('none');
    expect(optionsFor({ anchorId: 'a', anchorTransition: false, reducedMotion: true }).animation).toBe('none');
  });
  it('fades the push when nothing flies and motion is allowed; never swipe-dismissable', () => {
    const options = optionsFor({ anchorId: 'a', anchorTransition: false });
    expect(options.animation).toBe('fade');
    expect(options.gestureEnabled).toBe(false);
  });
});
