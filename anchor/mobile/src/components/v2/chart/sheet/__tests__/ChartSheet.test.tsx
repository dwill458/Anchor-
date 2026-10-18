jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, runOnJS: (fn: unknown) => fn, withTiming: jest.fn((value: number, _config: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; }) };
});
import React from 'react';
import { BackHandler, ScrollView, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { withTiming, type SharedValue } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { ChartSheet, ChartSheetScrollArea, chartSheetDetents, chartSheetSnap, type ChartSheetHandle } from '../ChartSheet';

describe('ChartSheet', () => {
  it('scrolls only at full and resets to the top when collapsing', () => {
    const reset = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const ref = React.createRef<ChartSheetHandle>();
    const screen = render(<ChartSheet ref={ref} busy={{ value: false } as SharedValue<boolean>} reducedMotion><ChartSheetScrollArea><Text>Route</Text></ChartSheetScrollArea></ChartSheet>);
    act(() => ref.current!.snapTo('full'));
    expect(screen.getByTestId('chart-sheet-scroll').props.scrollEnabled).toBe(true);
    reset.mockClear();
    act(() => ref.current!.snapTo('half'));
    expect(screen.getByTestId('chart-sheet-scroll').props.scrollEnabled).toBe(false);
    expect(reset).toHaveBeenCalledWith({ y: 0, animated: false });
    reset.mockRestore();
  });
  it('places hidden/peek/half/full in a 390×844 window with 47/34 insets', () => {
    expect(chartSheetDetents(844, 47, 34)).toEqual({ hidden: 844, peek: 648, half: 371, full: 220 });
    expect(chartSheetDetents(500, 47, 34).full).toBe(190);
  });
  it('snaps to nearest, or to the next detent in the direction of a flick', () => {
    const positions = chartSheetDetents(844, 47, 34);
    expect(chartSheetSnap(590, 0, positions)).toBe('peek');
    expect(chartSheetSnap(410, 0, positions)).toBe('half');
    expect(chartSheetSnap(590, -801, positions)).toBe('half');
    expect(chartSheetSnap(300, -801, positions)).toBe('full');
    expect(chartSheetSnap(300, 801, positions)).toBe('half');
  });
  it('cycles peek → half → full → peek with accessible labels and hardware back', () => {
    const ref = React.createRef<ChartSheetHandle>();
    const change = jest.fn();
    let back: ((event: { readonly type: string; readonly timeStamp: number }) => boolean | undefined) | undefined;
    const subscription = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_name, callback) => { back = callback; return { remove: jest.fn() }; });
    const screen = render(<ChartSheet ref={ref} busy={{ value: false } as SharedValue<boolean>} reducedMotion={false} onDetentChange={change}><Text>Content</Text></ChartSheet>);
    act(() => ref.current!.snapTo('peek'));
    fireEvent.press(screen.getByLabelText('Expand panel'));
    expect(change).toHaveBeenLastCalledWith('half');
    fireEvent.press(screen.getByLabelText('Expand panel'));
    expect(change).toHaveBeenLastCalledWith('full');
    expect(screen.getByLabelText('Collapse panel')).toBeTruthy();
    act(() => { expect(back!({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
    expect(change).toHaveBeenLastCalledWith('peek');
    act(() => { expect(back!({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(false); });
    subscription.mockRestore();
  });
  it('keeps expansion disabled while the sequence is busy and uses 180ms linear under Reduce Motion', () => {
    const ref = React.createRef<ChartSheetHandle>();
    const change = jest.fn();
    const busy = { value: true } as SharedValue<boolean>;
    const screen = render(<ChartSheet ref={ref} busy={busy} reducedMotion onDetentChange={change}><Text>Content</Text></ChartSheet>);
    act(() => ref.current!.snapTo('peek'));
    expect(withTiming).toHaveBeenLastCalledWith(1, expect.objectContaining({ duration: 180 }));
    change.mockClear();
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
    expect(change).not.toHaveBeenCalled();
    busy.value = false;
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
    expect(withTiming).toHaveBeenLastCalledWith(expect.any(Number), expect.objectContaining({ duration: 180 }), expect.any(Function));
  });
  it('runs grab-zone drag/release on shared values and ignores a drag while busy', () => {
    const ref = React.createRef<ChartSheetHandle>();
    const change = jest.fn();
    const busy = { value: false } as SharedValue<boolean>;
    const screen = render(<ChartSheet ref={ref} busy={busy} reducedMotion={false} onDetentChange={change}><Text>Content</Text></ChartSheet>);
    act(() => ref.current!.snapTo('peek'));
    const handlers = () => screen.UNSAFE_getAllByType(GestureDetector).find(node => node.props.gesture.config.testId === 'chart-sheet-grab-pan')!.props.gesture.handlers;
    change.mockClear();
    busy.value = true;
    act(() => { handlers().onStart({}); handlers().onUpdate({ translationY: -300 }); handlers().onEnd({ velocityY: -900 }); });
    expect(change).not.toHaveBeenCalled();
    busy.value = false;
    act(() => { handlers().onStart({}); handlers().onUpdate({ translationY: -30 }); handlers().onEnd({ velocityY: -900 }); });
    expect(change).toHaveBeenLastCalledWith('half');
    expect(withTiming).toHaveBeenLastCalledWith(expect.any(Number), expect.objectContaining({ duration: 360 }), expect.any(Function));
  });
});
