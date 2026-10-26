import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2ProgressRhythm } from '../V2ProgressRhythm';
import { toV2ProgressModel } from '@/adapters/v2/progress/progressAdapter';
import type { Anchor } from '@/types';

const anchor = {
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Practice daily',
  category: 'focus',
  threadStrength: 50,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-25T12:00:00.000Z'),
} as unknown as Anchor;

describe('V2ProgressRhythm Year tab', () => {
  it('renders month labels cleanly without overlap when a month has only 1 week at the start of the 26-week window', () => {
    // On 2026-10-25, 26 weeks starts on 2026-04-27 (the last week of April).
    // April only has 1 week before May begins on 2026-05-04.
    // April must not show a label to avoid overlapping with May ('ApMay').
    const now = new Date('2026-10-25T12:00:00.000Z');
    const model = toV2ProgressModel(anchor, [], [], { now })!;

    const { queryByText, getByText, getByTestId } = render(
      <V2ProgressRhythm
        model={model}
        range="Year"
        onRangeChange={jest.fn()}
        testID="test-rhythm"
      />
    );

    expect(getByTestId('test-rhythm-year')).toBeTruthy();

    // May, Jun, Jul, Aug, Sep, Oct should be rendered
    expect(getByText('May')).toBeTruthy();
    expect(getByText('Jun')).toBeTruthy();
    expect(getByText('Jul')).toBeTruthy();
    expect(getByText('Aug')).toBeTruthy();
    expect(getByText('Sep')).toBeTruthy();
    expect(getByText('Oct')).toBeTruthy();

    // Apr should NOT be rendered because it has < 3 weeks before May
    expect(queryByText('Apr')).toBeNull();
  });

  it('renders the first month label when it spans 3 or more weeks before the next month', () => {
    // For a window where the first month spans >= 3 weeks
    const now = new Date('2026-05-15T12:00:00.000Z');
    const model = toV2ProgressModel(anchor, [], [], { now })!;

    const { getByText, getByTestId } = render(
      <V2ProgressRhythm
        model={model}
        range="Year"
        onRangeChange={jest.fn()}
        testID="test-rhythm"
      />
    );

    expect(getByTestId('test-rhythm-year')).toBeTruthy();
    expect(getByText('Dec')).toBeTruthy();
  });

  it('calls onRangeChange when switching segments', () => {
    const now = new Date('2026-10-25T12:00:00.000Z');
    const model = toV2ProgressModel(anchor, [], [], { now })!;
    const onRangeChange = jest.fn();

    const { getByText } = render(
      <V2ProgressRhythm
        model={model}
        range="Year"
        onRangeChange={onRangeChange}
        testID="test-rhythm"
      />
    );

    fireEvent.press(getByText('Month'));
    expect(onRangeChange).toHaveBeenCalledWith('Month');
  });
});
