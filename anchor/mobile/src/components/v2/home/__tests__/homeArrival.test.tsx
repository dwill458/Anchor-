import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import {
  ARRIVAL_TIMING,
  HomeArrivalProvider,
  arrivalWindows,
  homeArrivalCelebrationId,
  useHomeArrival,
  useHomeArrivalContext,
} from '../homeArrival';
import { useHomeArrivalStore, whenHomeReady, type ArrivalRect, type HomeArrivalKind } from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useTeachingStore } from '@/stores/teachingStore';

const TARGET = { x: 120, y: 200, width: 110, height: 110 };
const FROM = { x: 60, y: 260, width: 280, height: 280 };

/** The provider value of the most recently rendered Home, for asserting on its shared values. */
const captured: { current: ReturnType<typeof useHomeArrivalContext> } = { current: null };

function Hero({ report }: { report: boolean }) {
  const arrival = useHomeArrivalContext();
  captured.current = arrival;
  useEffect(() => {
    if (report && arrival?.active && arrival.phase === 'staging') arrival.reportTarget(TARGET);
  }, [arrival, report]);
  return <Text testID="phase">{arrival?.phase ?? 'none'}</Text>;
}

function Home({
  selected,
  onPose,
  report = true,
  reduceMotion = false,
}: {
  selected: string;
  onPose: () => void;
  report?: boolean;
  reduceMotion?: boolean;
}) {
  const arrival = useHomeArrival({ selectedAnchorIds: [selected], onPose, reduceMotion });
  useEffect(() => {
    // The overlay measures its own position on layout.
    if (arrival.arrival) arrival.reportOrigin({ x: 0, y: 0 });
  }, [arrival.arrival, arrival.reportOrigin]);
  return (
    <HomeArrivalProvider value={arrival.context}>
      <Hero report={report} />
    </HomeArrivalProvider>
  );
}

const stage = (anchorId = 'anchor-1', kind: HomeArrivalKind = 'repeat', fromRect: ArrivalRect | null = FROM) =>
  useHomeArrivalStore.getState().stage({ anchorId, kind, svg: '<svg/>', category: 'career', expression: 'foil', fromRect });

beforeEach(() => {
  jest.useFakeTimers();
  act(() => useHomeArrivalStore.setState({ arrival: null }));
  act(() => useCelebrationStore.getState().reset());
  act(() => useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', false));
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Home arrival', () => {
  it('poses Home for the arriving Anchor and reports where the mark will rest', () => {
    const onPose = jest.fn();
    render(<Home selected="anchor-1" onPose={onPose} />);
    let id = 0;
    act(() => { id = stage(); });
    expect(onPose).toHaveBeenCalledTimes(1);
    const arrival = useHomeArrivalStore.getState().arrival!;
    expect(arrival.id).toBe(id);
    expect(arrival.phase).toBe('ready');
    expect(arrival.targetRect).toEqual(TARGET);
  });

  it('ignores an arrival for a different Anchor', () => {
    const onPose = jest.fn();
    render(<Home selected="anchor-2" onPose={onPose} />);
    act(() => { stage('anchor-1'); });
    expect(onPose).not.toHaveBeenCalled();
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('staging');
  });

  it('is ready without a flight if the hero cannot be measured in time', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} report={false} />);
    act(() => { stage(); });
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('staging');
    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.measureWait + 1); });
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('ready');
    expect(useHomeArrivalStore.getState().arrival?.targetRect).toBeNull();
  });

  it('plays once released and then clears itself', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('arriving');
    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.withFlight + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
  });
});

describe('first-arrival once-ever flag', () => {
  const seen = () => useTeachingStore.getState().userFlags.hasSeenFirstAnchorArrival;

  it('is set when a first arrival starts playing', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first'); });
    expect(seen()).toBe(false);
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(seen()).toBe(true);
  });

  it('is not used up by a first arrival that is staged and never plays', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    act(() => { stage('anchor-1', 'first'); });
    act(() => { useHomeArrivalStore.getState().clear(); });
    expect(seen()).toBe(false);
  });

  it('is not set by a repeat arrival', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'repeat'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(seen()).toBe(false);
  });

  it('is set by a first arrival under Reduce Motion too', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} reduceMotion />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first', null); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(seen()).toBe(true);
  });

  it('is written once per arrival, not again when that arrival re-renders', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    act(() => { useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', false); });
    act(() => { useHomeArrivalStore.setState((state) => ({ arrival: state.arrival && { ...state.arrival } })); });
    expect(seen()).toBe(false);
  });
});

describe('arrival that cannot fly', () => {
  it('registers as a level 2 crossfade even for the first Anchor', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} report={false} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first'); });
    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.measureWait + 1); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useHomeArrivalStore.getState().arrival?.targetRect).toBeNull();
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
  });
});

describe('whenHomeReady', () => {
  it('resolves true when Home reports ready and false on timeout', async () => {
    let id = 0;
    act(() => { id = stage(); });
    const ready = whenHomeReady(id, 500);
    act(() => { useHomeArrivalStore.getState().reportReady(id, TARGET); });
    await expect(ready).resolves.toBe(true);

    let other = 0;
    act(() => { other = stage('anchor-2'); });
    const late = whenHomeReady(other, 500);
    act(() => { jest.advanceTimersByTime(501); });
    await expect(late).resolves.toBe(false);
  });
});

describe('arrival timing and windows by kind', () => {
  it('keeps the repeat timings and gives the first Anchor its longer flight', () => {
    expect(ARRIVAL_TIMING.withFlight).toBe(1700);
    expect(ARRIVAL_TIMING.withoutFlight).toBe(700);
    expect(ARRIVAL_TIMING.firstWithFlight).toBe(3400);
  });

  it('flies the repeat mark over the original windows', () => {
    expect(arrivalWindows('repeat', true)).toMatchObject({ flight: [0, 0.52], overlayOut: [0.54, 0.72], hero: [0.5, 0.72] });
  });

  it('flies the first mark over the first 38% with the stretched windows', () => {
    expect(arrivalWindows('first', true)).toMatchObject({
      flight: [0, 0.38],
      environment: [0.1, 0.4],
      header: [0.35, 0.65],
      hero: [0.38, 0.55],
      overlayOut: [0.4, 0.55],
      lower: [0.55, 0.95],
    });
  });

  it('uses the same short crossfade windows for either kind when there is no flight', () => {
    expect(arrivalWindows('first', false)).toEqual(arrivalWindows('repeat', false));
    expect(arrivalWindows('first', false).lower).toEqual([0.35, 1]);
  });
});

describe('arrival celebration hand-off', () => {
  it('requests a skippable level 4 scene for the first Anchor and clears when it ends', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 4, skippable: true });

    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.firstWithFlight + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
  });

  it('requests a non-skippable level 2 scene for a repeat Anchor', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'repeat'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });

    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.withFlight + 100); });
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('lands the first arrival on its settled end state when skipped', () => {
    const reanimated = require('react-native-reanimated');
    jest.spyOn(reanimated, 'withTiming').mockImplementation((...args: unknown[]) => {
      const [target] = args as [number];
      // Keep the flight in progress until skip() explicitly lands it.
      return target === 1 ? 0 : target;
    });
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(captured.current?.progress.value).toBeLessThan(1);

    let skipped = false;
    act(() => { skipped = useCelebrationStore.getState().skip(); });
    expect(skipped).toBe(true);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(captured.current?.progress.value).toBe(1);
    expect(captured.current?.overlayHold.value).toBe(0);
  });

  it('cannot be skipped when it is a repeat Anchor', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'repeat'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    let skipped = true;
    act(() => { skipped = useCelebrationStore.getState().skip(); });
    expect(skipped).toBe(false);
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('arriving');
  });

  it('is landed on its end state when a higher celebration preempts it', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'repeat'); });
    act(() => { useHomeArrivalStore.getState().release(id); });

    act(() => { useCelebrationStore.getState().request(4, 'other-major', { durationMs: 4000 }); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(captured.current?.progress.value).toBe(1);
    expect(useCelebrationStore.getState().active?.id).toBe('other-major');
  });

  it('still plays a deferred arrival and leaves no stale queue entry behind', () => {
    useCelebrationStore.getState().request(4, 'other-major', { durationMs: 6000 });
    render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('arriving');

    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.firstWithFlight + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(useCelebrationStore.getState().active?.id).toBe('other-major');
  });

  it('under Reduce Motion ends in a short non-skippable crossfade with no flight', () => {
    render(<Home selected="anchor-1" onPose={jest.fn()} reduceMotion />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first', null); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });

    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.withoutFlight + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('releases its celebration entry when Home unmounts mid-arrival', () => {
    const view = render(<Home selected="anchor-1" onPose={jest.fn()} />);
    let id = 0;
    act(() => { id = stage('anchor-1', 'first'); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active?.id).toBe(homeArrivalCelebrationId(id));

    view.unmount();
    expect(useCelebrationStore.getState().active).toBeNull();
  });
});
