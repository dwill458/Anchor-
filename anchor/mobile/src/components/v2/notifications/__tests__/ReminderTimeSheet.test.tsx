import React from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('./reanimatedTestMock').createReanimatedMock());
const mockReduced = { current: false };
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({
  useCelebrationReduceMotion: () => mockReduced.current,
}));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { selection: jest.fn(), impact: jest.fn() } }));
const mockWindow = { current: { width: 390, height: 844, scale: 2, fontScale: 1 } };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

import { ReminderTimeSheet } from '../ReminderTimeSheet';
import {
  behindSheetA11yProps,
  clampSheetHeight,
  MIN_VISIBLE_WHEEL_ROWS,
  ROW_HEIGHT,
  SHEET_FIXED_HEIGHT,
  sheetBottomPadding,
  sheetContentHeight,
  sheetMaxHeight,
  WHEEL_HEIGHT,
} from '../timeWheelLayout';

describe('timeWheelLayout sheet helpers', () => {
  it('pads by at least the safe-area bottom inset', () => {
    expect(sheetBottomPadding(34)).toBeGreaterThanOrEqual(34);
    expect(sheetBottomPadding(0)).toBeGreaterThan(0);
  });
  it('clamps to 85% of the window', () => {
    expect(clampSheetHeight(600, 900)).toBe(510);
    expect(clampSheetHeight(900, 400)).toBe(400);
  });
  it('content height includes handle, title, wheel, Done and bottom padding', () => {
    expect(SHEET_FIXED_HEIGHT).toBe(12 + 16 + 44 + 20 + 52);
    expect(sheetContentHeight(50)).toBe(SHEET_FIXED_HEIGHT + WHEEL_HEIGHT + 50);
  });
  it('sheetMaxHeight fits content on tall windows', () => {
    expect(sheetMaxHeight(900, 47, 50)).toBe(sheetContentHeight(50));
  });
  it('sheetMaxHeight keeps header, Done and 3 wheel rows on short windows, within the space below the status bar', () => {
    const min = SHEET_FIXED_HEIGHT + MIN_VISIBLE_WHEEL_ROWS * ROW_HEIGHT + 20;
    expect(sheetMaxHeight(360, 24, 20)).toBe(Math.min(360 - 24, Math.max(clampSheetHeight(360, sheetContentHeight(20)), min)));
    expect(sheetMaxHeight(360, 24, 20)).toBeGreaterThanOrEqual(min);
    expect(sheetMaxHeight(300, 24, 20)).toBe(276);
  });
  it('behindSheetA11yProps hides content only while open', () => {
    expect(behindSheetA11yProps(true).importantForAccessibility).toBe('no-hide-descendants');
    expect(behindSheetA11yProps(false).importantForAccessibility).toBe('auto');
  });
});

describe('ReminderTimeSheet', () => {
  let backCb: (() => boolean) | null = null;
  const remove = jest.fn();
  beforeEach(() => {
    mockReduced.current = false;
    mockWindow.current = { width: 390, height: 844, scale: 2, fontScale: 1 };
    backCb = null;
    remove.mockClear();
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_n, cb) => {
      backCb = cb as () => boolean;
      return { remove };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when closed', () => {
    const utils = render(<ReminderTimeSheet open={false} value="20:00" onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(utils.toJSON()).toBeNull();
    expect(backCb).toBeNull();
  });

  it('is bottom anchored', () => {
    const utils = render(<ReminderTimeSheet open value="20:00" onConfirm={jest.fn()} onClose={jest.fn()} />);
    const flat = StyleSheet.flatten(utils.getByTestId('reminder-time-sheet').props.style);
    expect(flat.bottom).toBe(0);
    expect(flat.position).toBe('absolute');
  });

  it('hardware back closes and is consumed', () => {
    const onClose = jest.fn();
    render(<ReminderTimeSheet open value="20:00" onConfirm={jest.fn()} onClose={onClose} />);
    expect(backCb).not.toBeNull();
    expect(backCb!()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop tap closes', () => {
    const onClose = jest.fn();
    const utils = render(<ReminderTimeSheet open value="20:00" onConfirm={jest.fn()} onClose={onClose} />);
    fireEvent.press(utils.getByTestId('reminder-time-sheet-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Done confirms the initial value untouched', () => {
    const onConfirm = jest.fn();
    const utils = render(<ReminderTimeSheet open value="20:30" onConfirm={onConfirm} onClose={jest.fn()} />);
    fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
    expect(onConfirm).toHaveBeenCalledWith('20:30');
  });

  it('Done confirms the wheel selection', () => {
    const onConfirm = jest.fn();
    const utils = render(
      <ReminderTimeSheet open value="20:30" onConfirm={onConfirm} onClose={jest.fn()} use24h={false} />,
    );
    fireEvent(utils.getByTestId('time-wheel-minute'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: 52 * ROW_HEIGHT } },
    });
    fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
    expect(onConfirm).toHaveBeenCalledWith('20:52');
  });

  it('Reduced Motion renders without throwing and the sheet has no transform', () => {
    mockReduced.current = true;
    const utils = render(<ReminderTimeSheet open value="20:00" onConfirm={jest.fn()} onClose={jest.fn()} />);
    const flat = StyleSheet.flatten(utils.getByTestId('reminder-time-sheet').props.style);
    expect(flat.transform).toBeUndefined();
  });

  it('unmounts after the exit animation when closed', () => {
    const props = { value: '20:00', onConfirm: jest.fn(), onClose: jest.fn() };
    const utils = render(<ReminderTimeSheet open {...props} />);
    expect(utils.queryByTestId('reminder-time-sheet')).not.toBeNull();
    utils.rerender(<ReminderTimeSheet open={false} {...props} />);
    expect(utils.toJSON()).toBeNull();
  });

  it('Done mid-drag waits for momentum end, then confirms once with the final value', () => {
    const onConfirm = jest.fn();
    const utils = render(<ReminderTimeSheet open value="20:30" onConfirm={onConfirm} onClose={jest.fn()} />);
    const minute = utils.getByTestId('time-wheel-minute');
    fireEvent(minute, 'scrollBeginDrag');
    fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent(minute, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0, y: 41 * ROW_HEIGHT } } });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('20:41');
    fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Done while settling falls back after 600ms with the latest value', () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const utils = render(<ReminderTimeSheet open value="20:30" onConfirm={onConfirm} onClose={jest.fn()} />);
      fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollBeginDrag');
      fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
      act(() => {
        jest.advanceTimersByTime(599);
      });
      expect(onConfirm).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(2);
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith('20:30');
    } finally {
      jest.useRealTimers();
    }
  });

  it('a drag release with velocity but no momentum commits after the 250ms fallback', () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const utils = render(<ReminderTimeSheet open value="20:30" onConfirm={onConfirm} onClose={jest.fn()} />);
      const minute = utils.getByTestId('time-wheel-minute');
      fireEvent(minute, 'scrollBeginDrag');
      fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
      fireEvent(minute, 'scrollEndDrag', {
        nativeEvent: { contentOffset: { x: 0, y: 12 * ROW_HEIGHT }, velocity: { x: 0, y: 1 } },
      });
      expect(onConfirm).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(260);
      });
      expect(onConfirm).toHaveBeenCalledWith('20:12');
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes modal accessibility props', () => {
    const utils = render(<ReminderTimeSheet open value="20:00" onConfirm={jest.fn()} onClose={jest.fn()} />);
    const sheet = utils.getByTestId('reminder-time-sheet');
    expect(sheet.props.accessibilityViewIsModal).toBe(true);
    expect(sheet.props.importantForAccessibility).toBe('yes');
    expect(sheet.props.pointerEvents).toBe('auto');
  });

  it('Done while settling then backdrop close never confirms later', () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      const utils = render(<ReminderTimeSheet open value="20:30" onConfirm={onConfirm} onClose={onClose} />);
      fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollBeginDrag');
      fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
      fireEvent.press(utils.getByTestId('reminder-time-sheet-backdrop', { includeHiddenElements: true }));
      expect(onClose).toHaveBeenCalledTimes(1);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onConfirm).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Done while settling then hardware back never confirms later', () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const utils = render(<ReminderTimeSheet open value="20:30" onConfirm={onConfirm} onClose={jest.fn()} />);
      fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollBeginDrag');
      fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
      backCb!();
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onConfirm).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Done while settling, then close and reopen, never confirms from the old press', () => {
    jest.useFakeTimers();
    try {
      const onConfirm = jest.fn();
      const props = { value: '20:30', onConfirm, onClose: jest.fn() };
      const utils = render(<ReminderTimeSheet open {...props} />);
      fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollBeginDrag');
      fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
      utils.rerender(<ReminderTimeSheet open={false} {...props} />);
      utils.rerender(<ReminderTimeSheet open {...props} />);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onConfirm).not.toHaveBeenCalled();
      // The reopened sheet still works normally.
      fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a window resize while open keeps the latest wheel pick for Done', () => {
    const onConfirm = jest.fn();
    const props = { value: '20:30', onConfirm, onClose: jest.fn() };
    const utils = render(<ReminderTimeSheet open {...props} />);
    fireEvent(utils.getByTestId('time-wheel-minute'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: 52 * ROW_HEIGHT } },
    });
    mockWindow.current = { width: 390, height: 400, scale: 2, fontScale: 1 };
    utils.rerender(<ReminderTimeSheet open {...props} />);
    fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('20:52');
  });

  it('shows a pending state on Done while waiting for the wheel', () => {
    const utils = render(<ReminderTimeSheet open value="20:30" onConfirm={jest.fn()} onClose={jest.fn()} />);
    fireEvent(utils.getByTestId('time-wheel-minute'), 'scrollBeginDrag');
    fireEvent.press(utils.getByTestId('reminder-time-sheet-done'));
    expect(utils.getByTestId('reminder-time-sheet-done').props.accessibilityState).toEqual({ busy: true });
  });
});
