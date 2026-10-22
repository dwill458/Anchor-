import { PRACTICE_HANDOFF, handOffPracticeToHome, resetPracticeHandoffForTests } from '../practiceHandoff';
import { useHomeArrivalStore, type ArrivalRect } from '@/stores/v2/homeArrivalStore';
import { offerPracticeDeparture, takePracticeDeparture, type PracticeDeparture } from '@/stores/v2/practiceDeparture';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const FROM: ArrivalRect = { x: 100, y: 180, width: 130, height: 130 };
const TARGET: ArrivalRect = { x: 140, y: 200, width: 110, height: 110 };
const anchor = makeAnchor({ id: 'anchor-1', category: 'desire' });

const makeNavigation = () => {
  const calls: string[] = [];
  return {
    calls,
    setOptions: jest.fn((options: { animation?: string }) => { calls.push(`options:${options.animation}`); }),
    navigate: jest.fn((name: string) => { calls.push(`navigate:${name}`); }),
  };
};

const makeDeparture = (overrides: Partial<PracticeDeparture> = {}): PracticeDeparture => ({
  sessionId: 'session-1',
  at: Date.now(),
  measure: jest.fn(async () => ({
    fromRect: FROM,
    number: { text: '52%', rect: { x: 40, y: 500, width: 44, height: 24 } },
    glow: { color: '#EDE3D0', opacity: 0.38, scale: 1.2 },
  })),
  ...overrides,
});

/** Plays Home's part: report ready as soon as the arrival is staged. */
const homeAnswers = (target: ArrivalRect | null) =>
  useHomeArrivalStore.subscribe((state) => {
    if (state.arrival?.phase === 'staging') state.reportReady(state.arrival.id, target);
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
  resetPracticeHandoffForTests();
  useHomeArrivalStore.setState({ arrival: null });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('handOffPracticeToHome', () => {
  it('stages a practice arrival with the complete screen artwork as its fromRect, then leaves with no transition', async () => {
    const unsubscribe = homeAnswers(TARGET);
    const navigation = makeNavigation();
    const departure = makeDeparture();
    await expect(run(handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: false }))).resolves.toBe('started');
    unsubscribe();

    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival).toMatchObject({
      kind: 'practice',
      anchorId: 'anchor-1',
      sessionId: 'session-1',
      fromRect: FROM,
      targetRect: TARGET,
      phase: 'arriving',
    });
    expect(arrival.number).toMatchObject({ text: '52%' });
    expect(arrival.glow).toMatchObject({ opacity: 0.38 });
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'none', gestureEnabled: false });
    expect(navigation.navigate).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('releases the arrival before the route changes, and changes it only after the chrome has faded', async () => {
    const releases: string[] = [];
    const unsubscribe = homeAnswers(TARGET);
    const stopWatching = useHomeArrivalStore.subscribe((state, previous) => {
      if (state.arrival?.phase === 'arriving' && previous.arrival?.phase !== 'arriving') releases.push('release');
    });
    const navigation = makeNavigation();
    navigation.navigate.mockImplementation((name: string) => { releases.push(`navigate:${name}`); });
    const departure = makeDeparture({ at: Date.now() });
    await run(handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: false }));
    unsubscribe();
    stopWatching();
    expect(releases).toEqual(['release', 'navigate:V2DevelopmentHome']);
    // The route change waited out the 300ms the complete screen needs to fade.
    expect(Date.now() - departure.at).toBeGreaterThanOrEqual(PRACTICE_HANDOFF.chromeMs);
  });

  it('under Reduce Motion stages no flight and fades, measuring nothing', async () => {
    const unsubscribe = homeAnswers(null);
    const navigation = makeNavigation();
    const departure = makeDeparture();
    await run(handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: true }));
    unsubscribe();

    expect(departure.measure).not.toHaveBeenCalled();
    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival.fromRect).toBeNull();
    expect(arrival.number).toBeNull();
    expect(arrival.phase).toBe('arriving');
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'fade', gestureEnabled: false });
    expect(navigation.navigate).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('drops the flight and crossfades when Home answers but could not measure where the mark lands', async () => {
    const unsubscribe = homeAnswers(null);
    const navigation = makeNavigation();
    await run(handOffPracticeToHome(navigation, { anchor, departure: makeDeparture() }, { reduceMotion: false }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival?.fromRect).toBeNull();
    expect(navigation.setOptions).toHaveBeenCalledWith({ animation: 'fade', gestureEnabled: false });
  });

  it('plays no arrival and returns the ordinary way when Home never poses', async () => {
    const navigation = makeNavigation();
    await run(handOffPracticeToHome(navigation, { anchor, departure: makeDeparture() }, { reduceMotion: false }));
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(navigation.setOptions).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('flies without a measurement when the complete screen could not be measured', async () => {
    const unsubscribe = homeAnswers(TARGET);
    const navigation = makeNavigation();
    await run(handOffPracticeToHome(navigation, { anchor, departure: makeDeparture({ measure: async () => null }) }, { reduceMotion: false }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival?.fromRect).toBeNull();
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('still returns when the measurement throws', async () => {
    const unsubscribe = homeAnswers(TARGET);
    const navigation = makeNavigation();
    const departure = makeDeparture({ measure: () => Promise.reject(new Error('no window')) });
    await run(handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: false }));
    unsubscribe();
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('starts once per session: a second tap, or a remount, stages and navigates nothing more', async () => {
    const unsubscribe = homeAnswers(TARGET);
    const navigation = makeNavigation();
    const departure = makeDeparture();
    const first = handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: false });
    // While the first is running, a second tap is ignored.
    await expect(handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: false })).resolves.toBe('ignored');
    await expect(run(first)).resolves.toBe('started');
    // Once it is done, the same session is still not started again.
    await expect(handOffPracticeToHome(navigation, { anchor, departure }, { reduceMotion: false })).resolves.toBe('ignored');
    unsubscribe();
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(departure.measure).toHaveBeenCalledTimes(1);
  });

  it('clears the arrival if Home never plays it', async () => {
    const unsubscribe = homeAnswers(TARGET);
    await run(handOffPracticeToHome(makeNavigation(), { anchor, departure: makeDeparture() }, { reduceMotion: false }));
    unsubscribe();
    expect(useHomeArrivalStore.getState().arrival).not.toBeNull();
    jest.advanceTimersByTime(PRACTICE_HANDOFF.expiryMs + 1);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
  });
});

describe('practice departure hand-off slot', () => {
  it('gives a departure once, and nothing the second time', () => {
    const departure = makeDeparture();
    offerPracticeDeparture(departure);
    expect(takePracticeDeparture()).toBe(departure);
    expect(takePracticeDeparture()).toBeNull();
  });

  it('refuses a stale departure from a tap whose completion went elsewhere', () => {
    const departure = makeDeparture({ at: 1000 });
    offerPracticeDeparture(departure);
    expect(takePracticeDeparture(1000 + 3001)).toBeNull();
  });
});
