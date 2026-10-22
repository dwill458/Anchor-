import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockPopToTop = jest.fn();
let mockNavState: { index: number; routes: Array<{ name: string }> } | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    popToTop: mockPopToTop,
    getState: () => mockNavState,
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: {}, name: 'V2Home', key: 'k' }),
}));

jest.mock('@/adapters/v2/home', () => ({
  ...jest.requireActual('@/adapters/v2/home'),
  useV2HomeModel: jest.fn(),
}));

jest.mock('@/hooks/useChartPreview', () => ({
  ...jest.requireActual('@/hooks/useChartPreview'),
  useChartPreview: jest.fn(),
}));

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));

import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { V2HomeScreen, resetHomeArrivalSoundClaimForTests } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation, useV2HomeModel } from '@/adapters/v2/home';
import { useChartPreview, selectChartPreview } from '@/hooks/useChartPreview';
import { homeArrivalCelebrationId, resetPlayedPracticeArrivalsForTests } from '@/components/v2/home/homeArrival';
import { useHomeArrivalStore, type HomeArrivalKind } from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';

const mockUseV2HomeModel = useV2HomeModel as jest.Mock;
const mockUseChartPreview = useChartPreview as jest.Mock;
const refreshToday = jest.fn();

const READY_TODAY = (mode: 'focus' | 'visualize') => ({
  state: 'ready' as const,
  mode,
  action: mode === 'focus' ? 'Focus' : 'Visualize',
  reason: 'daily_focus',
  completionSignal: null,
  threadStrength: null,
  threadDelta: null,
  threadDeltaStatus: 'UNAVAILABLE' as const,
  durationSeconds: 30,
});

const renderHome = (recommended: 'focus' | 'visualize' = 'focus') => {
  const anchors = useAnchorStore.getState().anchors.filter((anchor) => anchor.userId === 'user-1');
  const selectedAnchor = anchors[0] ?? null;
  const anchorList = anchors.map((anchor) => ({ anchor, thread: toThreadPresentation(anchor), isSelected: true }));
  mockUseV2HomeModel.mockReturnValue({
    greeting: 'Good morning',
    profileInitial: 'D',
    anchorState: 'ready',
    anchorError: null,
    hasAnchors: true,
    selectedAnchor,
    thread: selectedAnchor ? toThreadPresentation(selectedAnchor) : null,
    anchorList,
    selectedIndex: 0,
    selectAnchor: jest.fn(),
    vision: {
      state: 'ready',
      visionId: 'v1',
      previewText: 'A bright open studio at dawn',
      title: 'Studio at dawn',
      tiles: [{ id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/vision.png', prompt: null, sortOrder: 0, isHero: true }],
      featuredTileId: 't1',
      seenToday: false,
    },
    chart: { state: 'none' },
    progress: { state: 'empty' },
    today: READY_TODAY(recommended),
    refreshVision: jest.fn(),
    refreshToday,
    refreshChart: jest.fn(),
    refreshAnchors: jest.fn(),
  });
  return render(
    <V2DailyShellIntentsProvider intents={{}}>
      <V2HomeScreen />
    </V2DailyShellIntentsProvider>,
  );
};

const FROM = { x: 40, y: 200, width: 130, height: 130 };
const TARGET = { x: 140, y: 180, width: 110, height: 110 };

/** A practice arrival already released for Home, as the hand-off leaves it. */
const practiceArriving = (kind: HomeArrivalKind = 'practice', sessionId: string | null = 's1') =>
  useHomeArrivalStore.setState({
    arrival: {
      id: 9,
      anchorId: 'a',
      kind,
      svg: '<svg/>',
      category: 'desire',
      fromRect: FROM,
      targetRect: TARGET,
      sessionId,
      phase: 'arriving',
    },
  });

const completeFocusToday = () =>
  useSessionStore.setState({
    practiceHistory: [{
      id: 's1',
      practiceMode: 'focus',
      completionStatus: 'completed',
      completedAt: new Date().toISOString(),
      completedDurationSeconds: 30,
      accountId: 'user-1',
      anchorId: 'a',
    }] as never,
  });

beforeEach(() => {
  resetHomeArrivalSoundClaimForTests();
  resetPlayedPracticeArrivalsForTests();
  (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockNavigate.mockClear();
  mockPopToTop.mockClear();
  refreshToday.mockClear();
  mockNavState = undefined;
  useSettingsStore.setState({ reduceMotion: 'off' });
  useAnchorStore.setState({
    anchors: [makeAnchor({ id: 'a', localId: 'a', intentionText: 'I finish what matters', category: 'desire', threadStrength: 52 })],
    currentAnchorId: 'a',
  });
  useAuthStore.setState({ user: { id: 'user-1', email: 'e', displayName: 'D' } as never, hasCompletedOnboarding: false });
  useCourseStore.setState({ activeCourse: null });
  useSessionStore.setState({ practiceHistory: [] });
  mockUseChartPreview.mockReturnValue(selectChartPreview(null));
  useHomeArrivalStore.setState({ arrival: null });
  useCelebrationStore.getState().reset();
});
afterEach(() => {
  act(() => {
    useHomeArrivalStore.setState({ arrival: null });
    useCelebrationStore.getState().reset();
  });
});

describe('Home: Complete to Home arrival', () => {
  it('swaps the Today card only when this completion changed the recommendation', () => {
    completeFocusToday();
    practiceArriving();
    renderHome('focus');
    // Home recommended Focus before; the card now points at Visualize.
    expect(screen.getByTestId('v2-home-today-swap-from')).toBeTruthy();
    expect(screen.getAllByTestId('v2-home-today')).toHaveLength(1);
  });

  it('does not swap when the recommendation did not change', () => {
    completeFocusToday();
    practiceArriving();
    renderHome('visualize');
    expect(screen.queryByTestId('v2-home-today-swap-from')).toBeNull();
    expect(screen.getByTestId('v2-home-today')).toBeTruthy();
  });

  it('does not swap when the completed session is not one of today\'s for this Anchor', () => {
    completeFocusToday();
    practiceArriving('practice', 'not-a-session');
    renderHome('focus');
    expect(screen.queryByTestId('v2-home-today-swap-from')).toBeNull();
  });

  it('does not swap under Reduce Motion, where the arrival is a short crossfade', () => {
    useSettingsStore.setState({ reduceMotion: 'on' });
    completeFocusToday();
    practiceArriving();
    renderHome('focus');
    expect(screen.queryByTestId('v2-home-today-swap-from')).toBeNull();
  });

  it('never swaps for a created Anchor\'s arrival', () => {
    completeFocusToday();
    practiceArriving('repeat');
    renderHome('focus');
    expect(screen.queryByTestId('v2-home-today-swap-from')).toBeNull();
  });

  it('puts the old card away once the arrival ends, leaving the one new card in place', () => {
    completeFocusToday();
    practiceArriving();
    renderHome('focus');
    expect(screen.getByTestId('v2-home-today-swap-from')).toBeTruthy();
    act(() => { useHomeArrivalStore.getState().clear(9); });
    expect(screen.queryByTestId('v2-home-today-swap-from')).toBeNull();
    expect(screen.getAllByTestId('v2-home-today')).toHaveLength(1);
  });

  it('registers one non-skippable level 2 scene and offers no skip layer', () => {
    completeFocusToday();
    practiceArriving();
    renderHome('focus');
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(9), level: 2, skippable: false });
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
  });

  it('fetches Today while it is still hidden, once per arrival', () => {
    completeFocusToday();
    practiceArriving();
    const view = renderHome('focus');
    expect(refreshToday).toHaveBeenCalledTimes(1);
    view.rerender(
      <V2DailyShellIntentsProvider intents={{}}>
        <V2HomeScreen />
      </V2DailyShellIntentsProvider>,
    );
    expect(refreshToday).toHaveBeenCalledTimes(1);
  });

  it('leaves the practice route in place while posing, so the complete screen is not torn down', () => {
    mockNavState = { index: 1, routes: [{ name: 'V2DevelopmentHome' }, { name: 'V2Practice' }] };
    useHomeArrivalStore.setState({
      arrival: { id: 9, anchorId: 'a', kind: 'practice', svg: '<svg/>', fromRect: FROM, targetRect: null, phase: 'staging' },
    });
    renderHome('focus');
    expect(mockPopToTop).not.toHaveBeenCalled();
  });

  it.each(['V2NotificationInvitation', 'V2ReminderTime'])('leaves the reminder invitation (%s) in place while posing, so it can hand the Anchor over', (top) => {
    mockNavState = { index: 2, routes: [{ name: 'V2DevelopmentHome' }, { name: 'V2Practice' }, { name: top }] };
    useHomeArrivalStore.setState({
      arrival: { id: 11, anchorId: 'a', kind: 'practice', svg: '<svg/>', fromRect: FROM, targetRect: null, phase: 'staging' },
    });
    renderHome('focus');
    expect(mockPopToTop).not.toHaveBeenCalled();
  });

  it('still pops a pushed Details screen when an arrival poses', () => {
    mockNavState = { index: 1, routes: [{ name: 'V2DevelopmentHome' }, { name: 'V2AnchorDetails' }] };
    useHomeArrivalStore.setState({
      arrival: { id: 10, anchorId: 'a', kind: 'repeat', svg: '<svg/>', fromRect: FROM, targetRect: null, phase: 'staging' },
    });
    renderHome('focus');
    expect(mockPopToTop).toHaveBeenCalledTimes(1);
  });
});
