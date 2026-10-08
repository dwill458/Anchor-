import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { TeachingWhisper } from '../TeachingWhisper';
it('dismisses after eight seconds or by X, with no scrim', () => {
  jest.useFakeTimers();
  const dismiss = jest.fn();
  const tree = render(<TeachingWhisper body="A tip" reducedMotion onDismiss={dismiss} />);
  expect(tree.getAllByRole('button')).toHaveLength(1);
  fireEvent.press(tree.getByLabelText('Dismiss tip'));
  expect(dismiss).toHaveBeenCalledWith('close');
  act(() => jest.advanceTimersByTime(8000));
  expect(dismiss).toHaveBeenCalledWith('timeout');
  tree.unmount();
  jest.useRealTimers();
});
