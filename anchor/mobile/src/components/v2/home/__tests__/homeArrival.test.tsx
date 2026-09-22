import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { ARRIVAL_TIMING, HomeArrivalProvider, useHomeArrival, useHomeArrivalContext } from '../homeArrival';
import { useHomeArrivalStore, whenHomeReady } from '@/stores/v2/homeArrivalStore';

const TARGET = { x: 120, y: 200, width: 110, height: 110 };
const FROM = { x: 60, y: 260, width: 280, height: 280 };

function Hero({ report }: { report: boolean }) {
  const arrival = useHomeArrivalContext();
  useEffect(() => {
    if (report && arrival?.active && arrival.phase === 'staging') arrival.reportTarget(TARGET);
  }, [arrival, report]);
  return <Text testID="phase">{arrival?.phase ?? 'none'}</Text>;
}

function Home({ selected, onPose, report = true }: { selected: string; onPose: () => void; report?: boolean }) {
  const arrival = useHomeArrival({ selectedAnchorIds: [selected], onPose, reduceMotion: false });
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

const stage = (anchorId = 'anchor-1') =>
  useHomeArrivalStore.getState().stage({ anchorId, svg: '<svg/>', category: 'career', expression: 'foil', fromRect: FROM });

beforeEach(() => {
  jest.useFakeTimers();
  act(() => useHomeArrivalStore.setState({ arrival: null }));
});
afterEach(() => {
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
