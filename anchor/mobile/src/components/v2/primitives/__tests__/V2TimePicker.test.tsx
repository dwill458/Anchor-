import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2TimePicker } from '../V2TimePicker';

describe('V2TimePicker', () => {
  it('renders time digits, steppers, and meridiem toggle', () => {
    const date = new Date(2026, 0, 1, 8, 30, 0); // 8:30 AM
    const onChange = jest.fn();

    const { getByText, getByLabelText } = render(
      <V2TimePicker value={date} onChange={onChange} testID="custom-time-picker" />
    );

    expect(getByText('08')).toBeTruthy();
    expect(getByText('30')).toBeTruthy();
    expect(getByText('AM')).toBeTruthy();
    expect(getByText('PM')).toBeTruthy();

    // Step hour up
    fireEvent.press(getByLabelText('Increase hour'));
    expect(onChange).toHaveBeenCalled();
    const call1 = onChange.mock.calls[0][0] as Date;
    expect(call1.getHours()).toBe(9);

    // Switch to PM
    fireEvent.press(getByLabelText('PM'));
    expect(onChange).toHaveBeenCalled();
    const call2 = onChange.mock.calls[1][0] as Date;
    expect(call2.getHours()).toBe(20); // 8 PM
  });

  it('selects quick minute chips', () => {
    const date = new Date(2026, 0, 1, 10, 0, 0); // 10:00 AM
    const onChange = jest.fn();

    const { getByLabelText } = render(
      <V2TimePicker value={date} onChange={onChange} />
    );

    fireEvent.press(getByLabelText('Set minute to :15'));
    expect(onChange).toHaveBeenCalled();
    const result = onChange.mock.calls[0][0] as Date;
    expect(result.getMinutes()).toBe(15);
  });
});
