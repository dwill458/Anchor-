import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartSheetHelpRow } from '../ChartSheetHelpRow';

describe('ChartSheetHelpRow', () => {
  it('offers Help me move forward and View your route, and routes each tap', () => {
    const onAskChart = jest.fn();
    const onViewRoute = jest.fn();
    const screen = render(<ChartSheetHelpRow category="career" onAskChart={onAskChart} onViewRoute={onViewRoute} />);
    fireEvent.press(screen.getByTestId('chart-help-forward'));
    fireEvent.press(screen.getByTestId('chart-view-route'));
    expect(onAskChart).toHaveBeenCalledTimes(1);
    expect(onViewRoute).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Help me move forward')).toBeTruthy();
    expect(screen.getByText('View your route')).toBeTruthy();
  });

  it('shows only what can work, and nothing without handlers', () => {
    const askOnly = render(<ChartSheetHelpRow category="career" onAskChart={jest.fn()} />);
    expect(askOnly.getByTestId('chart-help-forward')).toBeTruthy();
    expect(askOnly.queryByTestId('chart-view-route')).toBeNull();
    const nothing = render(<ChartSheetHelpRow category="career" />);
    expect(nothing.queryByTestId('chart-sheet-help-row')).toBeNull();
  });

  it('does not repeat the Anchor: that belongs to the Anchor card', () => {
    const screen = render(<ChartSheetHelpRow category="health" onAskChart={jest.fn()} onViewRoute={jest.fn()} />);
    expect(screen.queryByTestId('chart-open-anchor')).toBeNull();
    expect(screen.getByLabelText('Help me move forward')).toBeTruthy();
    expect(screen.getByLabelText('View your route')).toBeTruthy();
  });
});
