import React from 'react';
import { act, render } from '@testing-library/react-native';

const mockPlayCreationSound = jest.fn();
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (...args: unknown[]) => mockPlayCreationSound(...args) }));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: jest.fn() },
}));

import {
  ARRIVAL_TIMING,
  HomeArrivalProvider,
  LOWER_SLIDE_DISTANCE,
  NEIGHBOUR_ARRIVAL_SHIFT,
  arrivalDuration,
  arrivalWindows,
  homeArrivalCelebrationId,
  releaseArtFactors,
  releaseArtParams,
  resetPlayedPracticeArrivalsForTests,
  useHomeArrival,
} from '../homeArrival';
import { HomeArrivalCounter } from '../HomeArrivalCounter';
import { useHomeArrivalStore, type HomeArrival } from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { safeHaptics } from '@/utils/haptics';

const hookResult: { current: ReturnType<typeof useHomeArrival> | null } = { current: null };

/** A Home with a counter in it: it reports nothing (a release has no mark to measure). */
function Home({ selected = ['next-1'], reduceMotion = false, index = 0, total = 2, active = true }: {
  selected?: Array<string | undefined>;
  reduceMotion?: boolean;
  index?: number;
  total?: number;
  active?: boolean;
}) {
  const arrival = useHomeArrival({ selectedAnchorIds: selected, onPose: jest.fn(), reduceMotion });
  hookResult.current = arrival;
  return (
    <HomeArrivalProvider value={arrival.context}>
      <HomeArrivalCounter index={index} total={total} active={active} style={{ fontSize: 10 }} />
    </HomeArrivalProvider>
  );
}

const stageRelease = (extra: Partial<HomeArrival> = {}) =>
  useHomeArrivalStore.getState().stage({ anchorId: '', kind: 'release', svg: '', fromRect: null, countBefore: 3, ...extra });

beforeEach(() => {
  jest.useFakeTimers();
  resetPlayedPracticeArrivalsForTests();
  hookResult.current = null;
  mockPlayCreationSound.mockClear();
  jest.mocked(safeHaptics.impact).mockClear();
  jest.mocked(safeHaptics.selection).mockClear();
  jest.mocked(safeHaptics.notification).mockClear();
  act(() => useHomeArrivalStore.setState({ arrival: null }));
  act(() => useCelebrationStore.getState().reset());
  act(() => useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', false));
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Return Home: timing and windows', () => {
  it('gives the release arrival its own 2200ms and leaves the other kinds alone', () => {
    expect(ARRIVAL_TIMING.release).toBe(2200);
    expect(ARRIVAL_TIMING.practice).toBe(2400);
    expect(ARRIVAL_TIMING.withFlight).toBe(1700);
    expect(ARRIVAL_TIMING.firstWithFlight).toBe(3400);
    expect(ARRIVAL_TIMING.withoutFlight).toBe(700);
    // It never flies, so its length does not depend on a flight; only Reduce Motion shortens it.
    expect(arrivalDuration('release', false)).toBe(2200);
    expect(arrivalDuration('release', true)).toBe(2200);
    expect(arrivalDuration('release', false, true)).toBe(700);
    expect(arrivalDuration('practice', true)).toBe(2400);
    expect(arrivalDuration('repeat', true)).toBe(1700);
    expect(arrivalDuration('repeat', false)).toBe(700);
  });

  it('runs the lower panel 550 to 1250, the neighbours 600 to 1200 and the counter 800 to 1200 on the prototype times', () => {
    const w = arrivalWindows('release', false);
    const at = (ms: number) => ms / 2200;
    expect(w.lower[0]).toBeCloseTo(at(550));
    expect(w.lower[1]).toBeCloseTo(at(1250));
    expect(w.lowerSlide).toBe(LOWER_SLIDE_DISTANCE);
    expect(LOWER_SLIDE_DISTANCE).toBe(380);
    expect(w.neighbours?.[0]).toBeCloseTo(at(600));
    expect(w.neighbours?.[1]).toBeCloseTo(at(1200));
    expect(w.counter?.[0]).toBeCloseTo(at(800));
    expect(w.counter?.[1]).toBeCloseTo(at(1200));
    // Home's header and hero arrive over 600 to 1100: where the route changes, ending at the prototype's 1100.
    expect(w.header[0]).toBeCloseTo(at(600));
    expect(w.header[1]).toBeCloseTo(at(1100));
    expect(w.hero[0]).toBeCloseTo(at(600));
    expect(w.hero[1]).toBeCloseTo(at(1100));
    expect(w.easeOut).toBe(true);
  });

  it('uses the short crossfade, with no slide, no roll and no neighbour motion, under Reduce Motion', () => {
    const w = arrivalWindows('release', false, true);
    expect(w).toEqual(arrivalWindows('repeat', false));
    expect(w.lowerSlide).toBeUndefined();
    expect(w.counter).toBeUndefined();
    expect(w.neighbours).toBeUndefined();
  });

  it('leaves the first, repeat and practice windows exactly as they were', () => {
    expect(arrivalWindows('repeat', true)).toMatchObject({ flight: [0, 0.52], overlayOut: [0.54, 0.72], hero: [0.5, 0.72] });
    expect(arrivalWindows('first', true)).toMatchObject({ flight: [0, 0.38], hero: [0.38, 0.55], lower: [0.55, 0.95] });
    expect(arrivalWindows('practice', true).swap).toBeDefined();
    expect(arrivalWindows('repeat', true).lowerSlide).toBeUndefined();
    expect(arrivalWindows('practice', false)).toEqual(arrivalWindows('repeat', false));
    expect(arrivalWindows('repeat', true).counter).toBeUndefined();
  });

  it('moves a neighbour out from the centre while it fades in, and settles the centre art from .94 to 1', () => {
    const motion = hookMotion();
    const params = releaseArtParams(motion);
    expect(params.on).toBe(true);
    const start = releaseArtFactors(0, params, 0);
    const end = releaseArtFactors(1, params, 0);
    expect(start.scale).toBeCloseTo(0.94);
    expect(end.scale).toBeCloseTo(1);
    // The left neighbour starts closer to the centre (positive x) and rests at 0; the right one mirrors it.
    expect(releaseArtFactors(0, params, -1)).toMatchObject({ opacity: 0, x: NEIGHBOUR_ARRIVAL_SHIFT });
    expect(releaseArtFactors(0, params, 1)).toMatchObject({ opacity: 0, x: -NEIGHBOUR_ARRIVAL_SHIFT });
    expect(releaseArtFactors(1, params, -1)).toMatchObject({ opacity: 1, x: 0 });
    expect(releaseArtFactors(1, params, 1)).toMatchObject({ opacity: 1, x: -0 });
    // Without a release motion nothing moves.
    expect(releaseArtParams(null).on).toBe(false);
  });
});

function hookMotion() {
  const view = render(<Home />);
  let id = 0;
  act(() => { id = stageRelease(); });
  const motion = hookResult.current?.context.release ?? null;
  expect(motion).not.toBeNull();
  act(() => { useHomeArrivalStore.getState().clear(id); });
  view.unmount();
  return motion;
}

describe('Return Home: the arrival', () => {
  it('is ready the moment Home is posed: no mark to measure, no target, no flight', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageRelease(); });
    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival).toMatchObject({ id, kind: 'release', fromRect: null, targetRect: null, phase: 'ready' });
    expect(hookResult.current?.flight).toBe(false);
    expect(hookResult.current?.context.progress.value).toBe(0);
  });

  it('is active for whichever Anchor Home now selects, and for none when Home has none', () => {
    const selecting = render(<Home selected={['a-different-id', undefined]} />);
    act(() => { stageRelease(); });
    expect(hookResult.current?.arrival?.kind).toBe('release');
    act(() => { useHomeArrivalStore.getState().clear(); });
    selecting.unmount();

    render(<Home selected={[undefined, undefined]} />);
    act(() => { stageRelease(); });
    expect(hookResult.current?.arrival).toBeNull();
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('staging');
  });

  it('registers as a non-skippable level 2 scene of 2200ms under the usual home-arrival id, and clears itself', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageRelease(); });
    act(() => { useHomeArrivalStore.getState().release(id); });

    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(useCelebrationStore.getState().current?.durationMs).toBe(2200);
    expect(useCelebrationStore.getState().skip()).toBe(false);

    act(() => { jest.advanceTimersByTime(2200 + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(hookResult.current?.context.progress.value).toBe(1);
  });

  it('does not use up the first-Anchor flag', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageRelease(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useTeachingStore.getState().userFlags.hasSeenFirstAnchorArrival).toBe(false);
  });

  it('does not start a second time when Home remounts mid-arrival: the remounted Home lands settled', () => {
    const first = render(<Home />);
    let id = 0;
    act(() => { id = stageRelease(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active?.id).toBe(homeArrivalCelebrationId(id));

    first.unmount();
    expect(useCelebrationStore.getState().active).toBeNull();

    render(<Home />);
    // The arrival is still 'arriving' in the store; the new Home must not replay it.
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(hookResult.current?.context.progress.value).toBe(1);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('lands on its settled end state and releases the coordinator when a higher scene preempts it', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageRelease(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    act(() => { useCelebrationStore.getState().request(4, 'other-major', { durationMs: 4000 }); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(hookResult.current?.context.progress.value).toBe(1);
    expect(useCelebrationStore.getState().active?.id).toBe('other-major');
  });

  it('under Reduce Motion plays the short crossfade as a level 2 scene, with no motion windows, and ends settled', () => {
    render(<Home reduceMotion />);
    let id = 0;
    act(() => { id = stageRelease(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(hookResult.current?.context.release).toBeNull();
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(useCelebrationStore.getState().current?.durationMs).toBe(ARRIVAL_TIMING.withoutFlight);

    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.withoutFlight + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(hookResult.current?.context.progress.value).toBe(1);
  });

  it('plays no sound and no haptic', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageRelease(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    act(() => { jest.advanceTimersByTime(2200 + 100); });
    expect(mockPlayCreationSound).not.toHaveBeenCalled();
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(safeHaptics.selection).not.toHaveBeenCalled();
    expect(safeHaptics.notification).not.toHaveBeenCalled();
  });

  it('never gives a late measurement a target: nothing flies', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageRelease(); });
    act(() => { useHomeArrivalStore.getState().reportReady(id, { x: 1, y: 2, width: 3, height: 4 }); });
    expect(useHomeArrivalStore.getState().arrival?.targetRect).toBeNull();
  });
});

describe('Return Home: the counter', () => {
  const roll = (view: ReturnType<typeof render>) => view.queryByTestId('v2-home-counter-roll');

  it('rolls down by one, from the previous count to the new one, when Home now counts fewer', () => {
    const view = render(<Home total={2} />);
    act(() => { stageRelease({ countBefore: 3 }); });
    expect(roll(view)).toBeTruthy();
    expect(view.getByTestId('v2-home-counter-before').props.children).toBe(3);
    expect(view.getByTestId('v2-home-counter-after').props.children).toBe(2);
    expect(view.getByText('1 OF ')).toBeTruthy();
  });

  it.each([
    ['the count did not decrease', 2],
    ['the previous count is unknown', null],
    ['the count went up', 1],
  ])('does not roll when %s', (_label, countBefore) => {
    const view = render(<Home total={2} />);
    act(() => { stageRelease({ countBefore }); });
    expect(roll(view)).toBeNull();
    expect(view.getByText('1 OF 2')).toBeTruthy();
  });

  it('does not roll for a neighbour\'s counter, or under Reduce Motion, or when no arrival is playing', () => {
    const neighbour = render(<Home total={2} active={false} />);
    act(() => { stageRelease({ countBefore: 3 }); });
    expect(roll(neighbour)).toBeNull();
    neighbour.unmount();
    act(() => { useHomeArrivalStore.getState().clear(); });

    const reduced = render(<Home total={2} reduceMotion />);
    act(() => { stageRelease({ countBefore: 3 }); });
    expect(roll(reduced)).toBeNull();
    expect(reduced.getByText('1 OF 2')).toBeTruthy();
    reduced.unmount();
    act(() => { useHomeArrivalStore.getState().clear(); });

    const idle = render(<Home total={2} />);
    expect(roll(idle)).toBeNull();
    expect(idle.getByText('1 OF 2')).toBeTruthy();
  });

  it('is the plain counter again once the arrival has ended', () => {
    const view = render(<Home total={2} />);
    let id = 0;
    act(() => { id = stageRelease({ countBefore: 3 }); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(roll(view)).toBeTruthy();
    act(() => { jest.advanceTimersByTime(2200 + 100); });
    expect(roll(view)).toBeNull();
    expect(view.getByText('1 OF 2')).toBeTruthy();
  });
});
