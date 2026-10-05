import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { Reveal } from '../Reveal';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, __esModule: true, withDelay: jest.fn(actual.withDelay) };
});

const withDelay = Reanimated.withDelay as jest.Mock;

describe('Reveal', () => {
  beforeEach(() => withDelay.mockClear());

  it('renders its children', () => {
    render(<Reveal order={1}><Text>hello</Text></Reveal>);
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders its children and starts no animation when disabled', () => {
    render(<Reveal enabled={false} order={3}><Text>still</Text></Reveal>);
    expect(screen.getByText('still')).toBeTruthy();
    expect(withDelay).not.toHaveBeenCalled();
  });

  it('does not restart its entrance when re-rendered with the same props', () => {
    const view = render(<Reveal order={2}><Text>a</Text></Reveal>);
    expect(withDelay).toHaveBeenCalledTimes(1);
    view.rerender(<Reveal order={2}><Text>a</Text></Reveal>);
    expect(withDelay).toHaveBeenCalledTimes(1);
  });
});
