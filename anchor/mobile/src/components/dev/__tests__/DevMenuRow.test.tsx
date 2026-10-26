import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Switch } from 'react-native';
import { DevMenuRow } from '../DevMenuRow';

it('makes the whole toggle row operable with the current switch state', () => {
  const onToggle = jest.fn();
  const screen = render(<DevMenuRow title="Debug logging" type="toggle" toggleValue={false} onToggle={onToggle} />);
  fireEvent.press(screen.getByRole('switch', { name: 'Debug logging' }));
  expect(onToggle).toHaveBeenCalledWith(true);
  onToggle.mockClear();
  fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(onToggle).toHaveBeenCalledWith(true);
});

it('keeps disabled actions from running', () => {
  const onPress = jest.fn();
  const screen = render(<DevMenuRow title="Reset first prime" type="none" onPress={onPress} disabled />);
  fireEvent.press(screen.getByRole('button', { name: 'Reset first prime' }));
  expect(onPress).not.toHaveBeenCalled();
});
