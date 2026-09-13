import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { V2ChartEmptyState } from '../V2ChartEmptyState';

describe('V2ChartEmptyState', () => {
  it('renders State A (no Anchor) with illustrated empty state and CTA to create anchor', () => {
    const onCreateAnchorMock = jest.fn();
    const onCreateChartMock = jest.fn();

    const { getByText, getByTestId, queryByText } = render(
      <V2ChartEmptyState
        hasAnchor={false}
        onCreateAnchor={onCreateAnchorMock}
        onCreateChart={onCreateChartMock}
      />,
    );

    expect(getByTestId('v2-chart-empty-state-no-anchor')).toBeTruthy();
    expect(getByText('NO ANCHOR YET')).toBeTruthy();
    expect(getByText('Every journey begins with an Anchor')).toBeTruthy();
    expect(getByText('Create your first Anchor →')).toBeTruthy();
    expect(queryByText('Give this Anchor somewhere to go.')).toBeNull();

    fireEvent.press(getByText('Create your first Anchor →'));
    expect(onCreateAnchorMock).toHaveBeenCalledTimes(1);
    expect(onCreateChartMock).not.toHaveBeenCalled();
  });

  it('renders State B (anchor exists, no course) with faint emerging route and creation flow', () => {
    const onCreateAnchorMock = jest.fn();
    const onCreateChartMock = jest.fn();

    const { getByText, getByTestId, queryByTestId, getByPlaceholderText } = render(
      <V2ChartEmptyState
        hasAnchor={true}
        anchorName="Career Breakthrough"
        onCreateAnchor={onCreateAnchorMock}
        onCreateChart={onCreateChartMock}
      />,
    );

    expect(getByTestId('v2-chart-empty-state-no-chart')).toBeTruthy();
    expect(getByText('Career Breakthrough')).toBeTruthy();
    expect(getByText('Give this Anchor somewhere to go.')).toBeTruthy();
    expect(getByText('Create a Chart →')).toBeTruthy();

    // Modal is initially not visible
    expect(queryByTestId('chart-creation-modal')).toBeNull();

    // Press Create a Chart CTA
    fireEvent.press(getByText('Create a Chart →'));

    // Modal opens
    expect(getByTestId('chart-creation-modal')).toBeTruthy();
    expect(getByText('Map your route')).toBeTruthy();
    expect(getByText('Gentle S curve')).toBeTruthy();
    expect(getByText('Wide zig-zag')).toBeTruthy();
    expect(getByText('Rising arc')).toBeTruthy();
    expect(getByText('Double bend')).toBeTruthy();

    // Select Rising Arc template
    fireEvent.press(getByText('Rising arc'));

    // Type destination
    const input = getByPlaceholderText('e.g., Launch my first product, Speak at conference');
    fireEvent.changeText(input, 'Reach 1,000 customers');

    // Submit creation
    fireEvent.press(getByTestId('submit-create-chart-btn'));
    expect(onCreateChartMock).toHaveBeenCalledWith('Reach 1,000 customers', 'rising-arc');
  });
});
