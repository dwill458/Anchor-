import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2SegmentedControl } from '../V2SegmentedControl';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false }));

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
});
