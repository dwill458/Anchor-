import React from 'react';
import { Image } from 'react-native';
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

type ReactTestInstance = ReturnType<typeof screen.getByTestId>;

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

  it('keeps Consistency as a compact hero reading, not a giant block', () => {
    oneAnchor();
    renderHome();
    const reading = screen.getByTestId('v2-home-thread-reading');
    expect(reading).toBeTruthy();
    // Thread Strength is presented to users as Consistency.
    expect(screen.getByText('Consistency')).toBeTruthy();
    expect(screen.queryByText(/Thread Strength/)).toBeNull();
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

describe('Consistency (Thread Strength) states', () => {
  it('shows "Not established yet" only inside the small hero row when strength is null', () => {
    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a', localId: 'a', threadStrength: undefined })],
      currentAnchorId: 'a',
    });
    renderHome();
    expect(screen.getByTestId('v2-home-thread-unmeasured').props.children).toBe('· Not established yet');
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
    expect(screen.getByTestId('v2-home-today-reason').props.children).toBe('Build consistency today.');
    expect(screen.queryByText('daily_focus')).toBeNull();
    expect(screen.queryByText(/_/)).toBeNull();
  });

  it('maps every server reason code to copy and never leaks an unknown code', () => {
    oneAnchor();
    for (const [reason, mode, expected] of [
      ['unseen_vision', 'visualize', 'You have not seen your Vision today.'],
      ['thread_decay', 'deep_prime', 'Consistency dipped this week. Go deeper.'],
      ['deep_reinforcement', 'deep_prime', 'A longer session to go deeper.'],
      ['vision_scene', 'visualize', 'Step back into your Vision.'],
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
    it('state 1 — one Anchor, no Vision, no Chart: renders neither and reserves no space', () => {
    oneAnchor();
    renderHome();
    expect(screen.queryByTestId('v2-home-vision')).toBeNull();
    expect(screen.queryByTestId('v2-home-chart')).toBeNull();
    expect(screen.queryByText('YOUR VISION')).toBeNull();
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
    expect(screen.queryByText('YOUR VISION')).toBeNull();
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

  it('state A — Vision unseen today: "YOUR VISION", never a false "Seen today", CTA is Enter Vision', () => {
    oneAnchor();
    renderHome({}, { vision: readyVision });
    expect(screen.getByText('YOUR VISION')).toBeTruthy();
    expect(screen.queryByTestId('v2-home-vision-seen')).toBeNull();
    expect(screen.getByText('Enter Vision')).toBeTruthy();
    expect(screen.queryByText('Revisit Vision')).toBeNull();
  });

  it('state B — Vision seen today, from the real backend flag: "YOUR VISION" + "Seen today", CTA is Revisit Vision', () => {
    oneAnchor();
    renderHome({}, { vision: { ...readyVision, seenToday: true } });
    expect(screen.getByText('YOUR VISION')).toBeTruthy();
    expect(screen.getByTestId('v2-home-vision-seen')).toBeTruthy();
    expect(screen.getByText('Revisit Vision')).toBeTruthy();
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
    expect(statement.props.numberOfLines).toBe(3);
    expect(statement.props.children).toBe(longStatement);
    expect(screen.getByText('Enter Vision')).toBeTruthy();
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
  it('renders the real session count and the shared Thread visualization', () => {
    oneAnchor();
    renderHome({}, {
      progress: {
        state: 'ready',
        totalSessions: 4,
        evidence: [{ id: 'e1', title: 'Anchor created', dayLabel: 'Yesterday', occurredAt: '2026-09-16T09:00:00.000Z' }],
      },
    });
    expect(screen.getByTestId('v2-home-progress-sessions').props.children).toBe('4 practices');
    // The same ThreadStrength track Anchor Details uses, without its own number row.
    expect(screen.getByTestId('v2-home-progress-thread-track')).toBeTruthy();
    // Evidence lives in Progress itself; the Home preview carries only the count.
    expect(screen.queryByTestId('v2-home-progress-item-e1')).toBeNull();
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
