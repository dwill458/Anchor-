import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { ChartRevealHandoff } from '../ChartRevealHandoff';
import { CHART_TRANSITION_TIMING as TT } from '../chartMotion';

const mounts: Record<string, number> = {};
function Probe({ name }: { name: string }) {
  useEffect(() => {
    mounts[name] = (mounts[name] ?? 0) + 1;
  }, [name]);
  return <Text>{name}</Text>;
}

beforeEach(() => {
  jest.useFakeTimers();
  for (const key of Object.keys(mounts)) delete mounts[key];
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function Host({ phase, onReleased = () => undefined }: { phase: 'creating' | 'handing' | 'done'; onReleased?: () => void }) {
  return (
    <ChartRevealHandoff
      testID="handoff"
      reducedMotion={false}
      releasing={phase === 'handing'}
      onReleased={onReleased}
      under={phase === 'creating' ? null : <Probe name="chart" />}
      over={phase === 'done' ? null : <Probe name="creation" />}
    />
  );
}

describe('ChartRevealHandoff', () => {
  it('keeps creation over the Chart until the Chart has had time to draw, then fades it and releases', () => {
    const onReleased = jest.fn();
    const screen = render(<Host phase="creating" onReleased={onReleased} />);
    expect(screen.queryByText('chart')).toBeNull();
    screen.rerender(<Host phase="handing" onReleased={onReleased} />);
    // Both are on screen during the hold; creation is on top and no longer takes touches or focus.
    expect(screen.getByText('chart')).toBeTruthy();
    const over = screen.getByTestId('handoff-over', { includeHiddenElements: true });
    expect(over.props.pointerEvents).toBe('none');
    expect(over.props.accessibilityElementsHidden).toBe(true);
    act(() => jest.advanceTimersByTime(TT.handoffHold - 1));
    expect(onReleased).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1 + TT.handoffFade));
    expect(onReleased).toHaveBeenCalledTimes(1);
  });

  it('neither side remounts across the hand-off', () => {
    const screen = render(<Host phase="creating" />);
    screen.rerender(<Host phase="handing" />);
    act(() => jest.advanceTimersByTime(TT.handoffHold + TT.handoffFade));
    screen.rerender(<Host phase="done" />);
    expect(screen.queryByText('creation')).toBeNull();
    expect(mounts).toEqual({ creation: 1, chart: 1 });
  });

  it('reduced motion: holds for the Chart to draw, then releases without a fade', () => {
    const onReleased = jest.fn();
    render(
      <ChartRevealHandoff reducedMotion releasing onReleased={onReleased} under={<Probe name="chart" />} over={<Probe name="creation" />} />
    );
    act(() => jest.advanceTimersByTime(TT.handoffHold));
    expect(onReleased).toHaveBeenCalledTimes(1);
  });
});
