import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AskStarters } from '../AskStarters';

const accent = { border: '#ccc', wash: '#eee' } as any;

it('renders each starter and fires its own action', () => {
  const a = jest.fn();
  const b = jest.fn();
  const screen = render(<AskStarters accent={accent} reducedMotion starters={[{ key: 'break', label: 'Break this move down', onPress: a }, { key: 'week', label: 'Plan my week', onPress: b }]} />);
  fireEvent.press(screen.getByTestId('ask-starter-break'));
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).not.toHaveBeenCalled();
  expect(screen.getByText('Plan my week')).toBeTruthy();
});

it('renders nothing without starters', () => {
  expect(render(<AskStarters accent={accent} reducedMotion starters={[]} />).queryByTestId('ask-starters')).toBeNull();
});
