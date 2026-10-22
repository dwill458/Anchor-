type MockAnchor = {
  id: string; localId?: string; userId?: string; archivedAt?: Date; isReleased?: boolean;
  baseSigilSvg?: string; category?: string;
};
const mockAnchors: MockAnchor[] = [];
const mockSetCurrentAnchor = jest.fn();
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: { getState: () => ({ anchors: mockAnchors, setCurrentAnchor: mockSetCurrentAnchor }) },
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
}));
const mockPlayCreationSound = jest.fn();
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (...args: unknown[]) => mockPlayCreationSound(...args) }));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: jest.fn() },
}));

import { RELEASE_HANDOFF, handOffEvolvedToHome, resetReleaseHandoffForTests } from '../releaseHandoff';
import { useHomeArrivalStore } from '@/stores/v2/homeArrivalStore';
import { safeHaptics } from '@/utils/haptics';

const RELEASED_ART = { svg: '<svg viewBox="0 0 10 10"><path d="M1 1L9 9"/></svg>', category: 'creativity' };

const anchor = (id: string, extra: Partial<MockAnchor> = {}): MockAnchor => ({ id, localId: id, userId: 'user-1', ...extra });

const makeNavigation = (canGoBack = true) => ({
  setOptions: jest.fn(),
  popToTop: jest.fn(),
  canGoBack: jest.fn(() => canGoBack),
});

/** Plays Home's part: report ready as soon as the arrival is staged (an evolved arrival has nothing to measure). */
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
  mockAnchors.push(
    anchor('old-1', { isReleased: true }),
    anchor('new-1', { baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M9 1L1 9"/></svg>', category: 'creativity' }),
  );
  mockPlayCreationSound.mockClear();
  mockSetCurrentAnchor.mockClear();
  jest.mocked(safeHaptics.impact).mockClear();
  jest.mocked(safeHaptics.selection).mockClear();
  jest.mocked(safeHaptics.notification).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('handOffEvolvedToHome (EV1)', () => {
  it('selects the successor, stages an evolved arrival with the released art and no flight, and starts its clock as Home appears', async () => {
    const order: string[] = [];
    const unsubscribe = homeAnswers();
    const stopWatching = useHomeArrivalStore.subscribe((state, previous) => {
      if (state.arrival?.phase === 'arriving' && previous.arrival?.phase !== 'arriving') order.push('release');
    });
    const navigation = makeNavigation();
    navigation.popToTop.mockImplementation(() => { order.push('popToTop'); });
    const fallback = jest.fn();
    await expect(run(handOffEvolvedToHome(navigation, { successorAnchorId: 'new-1', released: RELEASED_ART, fallback }, { reduceMotion: false }))).resolves.toBe('started');
    unsubscribe();
    stopWatching();

    expect(mockSetCurrentAnchor).toHaveBeenCalledWith('new-1');
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({
      kind: 'evolved', anchorId: 'new-1', fromRect: null, targetRect: null, phase: 'arriving', ghost: RELEASED_ART,
    });
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'none', gestureEnabled: false });
    // The route changes first and the 3.4s clock starts as Home appears, so all of it is seen.
    expect(order).toEqual(['popToTop', 'release']);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('waits out the ending\'s chrome fade before the route changes', async () => {
    const unsubscribe = homeAnswers();
    const tappedAt = Date.now();
    await run(handOffEvolvedToHome(makeNavigation(), { successorAnchorId: 'new-1', released: RELEASED_ART, fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    expect(Date.now() - tappedAt).toBeGreaterThanOrEqual(RELEASE_HANDOFF.chromeMs);
  });

  it('skips the ghost, and nothing else, when the released art is not known', async () => {
    const unsubscribe = homeAnswers();
    const navigation = makeNavigation();
    await run(handOffEvolvedToHome(navigation, { successorAnchorId: 'new-1', fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ kind: 'evolved', anchorId: 'new-1', ghost: null });
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  });

  it('under Reduce Motion stages the same arrival and fades without waiting out the staggered exit', async () => {
    const unsubscribe = homeAnswers();
    const navigation = makeNavigation();
    const tappedAt = Date.now();
    await run(handOffEvolvedToHome(navigation, { successorAnchorId: 'new-1', released: RELEASED_ART, fallback: jest.fn() }, { reduceMotion: true }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ kind: 'evolved', fromRect: null, phase: 'arriving' });
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'fade', gestureEnabled: false });
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    expect(Date.now() - tappedAt).toBeLessThan(RELEASE_HANDOFF.chromeMs);
  });

  it('falls back to the successor\'s Details when Home never poses', async () => {
    const navigation = makeNavigation();
    const fallback = jest.fn();
    await run(handOffEvolvedToHome(navigation, { successorAnchorId: 'new-1', released: RELEASED_ART, fallback }, { reduceMotion: false }));
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(navigation.popToTop).not.toHaveBeenCalled();
  });

  it.each([
    ['there is no Home beneath to pop to', false, 'new-1'],
    ['the successor is not in the store', true, 'missing'],
    ['the successor is itself released', true, 'old-1'],
  ])('falls back at once, staging nothing, when %s', async (_label, canGoBack, successorAnchorId) => {
    const fallback = jest.fn();
    await handOffEvolvedToHome(makeNavigation(canGoBack), { successorAnchorId, released: RELEASED_ART, fallback }, { reduceMotion: false });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(mockSetCurrentAnchor).not.toHaveBeenCalled();
  });

  it('falls back at once for a navigation that cannot pop at all', async () => {
    const fallback = jest.fn();
    await handOffEvolvedToHome({}, { successorAnchorId: 'new-1', released: RELEASED_ART, fallback }, { reduceMotion: false });
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('starts once: a second tap, or a remount, stages and navigates nothing more', async () => {
    const unsubscribe = homeAnswers();
    const navigation = makeNavigation();
    const input = { successorAnchorId: 'new-1', released: RELEASED_ART, fallback: jest.fn() };
    const first = handOffEvolvedToHome(navigation, input, { reduceMotion: false });
    await expect(handOffEvolvedToHome(navigation, input, { reduceMotion: false })).resolves.toBe('ignored');
    await expect(run(first)).resolves.toBe('started');
    await expect(handOffEvolvedToHome(navigation, input, { reduceMotion: false })).resolves.toBe('ignored');
    unsubscribe();
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  });

  it('plays no sound and no haptic of its own', async () => {
    const unsubscribe = homeAnswers();
    await run(handOffEvolvedToHome(makeNavigation(), { successorAnchorId: 'new-1', released: RELEASED_ART, fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    expect(mockPlayCreationSound).not.toHaveBeenCalled();
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(safeHaptics.selection).not.toHaveBeenCalled();
    expect(safeHaptics.notification).not.toHaveBeenCalled();
  });

  it('clears the arrival if Home never plays it', async () => {
    const unsubscribe = homeAnswers();
    await run(handOffEvolvedToHome(makeNavigation(), { successorAnchorId: 'new-1', released: RELEASED_ART, fallback: jest.fn() }, { reduceMotion: false }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival).not.toBeNull();
    jest.advanceTimersByTime(RELEASE_HANDOFF.expiryMs + 1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
  });
});
