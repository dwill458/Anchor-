import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('./reanimatedTestMock').createReanimatedMock());
const mockReduced = { current: false };
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({
  useCelebrationReduceMotion: () => mockReduced.current,
}));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { selection: jest.fn(), impact: jest.fn() } }));

import { TimeWheel } from '../TimeWheel';
import { indexFromOffset, offsetFromIndex, ROW_HEIGHT } from '../timeWheelLayout';

const settleAt = (utils: ReturnType<typeof render>, id: string, index: number) =>
  fireEvent(utils.getByTestId(id), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: 0, y: index * ROW_HEIGHT } },
  });

describe('timeWheelLayout offsets', () => {
  it('maps offsets to clamped indices', () => {
    expect(indexFromOffset(0, 60)).toBe(0);
    expect(indexFromOffset(ROW_HEIGHT * 17 + 10, 60)).toBe(17);
    expect(indexFromOffset(ROW_HEIGHT * 17 + 30, 60)).toBe(18);
    expect(indexFromOffset(-50, 60)).toBe(0);
    expect(indexFromOffset(99999, 60)).toBe(59);
    expect(offsetFromIndex(3)).toBe(3 * ROW_HEIGHT);
  });
});

describe('TimeWheel', () => {
  beforeEach(() => {
    mockReduced.current = false;
  });

  it('renders every minute 00-59 and hours 1-12 with AM/PM', () => {
    const utils = render(<TimeWheel value="21:00" onChange={jest.fn()} use24h={false} />);
    for (let m = 0; m < 60; m += 1) {
      expect(utils.getByTestId(`time-wheel-minute-row-${m}`)).toBeTruthy();
    }
    expect(utils.getByTestId('time-wheel-hour-row-1')).toBeTruthy();
    expect(utils.getByTestId('time-wheel-hour-row-12')).toBeTruthy();
    expect(utils.queryByTestId('time-wheel-hour-row-0')).toBeNull();
    expect(utils.getByTestId('time-wheel-meridiem')).toBeTruthy();
  });

  it('emits 05:45, 07:17, 20:30 and 22:52 from wheel settles', () => {
    const onChange = jest.fn();
    const utils = render(<TimeWheel value="05:00" onChange={onChange} use24h={false} />);
    settleAt(utils, 'time-wheel-minute', 45);
    expect(onChange).toHaveBeenLastCalledWith('05:45');

    settleAt(utils, 'time-wheel-hour', 6); // hour 7
    settleAt(utils, 'time-wheel-minute', 17);
    expect(onChange).toHaveBeenLastCalledWith('07:17');

    settleAt(utils, 'time-wheel-hour', 7); // hour 8
    settleAt(utils, 'time-wheel-minute', 30);
    settleAt(utils, 'time-wheel-meridiem', 1); // PM
    expect(onChange).toHaveBeenLastCalledWith('20:30');

    settleAt(utils, 'time-wheel-hour', 9); // hour 10
    settleAt(utils, 'time-wheel-minute', 52);
    expect(onChange).toHaveBeenLastCalledWith('22:52');
  });

  it('maps 12 AM to 00 and 12 PM to 12', () => {
    const onChange = jest.fn();
    const utils = render(<TimeWheel value="09:00" onChange={onChange} use24h={false} />);
    settleAt(utils, 'time-wheel-hour', 11); // 12 (AM) -> 00:00
    expect(onChange).toHaveBeenLastCalledWith('00:00');
    settleAt(utils, 'time-wheel-meridiem', 1);
    expect(onChange).toHaveBeenLastCalledWith('12:00');
  });

  it('24h mode hides meridiem and emits 20:30', () => {
    const onChange = jest.fn();
    const utils = render(<TimeWheel value="08:00" onChange={onChange} use24h />);
    expect(utils.queryByTestId('time-wheel-meridiem')).toBeNull();
    settleAt(utils, 'time-wheel-hour', 20);
    settleAt(utils, 'time-wheel-minute', 30);
    expect(onChange).toHaveBeenLastCalledWith('20:30');
  });

  it('does not emit again when the settled index is unchanged', () => {
    const onChange = jest.fn();
    const utils = render(<TimeWheel value="05:45" onChange={onChange} use24h={false} />);
    settleAt(utils, 'time-wheel-minute', 45);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits a drag end that starts no momentum, ignores one that does', () => {
    const onChange = jest.fn();
    const utils = render(<TimeWheel value="05:00" onChange={onChange} use24h={false} />);
    fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollEndDrag', {
      nativeEvent: { contentOffset: { x: 0, y: 10 * ROW_HEIGHT }, velocity: { x: 0, y: 1.4 } },
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollEndDrag', {
      nativeEvent: { contentOffset: { x: 0, y: 10 * ROW_HEIGHT }, velocity: { x: 0, y: 0 } },
    });
    expect(onChange).toHaveBeenLastCalledWith('05:10');
  });

  it('exposes adjustable accessibility with increment/decrement that never emits invalid times', () => {
    const onChange = jest.fn();
    const utils = render(<TimeWheel value="05:59" onChange={onChange} use24h={false} />);
    const minute = utils.getByTestId('time-wheel-minute');
    expect(minute.props.accessibilityRole).toBe('adjustable');
    expect(minute.props.accessibilityLabel).toBe('Minute');
    expect(minute.props.accessibilityValue).toEqual({ text: '59' });
    expect(utils.getByTestId('time-wheel-hour').props.accessibilityLabel).toBe('Hour');
    expect(utils.getByTestId('time-wheel-meridiem').props.accessibilityLabel).toBe('AM or PM');
    expect(minute.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
      'increment',
      'decrement',
    ]);

    fireEvent(minute, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled(); // clamps at 59, no change

    fireEvent(minute, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith('05:58');
    expect(utils.getByTestId('time-wheel-minute').props.accessibilityValue).toEqual({ text: '58' });
    for (const call of onChange.mock.calls) expect(call[0]).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });

  it('Reduced Motion rows carry no transform', () => {
    mockReduced.current = true;
    const utils = render(<TimeWheel value="08:30" onChange={jest.fn()} use24h={false} />);
    const style = StyleSheet.flatten(utils.getByTestId('time-wheel-minute-row-30').props.style);
    expect(style.transform).toBeUndefined();
  });

  it('normal motion rows carry a scale transform', () => {
    const utils = render(<TimeWheel value="08:30" onChange={jest.fn()} use24h={false} />);
    const style = StyleSheet.flatten(utils.getByTestId('time-wheel-minute-row-30').props.style);
    expect(style.transform).toBeDefined();
  });

  it('re-syncs when the value prop changes without emitting', () => {
    const onChange = jest.fn();
    const utils = render(<TimeWheel value="08:30" onChange={onChange} use24h={false} />);
    act(() => {
      utils.rerender(<TimeWheel value="22:15" onChange={onChange} use24h={false} />);
    });
    expect(utils.getByTestId('time-wheel-minute').props.accessibilityValue).toEqual({ text: '15' });
    expect(utils.getByTestId('time-wheel-meridiem').props.accessibilityValue).toEqual({ text: 'PM' });
    expect(onChange).not.toHaveBeenCalled();
  });

  describe('selection haptics', () => {
    const { safeHaptics } = require('@/utils/haptics');
    const scrollTo = (utils: ReturnType<typeof render>, y: number) =>
      fireEvent.scroll(utils.getByTestId('time-wheel-minute'), { nativeEvent: { contentOffset: { x: 0, y } } });

    beforeEach(() => safeHaptics.selection.mockClear());

    it('does not fire for initial positioning', () => {
      const utils = render(<TimeWheel value="05:10" onChange={jest.fn()} use24h={false} />);
      fireEvent(utils.getByTestId('time-wheel-minute'), 'contentSizeChange', 100, 3000);
      scrollTo(utils, 10 * ROW_HEIGHT);
      expect(safeHaptics.selection).not.toHaveBeenCalled();
    });

    it('fires once per centred-row change, not per frame', () => {
      const utils = render(<TimeWheel value="05:10" onChange={jest.fn()} use24h={false} />);
      scrollTo(utils, 10 * ROW_HEIGHT + 3);
      scrollTo(utils, 10 * ROW_HEIGHT + 15);
      expect(safeHaptics.selection).not.toHaveBeenCalled();
      scrollTo(utils, 10 * ROW_HEIGHT + 30); // crosses into row 11
      scrollTo(utils, 11 * ROW_HEIGHT);
      scrollTo(utils, 11 * ROW_HEIGHT + 4);
      expect(safeHaptics.selection).toHaveBeenCalledTimes(1);
      scrollTo(utils, 12 * ROW_HEIGHT);
      expect(safeHaptics.selection).toHaveBeenCalledTimes(2);
    });
  });

  it('reports settling from drag begin until the final value lands', () => {
    const onSettlingChange = jest.fn();
    const utils = render(<TimeWheel value="05:10" onChange={jest.fn()} onSettlingChange={onSettlingChange} />);
    fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollBeginDrag');
    expect(onSettlingChange).toHaveBeenLastCalledWith(true);
    fireEvent(utils.getByTestId('time-wheel-minute'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: 20 * ROW_HEIGHT } },
    });
    expect(onSettlingChange).toHaveBeenLastCalledWith(false);
    expect(onSettlingChange).toHaveBeenCalledTimes(2);
  });
});
