import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import {
  ARRIVAL_TIMING,
  HomeArrivalOverlay,
  HomeArrivalProvider,
  arrivalDuration,
  arrivalWindows,
  homeArrivalCelebrationId,
  resetPlayedPracticeArrivalsForTests,
  useHomeArrival,
  useHomeArrivalContext,
} from '../homeArrival';
import {
  useHomeArrivalStore,
  type ArrivalRect,
  type HomeArrival,
  type HomeArrivalKind,
} from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useTeachingStore } from '@/stores/teachingStore';

const TARGET = { x: 120, y: 200, width: 110, height: 110 };
const FROM = { x: 60, y: 260, width: 130, height: 130 };

const captured: { current: ReturnType<typeof useHomeArrivalContext> } = { current: null };
const hookResult: { current: ReturnType<typeof useHomeArrival> | null } = { current: null };

function Hero() {
  const arrival = useHomeArrivalContext();
  captured.current = arrival;
  useEffect(() => {
    if (arrival?.active && arrival.phase === 'staging') arrival.reportTarget(TARGET);
  }, [arrival]);
  return <Text testID="phase">{arrival?.phase ?? 'none'}</Text>;
}

function Home({ selected = 'anchor-1', reduceMotion = false }: { selected?: string; reduceMotion?: boolean }) {
  const arrival = useHomeArrival({ selectedAnchorIds: [selected], onPose: jest.fn(), reduceMotion });
  hookResult.current = arrival;
  useEffect(() => {
    if (arrival.arrival) arrival.reportOrigin({ x: 0, y: 0 });
  }, [arrival.arrival, arrival.reportOrigin]);
  return (
    <HomeArrivalProvider value={arrival.context}>
      <Hero />
    </HomeArrivalProvider>
  );
}

const stagePractice = (fromRect: ArrivalRect | null = FROM, extra: Partial<HomeArrival> = {}) =>
  useHomeArrivalStore.getState().stage({
    anchorId: 'anchor-1',
    kind: 'practice',
    svg: '<svg/>',
    category: 'career',
    sessionId: 'session-1',
    fromRect,
    ...extra,
  });

const stage = (kind: HomeArrivalKind, fromRect: ArrivalRect | null = FROM) =>
  useHomeArrivalStore.getState().stage({ anchorId: 'anchor-1', kind, svg: '<svg/>', category: 'career', expression: 'foil', fromRect });

beforeEach(() => {
  jest.useFakeTimers();
  resetPlayedPracticeArrivalsForTests();
  hookResult.current = null;
  act(() => useHomeArrivalStore.setState({ arrival: null }));
  act(() => useCelebrationStore.getState().reset());
  act(() => useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', false));
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Complete to Home: timing and windows', () => {
  it('gives the practice arrival its own 2400ms and leaves the other kinds alone', () => {
    expect(ARRIVAL_TIMING.practice).toBe(2400);
    expect(ARRIVAL_TIMING.withFlight).toBe(1700);
    expect(ARRIVAL_TIMING.firstWithFlight).toBe(3400);
    expect(ARRIVAL_TIMING.withoutFlight).toBe(700);
    expect(arrivalDuration('practice', true)).toBe(2400);
    expect(arrivalDuration('practice', false)).toBe(700);
    expect(arrivalDuration('repeat', true)).toBe(1700);
    expect(arrivalDuration('first', true)).toBe(3400);
  });

  it('flies the mark from 350ms to 1100ms and brings Home in around it on the prototype times', () => {
    const w = arrivalWindows('practice', true);
    const at = (ms: number) => ms / 2400;
    expect(w.flight[0]).toBeCloseTo(at(350));
    expect(w.flight[1]).toBeCloseTo(at(1100));
    // Header and the ink lower panel arrive 400 to 1100.
    expect(w.header[0]).toBeCloseTo(at(400));
    expect(w.header[1]).toBeCloseTo(at(1100));
    expect(w.lower[0]).toBeCloseTo(at(400));
    expect(w.lower[1]).toBeCloseTo(at(1100));
    // The hero (and the number inside it) arrives only once the mark has landed: never a second mark mid-flight.
    expect(w.hero[0]).toBeCloseTo(w.flight[1]);
    expect(w.hero[1]).toBeCloseTo(at(1500));
    expect(w.overlayOut[1]).toBeCloseTo(w.hero[1]);
    // Today's card swaps 1400 to 1800, after the hero is in.
    expect(w.swap?.[0]).toBeCloseTo(at(1400));
    expect(w.swap?.[1]).toBeCloseTo(at(1800));
    expect(w.swap![0]).toBeGreaterThanOrEqual(w.hero[1] - 0.05);
    expect(w.numberOut?.[1]).toBeLessThanOrEqual(w.hero[1]);
  });

  it('leaves the first and repeat windows exactly as they were, and gives them no swap', () => {
    expect(arrivalWindows('repeat', true)).toMatchObject({ flight: [0, 0.52], overlayOut: [0.54, 0.72], hero: [0.5, 0.72] });
    expect(arrivalWindows('repeat', true).swap).toBeUndefined();
    expect(arrivalWindows('first', true)).toMatchObject({ flight: [0, 0.38], hero: [0.38, 0.55], lower: [0.55, 0.95] });
    expect(arrivalWindows('first', true).swap).toBeUndefined();
  });

  it('uses the same short crossfade for a practice that cannot fly', () => {
    expect(arrivalWindows('practice', false)).toEqual(arrivalWindows('repeat', false));
    expect(arrivalWindows('practice', false).swap).toBeUndefined();
  });
});

describe('Complete to Home: the arrival', () => {
  it('is staged with the complete screen artwork as its fromRect and poses Home like any arrival', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stagePractice(); });
    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival).toMatchObject({ id, kind: 'practice', fromRect: FROM, sessionId: 'session-1', phase: 'ready', targetRect: TARGET });
    expect(hookResult.current?.arrival?.kind).toBe('practice');
    expect(hookResult.current?.flight).toBe(true);
  });

  it('registers as a non-skippable level 2 scene of 2400ms under the usual home-arrival id, and clears itself', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stagePractice(); });
    act(() => { useHomeArrivalStore.getState().release(id); });

    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(useCelebrationStore.getState().current?.durationMs).toBe(2400);
    expect(useCelebrationStore.getState().skip()).toBe(false);

    act(() => { jest.advanceTimersByTime(2400 + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(captured.current?.progress.value).toBe(1);
  });

  it('does not use up the first-Anchor flag', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stagePractice(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useTeachingStore.getState().userFlags.hasSeenFirstAnchorArrival).toBe(false);
  });

  it('never waits for the hero image: no overlay hold even with a finished image', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stagePractice(FROM, { imageUrl: 'https://assets.test/art.png' }); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(captured.current?.overlayHold.value).toBe(0);
    act(() => { jest.advanceTimersByTime(2400 + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
  });

  it('lands on its settled end state and releases the coordinator when a higher scene preempts it', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stagePractice(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    act(() => { useCelebrationStore.getState().request(4, 'other-major', { durationMs: 4000 }); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(captured.current?.progress.value).toBe(1);
    expect(useCelebrationStore.getState().active?.id).toBe('other-major');
  });

  it('shares the coordinator id with a remount: asking twice never makes a second active scene', () => {
    const id = 7;
    const celebrationId = homeArrivalCelebrationId(id);
    expect(useCelebrationStore.getState().request(2, celebrationId, { durationMs: 2400 })).toBe('play');
    expect(useCelebrationStore.getState().request(2, celebrationId, { durationMs: 2400 })).toBe('duplicate');
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(useCelebrationStore.getState().active?.id).toBe(celebrationId);
  });

  it('does not start a second time when Home remounts mid-arrival: the remounted Home lands settled', () => {
    const first = render(<Home />);
    let id = 0;
    act(() => { id = stagePractice(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active?.id).toBe(homeArrivalCelebrationId(id));

    first.unmount();
    expect(useCelebrationStore.getState().active).toBeNull();

    render(<Home />);
    // The arrival is still 'arriving' in the store; the new Home must not replay it.
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(captured.current?.progress.value).toBe(1);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('under Reduce Motion plays the short crossfade as a level 2 scene and ends settled, with no flight', () => {
    render(<Home reduceMotion />);
    let id = 0;
    act(() => { id = stagePractice(null); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(hookResult.current?.flight).toBe(false);
    expect(hookResult.current?.swapsToday).toBe(false);
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(useCelebrationStore.getState().current?.durationMs).toBe(ARRIVAL_TIMING.withoutFlight);

    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.withoutFlight + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(captured.current?.progress.value).toBe(1);
  });

  it('a flying practice plays the card swap; a repeat Anchor never does', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stagePractice(); });
    expect(hookResult.current?.swapsToday).toBe(true);
    act(() => { useHomeArrivalStore.getState().clear(id); });

    let other = 0;
    act(() => { other = stage('repeat'); });
    expect(hookResult.current?.swapsToday).toBe(false);
    act(() => { useHomeArrivalStore.getState().clear(other); });
  });

  it('leaves the repeat arrival as it was: level 2, 1700ms, not skippable', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stage('repeat'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(useCelebrationStore.getState().current?.durationMs).toBe(1700);
  });
});

describe('Complete to Home: the overlay', () => {
  const arrivalOf = (extra: Partial<HomeArrival>): HomeArrival => ({
    id: 1,
    anchorId: 'anchor-1',
    kind: 'practice',
    svg: '<svg/>',
    category: 'career',
    fromRect: FROM,
    targetRect: TARGET,
    phase: 'arriving',
    ...extra,
  });
  const progress = { value: 0 } as never;
  const number = { text: '52%', rect: { x: 40, y: 500, width: 44, height: 24 } };
  const glow = { color: '#EDE3D0', opacity: 0.38, scale: 1.2 };

  it('carries the glow with the mark and holds the complete screen figure in place while it flies', () => {
    const view = render(
      <HomeArrivalOverlay arrival={arrivalOf({ number, glow })} progress={progress} origin={{ x: 0, y: 0 }} onOrigin={jest.fn()} flight />,
    );
    expect(view.queryByTestId('v2-home-arrival-glow')).toBeTruthy();
    expect(view.getByTestId('v2-home-arrival-number').props.children).toBe('52%');
  });

  it('draws neither without a flight, so a figure that cannot fade out is never left behind', () => {
    const view = render(
      <HomeArrivalOverlay arrival={arrivalOf({ number, glow, fromRect: null })} progress={progress} origin={{ x: 0, y: 0 }} onOrigin={jest.fn()} flight={false} />,
    );
    expect(view.queryByTestId('v2-home-arrival-number')).toBeNull();
  });

  it('never draws them for a created Anchor', () => {
    const view = render(
      <HomeArrivalOverlay arrival={arrivalOf({ kind: 'repeat', number, glow })} progress={progress} origin={{ x: 0, y: 0 }} onOrigin={jest.fn()} flight />,
    );
    expect(view.queryByTestId('v2-home-arrival-glow')).toBeNull();
    expect(view.queryByTestId('v2-home-arrival-number')).toBeNull();
  });
});
