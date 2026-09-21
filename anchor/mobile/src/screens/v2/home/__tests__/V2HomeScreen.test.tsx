import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

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

import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { V2HomeScreen } from '../V2HomeScreen';
import { V2DailyShellIntentsProvider } from '../dailyShell';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation, useV2HomeModel } from '@/adapters/v2/home';

const mockUseV2HomeModel = useV2HomeModel as jest.Mock;

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
    anchorState: 'ready',
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
  mockNavigate.mockClear();
  selectAnchor.mockClear();
  useSettingsStore.setState({ reduceMotion: 'on' });
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
  useAuthStore.setState({ user: { id: 'user-1', email: 'e', displayName: 'Deontrez' } as never });
  useCourseStore.setState({ activeCourse: null });
});

const oneAnchor = () =>
  useAnchorStore.setState({
    anchors: [makeAnchor({ id: 'a', localId: 'a', intentionText: 'I finish what matters', category: 'desire', threadStrength: 74 })],
    currentAnchorId: 'a',
  });

describe('Home structure', () => {
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

  it('keeps Thread Strength as a compact hero reading, not a giant block', () => {
    oneAnchor();
    renderHome();
    const reading = screen.getByTestId('v2-home-thread-reading');
    expect(reading).toBeTruthy();
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

  it('opens Anchor details from the hero artwork', () => {
    oneAnchor();
    renderHome();
    fireEvent.press(screen.getByTestId('v2-home-carousel-active'));
    expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' });
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

  it('still opens details on a deliberate tap with slight finger movement', () => {
    oneAnchor();
    renderHome();
    const artwork = screen.getByTestId('v2-home-carousel-active');
    fireEvent(artwork, 'pressIn', { nativeEvent: { pageX: 100, pageY: 200 } });
    fireEvent.press(artwork, { nativeEvent: { pageX: 103, pageY: 202 } });
    expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' });
  });
});

describe('Thread Strength states', () => {
  it('shows "Not yet measured" only inside the small hero row when strength is null', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', localId: 'a', threadStrength: undefined })],
      currentAnchorId: 'a',
    });
    renderHome();
    expect(screen.getByTestId('v2-home-thread-unmeasured')).toBeTruthy();
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

  it('renders the server-supplied delta verbatim when it exists', () => {
    oneAnchor();
    const anchor = useAnchorStore.getState().anchors[0];
    renderHome({}, { thread: { ...toThreadPresentation(anchor), delta: 8, trend: 'up' } });
    expect(screen.getByTestId('v2-home-thread-delta').props.children).toBe('↑ +8% this week');
  });
});

describe('Today', () => {
  it('renders product language, never the server reason identifier', () => {
    oneAnchor();
    renderHome();
    expect(screen.getByTestId('v2-home-today-headline').props.children).toBe('Focus');
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Build the thread today.');
    expect(screen.queryByText('daily_focus')).toBeNull();
    expect(screen.queryByText(/_/)).toBeNull();
  });

  it('maps every server reason code to copy and never leaks an unknown code', () => {
    oneAnchor();
    for (const [reason, mode, expected] of [
      ['unseen_vision', 'visualize', 'You have not seen your Vision today.'],
      ['thread_decay', 'deep_prime', 'The thread softened this week. Go deeper.'],
      ['destination_reached', 'release', 'You reached your destination. Close the loop.'],
    ] as const) {
      const view = renderHome({}, { today: { state: 'ready', mode, action: 'Focus', reason, completionSignal: null, threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE', durationSeconds: mode === 'release' ? undefined : 120 } });
      expect(screen.getByTestId('v2-home-today-reason').props.children).toBe(expected);
      expect(screen.queryByText(reason)).toBeNull();
      view.unmount();
    }

    renderHome({}, { today: { state: 'ready', mode: 'focus', action: 'Focus', reason: 'some_future_code', completionSignal: null, threadStrength: null, threadDelta: null, threadDeltaStatus: 'UNAVAILABLE', durationSeconds: 30 } });
    expect(screen.queryByText('some_future_code')).toBeNull();
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Daily reinforcement for your Anchor');
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
    it('state 1 — one Anchor, no Vision, no Chart: renders neither and reserves no space', () => {
    oneAnchor();
    renderHome();
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
    expect(screen.queryByText('VISION')).toBeNull();
      expect(screen.queryByText('CHART')).toBeNull();
      expect(screen.getByTestId('v2-home-progress')).toBeTruthy();
  });

  it('renders NO Chart placeholder of any kind when no Course exists', () => {
    oneAnchor();
    renderHome({}, { chart: { state: 'none' } });
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart-loading')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart-error')).toBeNull();
    expect(screen.queryByText(/Loading your current Course/i)).toBeNull();
  });

  it('renders nothing for Chart while the relationship is still resolving', () => {
    oneAnchor();
    renderHome({}, { chart: { state: 'resolving' } });
    expect(screen.queryByTestId('v2-home-chart-loading')).toBeNull();
    expect(screen.queryByText('CHART')).toBeNull();
  });

  it('shows a Chart placeholder only for a known relationship in flight', () => {
    oneAnchor();
    renderHome({}, { chart: { state: 'loading' } });
    expect(screen.getByTestId('v2-home-chart-loading')).toBeTruthy();
  });

    it('state 2 — Vision, no Chart', () => {
    oneAnchor();
    renderHome({}, { vision: readyVision });
    expect(screen.getByTestId('v2-home-vision')).toBeTruthy();
    expect(screen.getByTestId('v2-home-vision-image')).toBeTruthy();
      expect(screen.queryByTestId('v2-home-chart')).toBeNull();
      expect(screen.queryByTestId('v2-home-progress')).toBeNull();
  });

    it('state 3 — Chart, no Vision, with real Course data', () => {
    oneAnchor();
    renderHome({}, { chart: readyChart });
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.getByTestId('v2-home-chart-destination').props.children).toBe('Reach 1,000 active users');
    expect(screen.getByTestId('v2-home-chart-waypoint').props.children).toBe('Contact 3 creators');
    expect(screen.getByTestId('v2-home-chart-one-move').props.children).toBe('Contact 3 creators');
      expect(screen.getByTestId('v2-home-chart-progress').props.children).toBe('1 of 2 reached');
      expect(screen.queryByTestId('v2-home-progress')).toBeNull();
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
    expect(screen.queryByText('VISION')).toBeNull();
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

  it('activates a visible neighbour on tap and writes to the shared selection authority', () => {
    twoAnchors();
    renderHome();
    fireEvent.press(screen.getByTestId('v2-home-carousel-next'));
    expect(selectAnchor).toHaveBeenCalledWith('b');
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
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.queryByText('Reach 1,000 active users')).toBeNull();
    expect(screen.queryByText('A bright open studio at dawn')).toBeNull();
  });
});

describe('Progress', () => {
  it('renders real evidence with real local day labels', () => {
    oneAnchor();
    renderHome({}, {
      progress: {
        state: 'ready',
        totalSessions: 4,
        evidence: [{ id: 'e1', title: 'Anchor created', dayLabel: 'Yesterday', occurredAt: '2026-09-16T09:00:00.000Z' }],
      },
    });
    expect(screen.getByTestId('v2-home-progress-item-e1')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByTestId('v2-home-progress-sessions').props.children).toBe('4 practices');
    // None of the HTML reference's illustrative content is present.
    expect(screen.queryByText(/Portfolio direction clarified/i)).toBeNull();
    expect(screen.queryByText(/Two prospects selected/i)).toBeNull();
  });

  it('states the empty case plainly rather than inventing activity', () => {
    oneAnchor();
    renderHome({}, { progress: { state: 'empty' } });
    expect(screen.getByTestId('v2-home-progress-empty')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-progress-sessions')).toBeNull();
  });
});

describe('Account and loading states', () => {
  it('shows a restrained skeleton rather than a pile of loading cards', () => {
    renderHome({}, { anchorState: 'loading', selectedAnchor: null, anchorList: [], selectedIndex: -1, thread: null });
    expect(screen.getByTestId('v2-home-anchors-loading')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-today')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart-loading')).toBeNull();
  });

  it('offers the create path with no Anchors and renders no modules', () => {
    const onCreateAnchor = jest.fn();
    renderHome({ onCreateAnchor }, { selectedAnchor: null, anchorList: [], selectedIndex: -1, thread: null, hasAnchors: false });
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
