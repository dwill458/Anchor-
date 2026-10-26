import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartSheetHelpRow } from '../ChartSheetHelpRow';

describe('ChartSheetHelpRow', () => {
  it('offers Help me move forward as a quiet row, has no View your route, and routes the tap', () => {
    const onAskChart = jest.fn();
    const screen = render(<ChartSheetHelpRow category="career" onAskChart={onAskChart} />);
    fireEvent.press(screen.getByTestId('chart-help-forward'));
    expect(onAskChart).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Help me move forward')).toBeTruthy();
    expect(screen.queryByText('View your route')).toBeNull();
    expect(screen.queryByTestId('chart-view-route')).toBeNull();
  });

  it('shows nothing without a handler', () => {
    const nothing = render(<ChartSheetHelpRow category="career" />);
    expect(nothing.queryByTestId('chart-sheet-help-row')).toBeNull();
  });

  it('does not repeat the Anchor: that belongs to the Anchor card', () => {
    const screen = render(<ChartSheetHelpRow category="health" onAskChart={jest.fn()} />);
    expect(screen.queryByTestId('chart-open-anchor')).toBeNull();
    expect(screen.getByLabelText('Help me move forward')).toBeTruthy();
  });
});
