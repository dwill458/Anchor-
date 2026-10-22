type MockAnchor = { id: string; localId?: string; userId?: string; archivedAt?: Date; isReleased?: boolean };
const mockAnchors: MockAnchor[] = [];
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ anchors: mockAnchors }) },
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
}));
const mockPlayCreationSound = jest.fn();
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (...args: unknown[]) => mockPlayCreationSound(...args) }));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: jest.fn() },
}));

import { RELEASE_HANDOFF, handOffReleaseToHome, resetReleaseHandoffForTests } from '../releaseHandoff';
import { useHomeArrivalStore } from '@/stores/v2/homeArrivalStore';
import { safeHaptics } from '@/utils/haptics';

const anchor = (id: string, extra: Partial<MockAnchor> = {}): MockAnchor => ({ id, localId: id, userId: 'user-1', ...extra });

const makeNavigation = (canGoBack = true) => {
  const calls: string[] = [];
  return {
    calls,
    setOptions: jest.fn((options: { animation?: string }) => { calls.push(`options:${options.animation}`); }),
    popToTop: jest.fn(() => { calls.push('popToTop'); }),
    canGoBack: jest.fn(() => canGoBack),
  };
};

/** Plays Home's part: report ready as soon as the arrival is staged (a release has nothing to measure). */
const homeAnswers = () =>
  useHomeArrivalStore.subscribe((state) => {
    if (state.arrival?.phase === 'staging') state.reportReady(state.arrival.id, null);
  });

/** Runs a hand-off to the end, letting its timers (the chrome fade, the one-frame wait) elapse. */
async function run<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  const tracked = promise.finally(() => { settled = true; });
  for (let i = 0; i < 40 && !settled; i += 1) {
    await Promise.resolve();
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  }
  return tracked;
}

beforeEach(() => {
  jest.useFakeTimers();
  resetReleaseHandoffForTests();
  useHomeArrivalStore.setState({ arrival: null });
  mockAnchors.length = 0;
  // The release is already confirmed and in the store (the ending only shows after that): one is gone, two remain.
  mockAnchors.push(anchor('released-1', { isReleased: true }), anchor('next-1'), anchor('next-2'));
  mockPlayCreationSound.mockClear();
  jest.mocked(safeHaptics.impact).mockClear();
  jest.mocked(safeHaptics.selection).mockClear();
  jest.mocked(safeHaptics.notification).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('handOffReleaseToHome (RL1)', () => {
  it('stages a release arrival with no flight, starts its clock, and pops to the Home beneath with no transition of its own', async () => {
    const unsubscribe = homeAnswers();
    const navigation = makeNavigation();
    const fallback = jest.fn();
    await expect(run(handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback }, { reduceMotion: false }))).resolves.toBe('started');
    unsubscribe();

    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival).toMatchObject({ kind: 'release', anchorId: '', fromRect: null, targetRect: null, phase: 'arriving' });
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'none', gestureEnabled: false });
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('releases the arrival (its clock) before the route changes, and changes the route only after the ending has faded', async () => {
    const order: string[] = [];
    const unsubscribe = homeAnswers();
    const stopWatching = useHomeArrivalStore.subscribe((state, previous) => {
      if (state.arrival?.phase === 'arriving' && previous.arrival?.phase !== 'arriving') order.push('release');
    });
    const navigation = makeNavigation();
    navigation.popToTop.mockImplementation(() => { order.push('popToTop'); });
    const tappedAt = Date.now();
    await run(handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    stopWatching();
    expect(order).toEqual(['release', 'popToTop']);
    // The route change waited out the ending's 600ms of chrome fade over its cream paper.
    expect(Date.now() - tappedAt).toBeGreaterThanOrEqual(RELEASE_HANDOFF.chromeMs);
  });

  it('records how many Anchors Home counted before, only when the release took one away', async () => {
    const unsubscribe = homeAnswers();
    await run(handOffReleaseToHome(makeNavigation(), { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    // Two remain and the released one was in the store as released: Home counted three before.
    expect(useHomeArrivalStore.getState().arrival?.countBefore).toBe(3);

    resetReleaseHandoffForTests();
    useHomeArrivalStore.setState({ arrival: null });
    // An Anchor that is not released in the store (nothing took one away) is never a roll.
    const unsubscribeAgain = homeAnswers();
    await run(handOffReleaseToHome(makeNavigation(), { anchorId: 'next-1', fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribeAgain();
    expect(useHomeArrivalStore.getState().arrival?.countBefore).toBeNull();
  });

  it('counts Home the way Home does: another account\'s and archived Anchors are not counted', async () => {
    mockAnchors.push(anchor('theirs', { userId: 'someone-else' }), anchor('old', { archivedAt: new Date() }));
    const unsubscribe = homeAnswers();
    await run(handOffReleaseToHome(makeNavigation(), { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival?.countBefore).toBe(3);
  });

  it('under Reduce Motion stages the same arrival and fades, without waiting out the staggered exit', async () => {
    const unsubscribe = homeAnswers();
    const navigation = makeNavigation();
    const tappedAt = Date.now();
    await run(handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: true }));
    unsubscribe();

    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ kind: 'release', fromRect: null, phase: 'arriving' });
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'fade', gestureEnabled: false });
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    expect(Date.now() - tappedAt).toBeLessThan(RELEASE_HANDOFF.chromeMs);
  });

  it('plays no arrival and falls back to the existing Return Home when Home never poses', async () => {
    const navigation = makeNavigation();
    const fallback = jest.fn();
    await run(handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback }, { reduceMotion: false }));
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(navigation.setOptions).not.toHaveBeenCalled();
    expect(navigation.popToTop).not.toHaveBeenCalled();
  });

  it('falls back at once, staging nothing, when there is no Home beneath to pop to', async () => {
    const fallback = jest.fn();
    await expect(handOffReleaseToHome(makeNavigation(false), { anchorId: 'released-1', fallback }, { reduceMotion: false })).resolves.toBe('started');
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();

    const bare = jest.fn();
    handOffReleaseToHome({}, { anchorId: 'released-1', fallback: bare }, { reduceMotion: false });
    expect(bare).toHaveBeenCalledTimes(1);
  });

  it('falls back at once when no Anchor is left for Home to arrive on', async () => {
    mockAnchors.length = 0;
    mockAnchors.push(anchor('released-1', { isReleased: true }));
    const fallback = jest.fn();
    await handOffReleaseToHome(makeNavigation(), { anchorId: 'released-1', fallback }, { reduceMotion: false });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
  });

  it('starts once per release: a second tap, or a remount, stages and navigates nothing more', async () => {
    const unsubscribe = homeAnswers();
    const navigation = makeNavigation();
    const first = handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false });
    // While the first is running, a second tap is ignored.
    await expect(handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false })).resolves.toBe('ignored');
    await expect(run(first)).resolves.toBe('started');
    // Once it is done, the same release is still not started again.
    await expect(handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false })).resolves.toBe('ignored');
    unsubscribe();
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  });

  it('plays no sound and no haptic of its own', async () => {
    const unsubscribe = homeAnswers();
    await run(handOffReleaseToHome(makeNavigation(), { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    expect(mockPlayCreationSound).not.toHaveBeenCalled();
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(safeHaptics.selection).not.toHaveBeenCalled();
    expect(safeHaptics.notification).not.toHaveBeenCalled();
  });

  it('clears the arrival if Home never plays it', async () => {
    const unsubscribe = homeAnswers();
    await run(handOffReleaseToHome(makeNavigation(), { anchorId: 'released-1', fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival).not.toBeNull();
    jest.advanceTimersByTime(RELEASE_HANDOFF.expiryMs + 1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
  });

  it('still returns the ordinary way if the route change throws', async () => {
    const unsubscribe = homeAnswers();
    const navigation = makeNavigation();
    navigation.setOptions.mockImplementation(() => { throw new Error('no navigator'); });
    const fallback = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await run(handOffReleaseToHome(navigation, { anchorId: 'released-1', fallback }, { reduceMotion: false }));
    unsubscribe();
    warn.mockRestore();
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
  });
});
