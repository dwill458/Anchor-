import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2ConfirmSheet } from '../V2ConfirmSheet';

describe('V2ConfirmSheet', () => {
  it('renders title, message, and action buttons', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    const { getByText, getByTestId } = render(
      <V2ConfirmSheet
        visible={true}
        onClose={onCancel}
        eyebrow="EXIT PRACTICE"
        title="End Focus session?"
        message="This session only counts when it reaches the end."
        confirmLabel="End Session"
        cancelLabel="Keep Practicing"
        destructive={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
        testID="exit-confirm"
      />
    );

    expect(getByText('EXIT PRACTICE')).toBeTruthy();
    expect(getByText('End Focus session?')).toBeTruthy();
    expect(getByText('This session only counts when it reaches the end.')).toBeTruthy();
    expect(getByText('End Session')).toBeTruthy();
    expect(getByText('Keep Practicing')).toBeTruthy();

    fireEvent.press(getByTestId('exit-confirm-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('exit-confirm-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders single button in alert mode', () => {
    const onConfirm = jest.fn();

    const { getByText, queryByText } = render(
      <V2ConfirmSheet
        visible={true}
        onClose={jest.fn()}
        title="Notice"
        message="Changes saved successfully."
        type="alert"
        confirmLabel="Got it"
        onConfirm={onConfirm}
        testID="alert-sheet"
      />
    );

    expect(getByText('Notice')).toBeTruthy();
    expect(getByText('Changes saved successfully.')).toBeTruthy();
    expect(getByText('Got it')).toBeTruthy();
    expect(queryByText('Cancel')).toBeNull();

    fireEvent.press(getByText('Got it'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
