
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, fireEvent, screen, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
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

import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { V2HomeScreen } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation, useV2HomeModel } from '@/adapters/v2/home';
import { useChartPreview, selectChartPreview } from '@/hooks/useChartPreview';
import { chartPreviewCourses } from '@/components/chart/__fixtures__/chartPreviewStates';
import { playCreationSound } from '@/services/CreationSounds';
import { HOME_ARRIVAL_SOUND_PLAYED_KEY, resetHomeArrivalSoundClaimForTests } from '../V2HomeScreen';
import { homeArrivalCelebrationId } from '@/components/v2/home/homeArrival';
import { useHomeArrivalStore } from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));

const mockUseV2HomeModel = useV2HomeModel as jest.Mock;
const mockUseChartPreview = useChartPreview as jest.Mock;

const selectAnchor = jest.fn((anchorId: string) => useAnchorStore.getState().setCurrentAnchor(anchorId));

const readyChart = {
  state: 'ready' as const,
  courseId: 'c1',
  destinationText: 'Reach 1,000 active users',
  nextMove: 'Contact 3 creators',
  reachedCount: 1,
  waypointCount: 2,
  currentWaypointId: 'w2',
  currentWaypointIndex: 1,
  isFinished: false,
  waypoints: [
    { id: 'w1', title: 'Ship beta', state: 'REACHED' as const, reached: true, isCurrent: false, isDestination: false },
    { id: 'w2', title: 'Contact 3 creators', state: 'CURRENT' as const, reached: false, isCurrent: true, isDestination: true },
  ],
};

const readyVision = {
  state: 'ready' as const,
  visionId: 'v1',
  previewText: 'A bright open studio at dawn',
  title: 'Studio at dawn',
  tiles: [{ id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/vision.png', prompt: null, sortOrder: 0, isHero: true }],
  featuredTileId: 't1',
  seenToday: false,
};

const renderHome = (intents = {}, overrides: Record<string, unknown> = {}) => {
  const anchors = useAnchorStore.getState().anchors.filter((anchor) => anchor.userId === 'user-1');
  const currentId = useAnchorStore.getState().currentAnchorId;
  const selectedAnchor = anchors.find((anchor) => anchor.id === currentId) ?? anchors[0] ?? null;
  const anchorList = anchors.map((anchor) => ({
    anchor,
    thread: toThreadPresentation(anchor),
    isSelected: anchor.id === selectedAnchor?.id,
  }));
  mockUseV2HomeModel.mockReturnValue({
    greeting: 'Good morning, Deontrez',
    profileInitial: 'D',
    anchorState: anchors.length > 0 ? 'ready' : 'empty',
    anchorError: null,
    hasAnchors: anchors.length > 0,
    selectedAnchor,
    thread: selectedAnchor ? toThreadPresentation(selectedAnchor) : null,
    anchorList,
    selectedIndex: anchorList.findIndex((item) => item.isSelected),
    selectAnchor,
    vision: { state: 'none' },
    chart: { state: 'none' },
    progress: { state: 'empty' },
    today: {
      state: 'ready',
      mode: 'focus',
      action: 'Focus',
      reason: 'daily_focus',
      completionSignal: null,
      threadStrength: null,
      threadDelta: null,
      threadDeltaStatus: 'UNAVAILABLE',
      durationSeconds: 30,
    },
    refreshVision: jest.fn(),
    refreshToday: jest.fn(),
    refreshChart: jest.fn(),
    refreshAnchors: jest.fn(),
    ...overrides,
  });
  return render(
    <V2DailyShellIntentsProvider intents={intents}>
      <V2HomeScreen />
    </V2DailyShellIntentsProvider>,
  );
};

beforeEach(() => {
  resetHomeArrivalSoundClaimForTests();
  (playCreationSound as jest.Mock).mockClear();
  (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockNavigate.mockClear();
  selectAnchor.mockClear();
  useSettingsStore.setState({ reduceMotion: 'on' });
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
  useAuthStore.setState({ user: { id: 'user-1', email: 'e', displayName: 'Deontrez' } as never, hasCompletedOnboarding: false });
  useCourseStore.setState({ activeCourse: null });
  useSessionStore.setState({ practiceHistory: [] });
  mockUseChartPreview.mockReturnValue(selectChartPreview(null));
});

type ReactTestInstance = ReturnType<typeof screen.getByTestId>;

const oneAnchor = () =>
  useAnchorStore.setState({
    anchors: [makeAnchor({ id: 'a', localId: 'a', intentionText: 'I finish what matters', category: 'desire', threadStrength: 74 })],
    currentAnchorId: 'a',
  });

describe('Home structure', () => {
  it('plays the first post-onboarding Home arrival once ever', async () => {
    const storage = new Map<string, string>();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => storage.get(key) ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => { storage.set(key, value); });
    oneAnchor();
    useAuthStore.setState({ hasCompletedOnboarding: true });
    const first = renderHome();
    await waitFor(() => expect(playCreationSound).toHaveBeenCalledWith('homeArrival'));
    await waitFor(() => expect(storage.get(HOME_ARRIVAL_SOUND_PLAYED_KEY)).toBe('1'));
    first.unmount();

    // Same app session: the module-level claim means a remount never reads storage again.
    renderHome();
    await act(async () => { await Promise.resolve(); });
    expect((AsyncStorage.getItem as jest.Mock).mock.calls.filter(([key]) => key === HOME_ARRIVAL_SOUND_PLAYED_KEY)).toHaveLength(1);
    expect(playCreationSound).toHaveBeenCalledTimes(1);
  });

  it('renders the two-tone hero + splice + graphite system, with no legacy Anchor rail', () => {
    oneAnchor();
    renderHome();
    expect(screen.getByTestId('v2-home-hero')).toBeTruthy();
    // The splice is decorative, so it is intentionally hidden from assistive
    // technology and must be queried explicitly.
    expect(screen.getByTestId('v2-home-splice', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('v2-home-graphite-zone')).toBeTruthy();
    // The "Your Anchors" rail is gone; the hero carousel is the only switcher.
    expect(screen.queryByText('Your Anchors')).toBeNull();
    expect(screen.queryByText('See all')).toBeNull();
  });

  it('uses the photo avatar as the single Profile entry', () => {
    oneAnchor();
    const onOpenProfile = jest.fn();
    renderHome({ onOpenProfile });
    expect(screen.getAllByLabelText('Open profile and settings')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('v2-home-profile-avatar'));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('signs the brand mark into the ink field, detached from the splice and ahead of Today', () => {
    oneAnchor();
    renderHome();
    const splice = screen.getByTestId('v2-home-splice', { includeHiddenElements: true });
    const graphite = screen.getByTestId('v2-home-graphite-zone');
    expect(screen.getByTestId('v2-home-brand-mark', { includeHiddenElements: true })).toBeTruthy();
    // The cream landscape carries nothing at its point.
    expect(splice.findAll((node: ReactTestInstance) => node.props.source != null, { deep: true }).length).toBe(0);
    // The mark opens the ink zone, before Today.
    const order = graphite
      .findAll((node: ReactTestInstance) => typeof node.props.testID === 'string' && node.props.testID.startsWith('v2-home-'), { deep: true })
      .map((node: ReactTestInstance) => node.props.testID as string)
      .filter((id: string, index: number, all: string[]) => all.indexOf(id) === index);
    expect(order.indexOf('v2-home-brand-mark')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('v2-home-brand-mark')).toBeLessThan(order.indexOf('v2-home-today'));
  });

  it('keeps Thread Strength as a compact hero reading, not a giant block', () => {
    oneAnchor();
    renderHome();
    const reading = screen.getByTestId('v2-home-thread-reading');
    expect(reading).toBeTruthy();
    expect(screen.getByText('Thread Strength')).toBeTruthy();
    expect(screen.getAllByText('Thread Strength')).toHaveLength(1);
    expect(screen.getByTestId('v2-home-thread-value').props.children).toBe('74%');
    // The old 53pt numeric block no longer exists on Home.
    expect(screen.queryByTestId('v2-thread-strength-value')).toBeNull();
  });

  it('opens Progress from the hero strength reading', () => {
    const onOpenProgress = jest.fn();
    oneAnchor();
    renderHome({ onOpenProgress });
    fireEvent.press(screen.getByTestId('v2-home-thread'));
    expect(onOpenProgress).toHaveBeenCalledWith('a');
  });

  it('opens Anchor details after the measured artwork copy is mounted', async () => {
    oneAnchor();
    renderHome();
    (screen.getByTestId('v2-home-anchor-disc').parent?.instance.measureInWindow as jest.Mock)
      .mockImplementation((callback) => callback(100, 200, 154, 154));
    fireEvent.press(screen.getByTestId('v2-home-carousel-active'));
    fireEvent.press(screen.getByTestId('v2-home-carousel-active'));
    expect(mockNavigate).not.toHaveBeenCalled();
    const layer = screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true });
    (layer.parent?.instance.measureInWindow as jest.Mock)
      .mockImplementation((callback) => callback(0, 0, 400, 800));
    fireEvent(layer, 'layout');
    expect(screen.getByTestId('v2-anchor-transition-copy', { includeHiddenElements: true })).toBeTruthy();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not open details when a press moves like a swipe', () => {
    oneAnchor();
    renderHome();
    const artwork = screen.getByTestId('v2-home-carousel-active');
    fireEvent(artwork, 'pressIn', { nativeEvent: { pageX: 100, pageY: 200 } });
    fireEvent(artwork, 'touchMove', { nativeEvent: { pageX: 110, pageY: 200 } });
    fireEvent.press(artwork, { nativeEvent: { pageX: 112, pageY: 200 } });
    expect(mockNavigate).not.toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' });
  });

  it('still opens details on a deliberate tap with slight finger movement', async () => {
    oneAnchor();
    renderHome();
    (screen.getByTestId('v2-home-anchor-disc').parent?.instance.measureInWindow as jest.Mock)
      .mockImplementation((callback) => callback(100, 200, 154, 154));
    const artwork = screen.getByTestId('v2-home-carousel-active');
    fireEvent(artwork, 'pressIn', { nativeEvent: { pageX: 100, pageY: 200 } });
    fireEvent.press(artwork, { nativeEvent: { pageX: 103, pageY: 202 } });
    const layer = screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true });
    (layer.parent?.instance.measureInWindow as jest.Mock)
      .mockImplementation((callback) => callback(0, 0, 400, 800));
    fireEvent(layer, 'layout');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' }));
  });
});

describe('Home arrival sound guard', () => {
  const storageFor = () => {
    const storage = new Map<string, string>();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => storage.get(key) ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => { storage.set(key, value); });
    return storage;
  };
  const storageReads = () =>
    (AsyncStorage.getItem as jest.Mock).mock.calls.filter(([key]) => key === HOME_ARRIVAL_SOUND_PLAYED_KEY);

  it('reaches playCreationSound once when two Home mounts race in one session', async () => {
    const storage = storageFor();
    oneAnchor();
    useAuthStore.setState({ hasCompletedOnboarding: true });
    renderHome();
    renderHome();
    await waitFor(() => expect(storage.get(HOME_ARRIVAL_SOUND_PLAYED_KEY)).toBe('1'));
    await act(async () => { await Promise.resolve(); });
    expect(playCreationSound).toHaveBeenCalledTimes(1);
    expect(storageReads()).toHaveLength(1);
  });

  it('stays silent in a later session once the install has played it', async () => {
    const storage = storageFor();
    storage.set(HOME_ARRIVAL_SOUND_PLAYED_KEY, '1');
    resetHomeArrivalSoundClaimForTests();
    oneAnchor();
    useAuthStore.setState({ hasCompletedOnboarding: true });
    renderHome();
    await waitFor(() => expect(storageReads()).toHaveLength(1));
    await act(async () => { await Promise.resolve(); });
    expect(playCreationSound).not.toHaveBeenCalled();
  });
});

describe('Consistency (Thread Strength) states', () => {
  it('leads with the invitation, not the status, when strength is null', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', localId: 'a', threadStrength: undefined })],
      currentAnchorId: 'a',
    });
    renderHome();
    expect(screen.getByTestId('v2-home-thread-unmeasured').props.children).toBe('· Begins with practice');
    expect(screen.getByTestId('v2-home-progress-invitation').props.children).toBe('Your first practice starts the record.');
    // Never coerced to a number.
    expect(screen.queryByTestId('v2-home-thread-value')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('never fabricates weekly movement without a server delta', () => {
    oneAnchor();
    renderHome();
    expect(screen.queryByTestId('v2-home-thread-delta')).toBeNull();
    expect(screen.queryByText(/this week/i)).toBeNull();
  });

  it('renders the server-supplied delta as direction + magnitude when it exists', () => {
    oneAnchor();
    const anchor = useAnchorStore.getState().anchors[0];
    for (const [delta, trend, expected] of [
      [8, 'up', '↑ 8% this week'],
      [-21, 'down', '↓ 21% this week'],
      [0, 'flat', 'Steady this week'],
    ] as const) {
      const view = renderHome({}, { thread: { ...toThreadPresentation(anchor), delta, trend } });
      expect(screen.getByTestId('v2-home-thread-delta').props.children).toBe(expected);
      // The established value is unchanged by the delta; nothing is re-derived client side.
      expect(screen.getByTestId('v2-home-thread-value').props.children).toBe('74%');
      view.unmount();
    }
  });
});

describe('Today', () => {
  it('renders product language, never the server reason identifier', () => {
    oneAnchor();
    renderHome();
    expect(screen.getByTestId('v2-home-today-headline').props.children).toBe('Focus');
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Hold your anchor in focus.');
    expect(screen.queryByText('daily_focus')).toBeNull();
    expect(screen.queryByText(/_/)).toBeNull();
  });

  it('maps every server reason code to copy and never leaks an unknown code', () => {
    oneAnchor();
    for (const [reason, mode, expected] of [
      ['unseen_vision', 'visualize', 'Step into your Vision.'],
      ['thread_decay', 'deep_prime', 'Go deeper with your anchor.'],
      ['deep_reinforcement', 'deep_prime', 'Go deeper with your anchor.'],
      ['vision_scene', 'visualize', 'Step into your Vision.'],
      ['destination_reached', 'release', "Let go when you're ready."],
    ] as const) {
      const view = renderHome({}, { today: { state: 'ready', mode, action: 'Focus', reason, completionSignal: null, threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE', durationSeconds: mode === 'release' ? undefined : 120 } });
      expect(screen.getByTestId('v2-home-today-reason').props.children).toBe(expected);
      expect(screen.queryByText(reason)).toBeNull();
      view.unmount();
    }

    renderHome({}, { today: { state: 'ready', mode: 'focus', action: 'Focus', reason: 'some_future_code', completionSignal: null, threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE', durationSeconds: 30 } });
    expect(screen.queryByText('some_future_code')).toBeNull();
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Hold your anchor in focus.');
  });

  it('shows DONE TODAY and recommends a different practice after a session for this Anchor', () => {
    oneAnchor();
    const onOpenPractice = jest.fn();
    const completedAt = new Date().toISOString();
    useSessionStore.setState({ practiceHistory: [{
      id: 'session-today', accountId: 'user-1', anchorId: 'a', anchorLocalId: 'a', anchorServerId: 'a',
      practiceMode: 'focus', completedAt, completedDurationSeconds: 10, completionStatus: 'completed',
    } as never] });

    renderHome({ onOpenPractice: onOpenPractice as never }, { vision: readyVision });

    expect(screen.getByText('DONE TODAY')).toBeTruthy();
    expect(screen.getByTestId('v2-home-today-headline').props.children).toBe('Focus');
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Held today · 10 sec');
    expect(screen.getByText(/^Next · Visualize ·/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-home-today-begin'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', 'visualize');
  });

  it('uses All Practices when every available mode is complete', () => {
    oneAnchor();
    const onOpenPractice = jest.fn();
    const completedAt = new Date().toISOString();
    useSessionStore.setState({ practiceHistory: ['focus', 'visualize', 'deep_prime'].map((practiceMode, index) => ({
      id: `session-${index}`, accountId: 'user-1', anchorId: 'a', anchorLocalId: 'a', anchorServerId: 'a',
      practiceMode, completedAt, completedDurationSeconds: practiceMode === 'deep_prime' ? 300 : 30, completionStatus: 'completed',
    } as never)) });

    renderHome({ onOpenPractice: onOpenPractice as never }, { vision: readyVision });

    expect(screen.getByTestId('v2-home-today-headline').props.children).toBe('Focus');
    fireEvent.press(screen.getByTestId('v2-home-today-begin'));
    expect(onOpenPractice).toHaveBeenCalledWith('a');
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Held today · 30 sec');
    expect(screen.getAllByText('All Practices')).toHaveLength(1);
  });

  it('shows the most recent Visualize completion with Seen copy and its duration', () => {
    oneAnchor();
    const completedAt = new Date().toISOString();
    const earlierAt = new Date(Date.now() - 60_000).toISOString();
    useSessionStore.setState({ practiceHistory: [
      { id: 'session-visualize', accountId: 'user-1', anchorId: 'a', anchorLocalId: 'a', anchorServerId: 'a', practiceMode: 'visualize', completedAt, completedDurationSeconds: 180, completionStatus: 'completed' },
      { id: 'session-focus', accountId: 'user-1', anchorId: 'a', anchorLocalId: 'a', anchorServerId: 'a', practiceMode: 'focus', completedAt: earlierAt, completedDurationSeconds: 30, completionStatus: 'completed' },
    ] as never });

    renderHome({}, { vision: readyVision });

    expect(screen.getByTestId('v2-home-today-headline').props.children).toBe('Visualize');
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Seen today · 3 min');
    expect(screen.getByText(/^Next · Deep Focus ·/)).toBeTruthy();
  });

  it('shows Deep Focus and the latest duration when that is the most recent completion', () => {
    oneAnchor();
    const completedAt = new Date().toISOString();
    const earlierAt = new Date(Date.now() - 60_000).toISOString();
    useSessionStore.setState({ practiceHistory: [
      { id: 'session-deep', accountId: 'user-1', anchorId: 'a', anchorLocalId: 'a', anchorServerId: 'a', practiceMode: 'deep_prime', completedAt, completedDurationSeconds: 300, completionStatus: 'completed' },
      { id: 'session-focus', accountId: 'user-1', anchorId: 'a', anchorLocalId: 'a', anchorServerId: 'a', practiceMode: 'focus', completedAt: earlierAt, completedDurationSeconds: 30, completionStatus: 'completed' },
      { id: 'session-visualize', accountId: 'user-1', anchorId: 'a', anchorLocalId: 'a', anchorServerId: 'a', practiceMode: 'visualize', completedAt: earlierAt, completedDurationSeconds: 180, completionStatus: 'completed' },
    ] as never });

    renderHome({}, { vision: readyVision });

    expect(screen.getByTestId('v2-home-today-headline').props.children).toBe('Deep Focus');
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Held today · 5 min');
    expect(screen.getAllByText('All Practices')).toHaveLength(1);
  });

  it('presents every recommended mode by its user-facing name (Deep Prime shows as Deep Focus)', () => {
    oneAnchor();
    for (const [mode, action, reason, title] of [
      ['focus', 'Focus', 'daily_focus', 'Focus'],
      ['deep_prime', 'Deep Prime', 'thread_decay', 'Deep Focus'],
      ['visualize', 'Visualize', 'unseen_vision', 'Visualize'],
      ['release', 'Release', 'destination_reached', 'Release'],
    ] as const) {
      const view = renderHome({}, { today: { state: 'ready', mode, action, reason, completionSignal: null, threadStrength: 26, threadDelta: mode === 'deep_prime' ? -21 : 0, threadDeltaStatus: 'AVAILABLE', durationSeconds: mode === 'release' ? undefined : 120 } });
      expect(screen.getByTestId('v2-home-today-headline').props.children).toBe(title);
      expect(screen.queryByText(/Deep Prime/)).toBeNull();
      view.unmount();
    }
  });

  it('starts the recommended practice for the active Anchor', () => {
    const onOpenPractice = jest.fn();
    oneAnchor();
    renderHome({ onOpenPractice });
    fireEvent.press(screen.getByTestId('v2-home-today-begin'));
    expect(onOpenPractice).toHaveBeenCalledWith('a', 'focus');
  });

  it('offers a quieter All Practices entry that does not carry a recommendation', () => {
    const onOpenPractice = jest.fn();
    oneAnchor();
    renderHome({ onOpenPractice });
    fireEvent.press(screen.getByTestId('v2-home-all-practices'));
    expect(onOpenPractice).toHaveBeenCalledWith('a');
  });

  it('shows no fabricated recommendation while Today is loading or failed', () => {
    oneAnchor();
    const loading = renderHome({}, { today: { state: 'loading' } });
    expect(screen.getByTestId('v2-home-today-loading')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-today-headline')).toBeNull();
    loading.unmount();

    renderHome({}, { today: { state: 'error', message: 'boom' } });
    expect(screen.getByTestId('v2-home-today-error')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-today-headline')).toBeNull();
  });
});

describe('Conditional Vision and Chart', () => {
    it('state 1 — one Anchor, no Vision, no Chart: hides Vision and Chart, shows Progress', () => {
    oneAnchor();
    renderHome();
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.queryByTestId('v2-home-vision-empty')).toBeNull();
    expect(screen.queryByText('Your Vision')).toBeNull();
    expect(screen.queryByText('Create Vision')).toBeNull();
    expect(screen.queryByText('Chart your first waypoint')).toBeNull();
    expect(screen.queryByText('Your Chart')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
    expect(screen.getByTestId('v2-home-progress')).toBeTruthy();
  });

  it('renders no Chart section when no Course exists', () => {
    oneAnchor();
    const onOpenChart = jest.fn();
    renderHome({ onOpenChart }, { chart: { state: 'none' } });
    expect(screen.queryByText('Chart your first waypoint')).toBeNull();
    expect(screen.queryByText('Your Chart')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart-error')).toBeNull();
    expect(screen.queryByText(/Loading your current Course/i)).toBeNull();
    expect(onOpenChart).not.toHaveBeenCalled();
  });

  it('renders nothing for Chart while the relationship is still resolving', () => {
    oneAnchor();
    renderHome({}, { chart: { state: 'resolving' } });
    expect(screen.queryByTestId('v2-home-chart-loading')).toBeNull();
    expect(screen.queryByText('Your Chart')).toBeNull();
  });

  it('shows a Chart placeholder only for a known relationship in flight', () => {
    oneAnchor();
    mockUseChartPreview.mockReturnValue(null);
    renderHome({}, { chart: { state: 'loading' } });
    expect(screen.getByTestId('chart-preview-loading')).toBeTruthy();
  });

    it('state 2 — Vision, no Chart', () => {
    oneAnchor();
    renderHome({}, { vision: readyVision });
    expect(screen.getByTestId('v2-home-vision')).toBeTruthy();
    expect(screen.getByTestId('v2-home-vision-image')).toBeTruthy();
      expect(screen.queryByTestId('v2-home-chart-empty')).toBeNull();
      expect(screen.queryByTestId('v2-home-progress')).toBeNull();
  });

    it('state 3 — Chart, no Vision, with real Course data: shows Chart and Progress, hides Vision', () => {
    oneAnchor();
    mockUseChartPreview.mockReturnValue(selectChartPreview(chartPreviewCourses.normal));
    renderHome({}, { chart: readyChart });
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.queryByText('Your Vision')).toBeNull();
    expect(screen.queryByText('Create Vision')).toBeNull();
    expect(screen.getByTestId('v2-home-chart-map')).toBeTruthy();
    expect(screen.getByText('Contact 3 creators')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
      expect(screen.getByTestId('v2-home-progress')).toBeTruthy();
  });

  it('state 4 — Vision and Chart both render from real data', () => {
    oneAnchor();
    renderHome({}, { vision: readyVision, chart: readyChart });
    expect(screen.getByTestId('v2-home-vision')).toBeTruthy();
    expect(screen.getByTestId('v2-home-chart')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-progress')).toBeNull();
  });

  it('renders nothing for Vision while loading or on failure — never a placeholder scene', () => {
    oneAnchor();
    const loading = renderHome({}, { vision: { state: 'loading' } });
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    loading.unmount();

    renderHome({}, { vision: { state: 'error', message: 'offline' } });
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.queryByText('Your Vision')).toBeNull();
    expect(screen.queryByText('Retry Vision')).toBeNull();
  });

  it('routes Vision and Chart to their real surfaces for the active Anchor', () => {
    const onOpenVision = jest.fn();
    const onOpenChart = jest.fn();
    oneAnchor();
    renderHome({ onOpenVision, onOpenChart }, { vision: readyVision, chart: readyChart });
    fireEvent.press(screen.getByTestId('v2-home-vision'));
    expect(onOpenVision).toHaveBeenCalledWith('a');
    fireEvent.press(screen.getByTestId('v2-home-chart'));
    expect(onOpenChart).toHaveBeenCalledWith('a', 'c1');
  });

  it('keeps both View all actions on their existing destinations', () => {
    const onOpenVision = jest.fn();
    const onOpenChart = jest.fn();
    oneAnchor();
    renderHome({ onOpenVision, onOpenChart }, { vision: readyVision, chart: readyChart });
    fireEvent.press(screen.getByLabelText('View all Vision'));
    fireEvent.press(screen.getByLabelText('View all Chart'));
    expect(onOpenVision).toHaveBeenCalledWith('a');
    expect(onOpenChart).toHaveBeenCalledWith('a', 'c1');
  });

  it('state A — Vision unseen today: title case, View all, and an Enter Vision tap target', () => {
    oneAnchor();
    renderHome({}, { vision: readyVision });
    expect(screen.getByText('Your Vision')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-vision-seen')).toBeNull();
    expect(screen.getByLabelText('Enter your Vision')).toBeTruthy();
    expect(screen.queryByText('Revisit Vision')).toBeNull();
  });

  it('state B — Vision seen today, from the real backend flag: title case and a Revisit Vision tap target', () => {
    oneAnchor();
    renderHome({}, { vision: { ...readyVision, seenToday: true } });
    expect(screen.getByText('Your Vision')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-vision-seen')).toBeNull();
    expect(screen.getByLabelText('Revisit your Vision')).toBeTruthy();
    expect(screen.queryByText('Enter Vision')).toBeNull();
  });

  it('renders the real Vision statement, and the whole photograph is one tap target', () => {
    const onOpenVision = jest.fn();
    oneAnchor();
    renderHome({ onOpenVision }, { vision: readyVision });
    expect(screen.getByTestId('v2-home-vision-title').props.children).toBe('Studio at dawn');
    fireEvent.press(screen.getByTestId('v2-home-vision'));
    expect(onOpenVision).toHaveBeenCalledWith('a');
  });

  it('a Vision with real text but no cover image renders without fabricating a photograph', () => {
    oneAnchor();
    renderHome({}, { vision: { state: 'ready', visionId: 'v2', previewText: 'A future with only words so far', tiles: [], seenToday: false } });
    expect(screen.getByTestId('v2-home-vision')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-vision-image')).toBeNull();
    expect(screen.getByText('A future with only words so far')).toBeTruthy();
  });

  it('Today borrows the real Vision cover only when the recommendation is Visualize', () => {
    oneAnchor();
    const visualizeToday = { state: 'ready' as const, mode: 'visualize' as const, action: 'Visualize' as const, reason: 'unseen_vision', completionSignal: null, threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE' as const, durationSeconds: 90 };

    // Visualize + a real Vision cover: Today's artwork is the Vision photo.
    let view = renderHome({}, { today: visualizeToday, vision: readyVision });
    expect(screen.getByTestId('v2-home-today-artwork-vision')).toBeTruthy();
    view.unmount();

    // Visualize but no Vision (or no cover): Today keeps its illustrated artwork.
    view = renderHome({}, { today: visualizeToday, vision: { state: 'none' } });
    expect(screen.getByTestId('v2-home-today-artwork')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-today-artwork-vision')).toBeNull();
    view.unmount();

    // Focus keeps its own illustrated artwork even when a Vision cover exists.
    renderHome({}, { vision: readyVision });
    expect(screen.getByTestId('v2-home-today-artwork')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-today-artwork-vision')).toBeNull();
  });

  it('prefers a second Vision image for the Visualize hero so the same photo never appears twice on Home', () => {
    oneAnchor();
    const visualizeToday = { state: 'ready' as const, mode: 'visualize' as const, action: 'Visualize' as const, reason: 'unseen_vision', completionSignal: null, threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE' as const, durationSeconds: 90 };
    const twoImageVision = {
      ...readyVision,
      tiles: [
        { id: 't1', sceneId: 's1', imageUrl: 'https://assets.test/vision.png', prompt: null, sortOrder: 0, isHero: true },
        { id: 't2', sceneId: 's1', imageUrl: 'https://assets.test/vision-alt.png', prompt: null, sortOrder: 1, isHero: false },
      ],
    };

    renderHome({}, { today: visualizeToday, vision: twoImageVision });
    const todayImage = screen.getByTestId('v2-home-today-artwork-vision').findByType(Image);
    const visionImage = screen.getByTestId('v2-home-vision-image');
    expect(todayImage.props.source).toEqual({ uri: 'https://assets.test/vision-alt.png' });
    expect(visionImage.props.source).toEqual({ uri: 'https://assets.test/vision.png' });
    expect(todayImage.props.source).not.toEqual(visionImage.props.source);
  });

  it('reuses the single Vision image for the Visualize hero with a different crop when there is only one', () => {
    oneAnchor();
    const visualizeToday = { state: 'ready' as const, mode: 'visualize' as const, action: 'Visualize' as const, reason: 'unseen_vision', completionSignal: null, threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE' as const, durationSeconds: 90 };

    renderHome({}, { today: visualizeToday, vision: readyVision });
    const todayImage = screen.getByTestId('v2-home-today-artwork-vision').findByType(Image);
    const visionImage = screen.getByTestId('v2-home-vision-image');
    expect(todayImage.props.source).toEqual({ uri: 'https://assets.test/vision.png' });
    expect(visionImage.props.source).toEqual({ uri: 'https://assets.test/vision.png' });
  });

  it('truncates a long Vision statement on Home rather than clipping into the CTA', () => {
    oneAnchor();
    const longStatement = Array.from({ length: 6 }, () => 'My RevenueCat dashboard shows ten thousand active users for Anchor.').join(' ');
    renderHome({}, { vision: { ...readyVision, title: undefined, previewText: longStatement } });
    const statement = screen.getByTestId('v2-home-vision-statement');
    expect(statement.props.numberOfLines).toBe(2);
    expect(statement.props.children).toBe(longStatement);
    expect(screen.getByLabelText('Enter your Vision')).toBeTruthy();
  });
});

describe('Hero carousel', () => {
  const twoAnchors = () =>
    useAnchorStore.setState({
      anchors: [
        makeAnchor({ id: 'a', localId: 'a', intentionText: 'First intention', category: 'desire' }),
        makeAnchor({ id: 'b', localId: 'b', intentionText: 'Second intention', category: 'career' }),
      ],
      currentAnchorId: 'a',
    });

  it('state 5 — shows peeking neighbours and a numeric position with multiple Anchors', () => {
    twoAnchors();
    renderHome();
    expect(screen.getByText('1 OF 2')).toBeTruthy();
    expect(screen.getByTestId('v2-home-all-anchors')).toBeTruthy();
    expect(screen.getByTestId('v2-home-carousel-previous')).toBeTruthy();
    expect(screen.getByTestId('v2-home-carousel-next')).toBeTruthy();
  });

  it('opens the Anchor library from the position indicator — Home is its only entry point', () => {
    twoAnchors();
    renderHome();
    fireEvent.press(screen.getByTestId('v2-home-anchor-position'));
    expect(mockNavigate).toHaveBeenCalledWith('V2AnchorLibrary');
  });

  it('activates a visible neighbour on tap and writes to the shared selection authority', async () => {
    twoAnchors();
    renderHome();
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    // The carousel commits once it has rested, not on the tap itself.
    await waitFor(() => expect(selectAnchor).toHaveBeenCalledWith('b'));
    expect(useAnchorStore.getState().currentAnchorId).toBe('b');
  });

  it('centres a single Anchor with no neighbours and a truthful count', () => {
    oneAnchor();
    renderHome();
    expect(screen.queryByTestId('v2-home-carousel-previous')).toBeNull();
    expect(screen.queryByTestId('v2-home-carousel-next')).toBeNull();
    expect(screen.getByText('1 OF 1')).toBeTruthy();
  });

  it('updates every contextual module atomically when the Anchor changes', () => {
    twoAnchors();
    // Anchor "a" owns the Chart and a Vision.
    const first = renderHome({}, { vision: readyVision, chart: readyChart });
    expect(screen.getByTestId('v2-home-intention').props.children).toBe('First intention');
    expect(screen.getByTestId('v2-home-chart')).toBeTruthy();
    first.unmount();

    // Switching to "b", which has neither, must not leave "a" context on screen.
    useAnchorStore.setState({ currentAnchorId: 'b' });
    renderHome({}, { vision: { state: 'none' }, chart: { state: 'none' } });
    expect(screen.getByTestId('v2-home-intention').props.children).toBe('Second intention');
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart-empty')).toBeNull();
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.queryByText('Reach 1,000 active users')).toBeNull();
    expect(screen.queryByText('A bright open studio at dawn')).toBeNull();
  });
});

describe('Home section order', () => {
  it('renders progress and recent activity while keeping weekly review out of Home when no vision', () => {
    oneAnchor();
    renderHome({}, {
      progress: {
        state: 'ready',
        totalSessions: 4,
        evidence: [{ id: 'e1', title: 'Anchor created', dayLabel: 'Yesterday', occurredAt: '2026-09-16T09:00:00.000Z' }],
      },
      recentActivity: [{ id: 's1', title: 'Visualize', dayLabel: 'Thursday', mode: 'visualize', durationSeconds: 60 }],
    });
    expect(screen.getByTestId('v2-home-progress')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-weekly-review')).toBeNull();
    expect(screen.getByText('Recent Practice')).toBeTruthy();
  });

  it('omits progress when vision is present (feature dynamic)', () => {
    oneAnchor();
    renderHome({}, {
      vision: readyVision,
      progress: {
        state: 'ready',
        totalSessions: 4,
        evidence: [{ id: 'e1', title: 'Anchor created', dayLabel: 'Yesterday', occurredAt: '2026-09-16T09:00:00.000Z' }],
      },
      recentActivity: [{ id: 's1', title: 'Visualize', dayLabel: 'Thursday', mode: 'visualize', durationSeconds: 60 }],
    });
    expect(screen.getByTestId('v2-home-vision')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-progress')).toBeNull();
    expect(screen.getByText('Recent Practice')).toBeTruthy();
  });
});

describe('Account and loading states', () => {
  it('shows a restrained skeleton rather than a pile of loading cards', () => {
    renderHome({}, { anchorState: 'loading', selectedAnchor: null, anchorList: [], selectedIndex: -1, thread: null });
    expect(screen.getByTestId('v2-home-anchors-loading')).toBeTruthy();
    expect(screen.queryByText('No Anchor yet')).toBeNull();
    expect(screen.queryByTestId('v2-home-today')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart-loading')).toBeNull();
  });

  it('offers the create path with no Anchors and renders no modules', () => {
    const onCreateAnchor = jest.fn();
    renderHome({ onCreateAnchor }, { anchorState: 'empty', selectedAnchor: null, anchorList: [], selectedIndex: -1, thread: null, hasAnchors: false });
    expect(screen.getByText('No Anchor yet')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create your first Anchor'));
    expect(onCreateAnchor).toHaveBeenCalled();
    expect(screen.queryByTestId('v2-home-today')).toBeNull();
  });

  it('state 12 — a failed load surfaces a retry and no fabricated content', () => {
    renderHome({}, { anchorState: 'error', anchorError: 'Network unavailable', selectedAnchor: null, anchorList: [], selectedIndex: -1, thread: null });
    expect(screen.getByTestId('v2-home-anchors-error')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
  });
});

describe('first arrival skip target', () => {
  const FLIGHT_RECT = { x: 40, y: 200, width: 280, height: 280 };
  const TARGET_RECT = { x: 140, y: 180, width: 110, height: 110 };

  /** An arrival already released for Home, with a flight, so the coordinator sees its real duration. */
  const arriving = (kind: 'first' | 'repeat') =>
    useHomeArrivalStore.setState({
      arrival: {
        id: 7,
        anchorId: 'a',
        kind,
        svg: '<svg/>',
        category: 'desire',
        expression: 'original',
        fromRect: FLIGHT_RECT,
        targetRect: TARGET_RECT,
        phase: 'arriving',
      },
    });

  beforeEach(() => {
    useSettingsStore.setState({ reduceMotion: 'off' });
    useHomeArrivalStore.setState({ arrival: null });
    useCelebrationStore.getState().reset();
  });
  afterEach(() => {
    act(() => {
      useHomeArrivalStore.setState({ arrival: null });
      useCelebrationStore.getState().reset();
    });
  });

  it('shows while a first arrival is a skippable scene, and a tap lands it on its end state', () => {
    oneAnchor();
    arriving('first');
    renderHome();
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(7), level: 4, skippable: true });
    expect(screen.getByTestId('v2-home-arrival-skip')).toBeTruthy();

    fireEvent.press(screen.getByTestId('v2-home-arrival-skip'));
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
  });

  it('names the skip target for assistive technology', () => {
    oneAnchor();
    arriving('first');
    renderHome();
    const skip = screen.getByTestId('v2-home-arrival-skip');
    expect(skip.props.accessible).toBe(true);
    expect(skip.props.accessibilityRole).toBe('button');
    expect(skip.props.accessibilityLabel).toBe('Skip');
  });

  it('is absent for a repeat arrival, which is not skippable', () => {
    oneAnchor();
    arriving('repeat');
    renderHome();
    expect(useCelebrationStore.getState().active?.skippable).toBe(false);
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
  });

  it('is absent once the arrival has ended', () => {
    oneAnchor();
    arriving('first');
    renderHome();
    expect(screen.getByTestId('v2-home-arrival-skip')).toBeTruthy();
    act(() => {
      useHomeArrivalStore.getState().clear(7);
    });
    expect(screen.queryByTestId('v2-home-arrival-skip')).toBeNull();
  });
});

describe('Active Hero Thread Strength glow', () => {
  it('renders Thread Strength glow only on the centered active hero Anchor and disables it on neighboring carousel Anchors', () => {
    const anchors = [
      makeAnchor({ id: 'a', localId: 'a', intentionText: 'First intention', category: 'career', threadStrength: 26 }),
      makeAnchor({ id: 'b', localId: 'b', intentionText: 'Second intention', category: 'health', threadStrength: 80 }),
      makeAnchor({ id: 'c', localId: 'c', intentionText: 'Third intention', category: 'desire', threadStrength: 54 }),
    ];
    useAnchorStore.setState({ anchors, currentAnchorId: 'a' });

    const view = renderHome();

    // Even with 3 Anchors mounted in the carousel (centre + previous + next), only the active hero has a ThreadAura.
    const initialAuras = screen.getAllByTestId('thread-aura-home', { includeHiddenElements: true });
    expect(initialAuras).toHaveLength(1);
    const activeDisc = screen.getByTestId('v2-home-anchor-disc');
    expect(activeDisc.findAll((node: ReactTestInstance) => node === initialAuras[0], { deep: true })).toHaveLength(1);

    // Commit a carousel switch to Anchor 'b' (80% Thread Strength).
    act(() => {
      useAnchorStore.setState({ currentAnchorId: 'b' });
    });
    const updatedList = anchors.map((anchor) => ({
      anchor,
      thread: toThreadPresentation(anchor),
      isSelected: anchor.id === 'b',
    }));
    mockUseV2HomeModel.mockReturnValue({
      ...mockUseV2HomeModel.mock.results[mockUseV2HomeModel.mock.results.length - 1].value,
      selectedAnchor: anchors[1],
      thread: toThreadPresentation(anchors[1]),
      anchorList: updatedList,
      selectedIndex: 1,
    });
    act(() => {
      view.rerender(
        <V2DailyShellIntentsProvider intents={{}}>
          <V2HomeScreen />
        </V2DailyShellIntentsProvider>,
      );
    });

    // Still only a single Thread Strength glow exists, belonging to the newly committed active hero.
    const nextAuras = screen.getAllByTestId('thread-aura-home', { includeHiddenElements: true });
    expect(nextAuras).toHaveLength(1);
    expect(screen.getByTestId('v2-home-intention').props.children).toBe('Second intention');
    expect(
      screen.getByTestId('v2-home-anchor-disc').findAll((node: ReactTestInstance) => node === nextAuras[0], { deep: true }),
    ).toHaveLength(1);
  });
});
