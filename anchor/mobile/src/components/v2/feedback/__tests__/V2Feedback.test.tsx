import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { V2ActivityIndicator, V2EmptyState, V2InlineError, V2Skeleton } from '../V2Feedback';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false }));
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, __esModule: true, withRepeat: jest.fn(actual.withRepeat), withDelay: jest.fn(actual.withDelay) };
});

const withRepeat = Reanimated.withRepeat as jest.Mock;
const withDelay = Reanimated.withDelay as jest.Mock;

describe('V2 feedback states', () => {
  beforeEach(() => {
    withRepeat.mockClear();
    withDelay.mockClear();
  });

  it('shows a labelled progress indicator that arrives', () => {
    const { getByLabelText, getByText } = render(<V2ActivityIndicator label="Reading" />);
    expect(getByLabelText('Reading').props.accessibilityRole).toBe('progressbar');
    expect(getByText('Reading')).toBeTruthy();
    expect(withDelay).toHaveBeenCalled();
  });

  it('shows a skeleton that pulses and keeps its testID', () => {
    const { getByTestId } = render(<V2Skeleton testID="skeleton" width={120} height={20} />);
    expect(getByTestId('skeleton', { includeHiddenElements: true })).toBeTruthy();
    expect(withRepeat).toHaveBeenCalledTimes(1);
  });

  it('offers a retry only when it can retry', () => {
    const onRetry = jest.fn();
    const { queryByText, getByText, rerender } = render(<V2InlineError message="No signal" />);
    expect(queryByText('Try again')).toBeNull();
    rerender(<V2InlineError message="No signal" onRetry={onRetry} offline />);
    fireEvent.press(getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(getByText('No signal')).toBeTruthy();
  });

  it('shows an empty state with its message and action, arriving', () => {
    const { getByText } = render(<V2EmptyState title="Nothing here" message="Create one." action={<Text>Go</Text>} />);
    expect(getByText('Nothing here')).toBeTruthy();
    expect(getByText('Create one.')).toBeTruthy();
    expect(withDelay).toHaveBeenCalled();
  });
});
