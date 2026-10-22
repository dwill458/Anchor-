import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { Shimmer } from '../Shimmer';

let mockReduce = false;
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => mockReduce }));
jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { ...actual, __esModule: true, withRepeat: jest.fn(actual.withRepeat) };
});

const withRepeat = Reanimated.withRepeat as jest.Mock;

describe('Shimmer', () => {
  beforeEach(() => {
    withRepeat.mockClear();
    mockReduce = false;
  });

  it('renders its children and pulses', () => {
    render(<Shimmer><Text>loading</Text></Shimmer>);
    expect(screen.getByText('loading')).toBeTruthy();
    expect(withRepeat).toHaveBeenCalledTimes(1);
  });

  it('holds still under reduced motion', () => {
    mockReduce = true;
    render(<Shimmer><Text>loading</Text></Shimmer>);
    expect(screen.getByText('loading')).toBeTruthy();
    expect(withRepeat).not.toHaveBeenCalled();
  });
});
