import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { V2SegmentedControl } from '../V2SegmentedControl';

let mockReduce = false;
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => mockReduce }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, __esModule: true, withSpring: jest.fn(actual.withSpring), withTiming: jest.fn(actual.withTiming) };
});

const withSpring = Reanimated.withSpring as jest.Mock;
const withTiming = Reanimated.withTiming as jest.Mock;

const THREE = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'released', label: 'Released' },
];

describe('V2SegmentedControl', () => {
  it('reports the tapped option and marks the selected one', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(<V2SegmentedControl accessibilityLabel="Filter" options={THREE} value="active" onChange={onChange} />);
    expect(getByLabelText('Active').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('All').props.accessibilityState.selected).toBe(false);
    fireEvent.press(getByLabelText('Released'));
    expect(onChange).toHaveBeenCalledWith('released');
  });

  it('renders with a value that matches no option', () => {
    const { getByLabelText } = render(<V2SegmentedControl accessibilityLabel="Filter" options={THREE} value="gone" onChange={jest.fn()} />);
    expect(getByLabelText('All').props.accessibilityState.selected).toBe(false);
  });

  it('survives the option count changing under it', () => {
    const view = render(<V2SegmentedControl accessibilityLabel="Filter" options={THREE} value="all" onChange={jest.fn()} />);
    view.rerender(<V2SegmentedControl accessibilityLabel="Filter" options={THREE.slice(0, 2)} value="all" onChange={jest.fn()} />);
    expect(view.queryByLabelText('Released')).toBeNull();
    expect(view.getByLabelText('Active')).toBeTruthy();
  });

  it('slides a pill under the options', () => {
    const { getByTestId } = render(<V2SegmentedControl accessibilityLabel="Filter" options={THREE} value="all" onChange={jest.fn()} />);
    expect(getByTestId('v2-segmented-pill')).toBeTruthy();
  });

  describe('moving the pill', () => {
    const laidOut = (value: string, onChange = jest.fn()) => {
      const view = render(<V2SegmentedControl accessibilityLabel="Filter" options={THREE} value={value} onChange={onChange} />);
      fireEvent(view.getByLabelText('Filter'), 'layout', { nativeEvent: { layout: { width: 300, height: 50, x: 0, y: 0 } } });
      return view;
    };

    beforeEach(() => {
      mockReduce = false;
      withSpring.mockClear();
      withTiming.mockClear();
    });

    it('slides on a spring when the selection changes', () => {
      const view = laidOut('all');
      withSpring.mockClear();
      view.rerender(<V2SegmentedControl accessibilityLabel="Filter" options={THREE} value="active" onChange={jest.fn()} />);
      expect(withSpring).toHaveBeenCalledTimes(1);
    });

    it('does not travel at all under reduced motion: the pill is simply placed', () => {
      mockReduce = true;
      const view = laidOut('all');
      withSpring.mockClear();
      withTiming.mockClear();
      view.rerender(<V2SegmentedControl accessibilityLabel="Filter" options={THREE} value="released" onChange={jest.fn()} />);
      expect(withSpring).not.toHaveBeenCalled();
      expect(withTiming).not.toHaveBeenCalled();
    });
  });
});
