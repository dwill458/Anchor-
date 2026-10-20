import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ChartWorldPreview } from '../ChartWorldPreview';
import { resolveAnchorChartState } from '@/adapters/v2/home/chartAdapter';

function ready(count = 3, current = 0, reached: number[] = [], complete = false) {
  const chart = resolveAnchorChartState({ loading: false, error: null, includeCompleted: true, data: {
    chart: { id: 'c', status: complete ? 'COMPLETED' : 'ACTIVE', destinationText: 'A real destination',
      currentWaypointId: `w${current}`, currentMoveId: 'm',
      waypoints: Array.from({ length: count }, (_, i) => ({ id: `w${i}`, position: i,
        title: `Real waypoint ${i + 1}`, state: reached.includes(i) ? 'REACHED' : i === current ? 'CURRENT' : 'UPCOMING' })),
      moves: [{ id: 'm', title: 'Actual next move' }] },
  } as never });
  if (chart.state !== 'ready') throw new Error('Expected Chart');
  return chart;
}

it.each([['home', 145], ['details', 165]] as const)('%s overlays copy on a fixed %idp etched-map window', (variant, height) => {
  const onPress = jest.fn();
  render(<ChartWorldPreview chart={ready()} width={286} variant={variant} onPress={onPress} />);
  expect(StyleSheet.flatten(screen.getByTestId('v2-home-chart').props.style).height).toBe(height);
  expect(StyleSheet.flatten(screen.getByTestId('chart-map-crop', { includeHiddenElements: true }).props.style).height).toBe(height);
  expect(screen.getByText('1 of 3')).toBeTruthy();
  expect(screen.getByText('Real waypoint 1')).toBeTruthy();
  expect(screen.queryByText('Actual next move')).toBeNull();
  fireEvent.press(screen.getByTestId('v2-home-chart'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each([1, 3, 5, 12])('renders %i segments from actual waypoint states', count => {
  render(<ChartWorldPreview chart={ready(count, Math.min(1, count - 1), [0])} width={286} />);
  expect(screen.getByTestId('chart-preview-segments').props.children).toHaveLength(count);
  expect(screen.getByTestId('chart-preview-segment-w0').props.accessibilityState.checked).toBe(true);
  if (count > 2) expect(screen.getByTestId('chart-preview-segment-w2').props.accessibilityState.checked).toBe(false);
});

it('updates title, count, crop and reached states when the server advances', () => {
  const view = render(<ChartWorldPreview chart={ready()} width={336} />);
  const previousTop = screen.getByTestId('chart-preview-map-offset', { includeHiddenElements: true }).props.style.top;
  view.rerender(<ChartWorldPreview chart={ready(3, 1, [0])} width={336} />);
  expect(screen.getByText('Real waypoint 2')).toBeTruthy();
  expect(screen.getByText('2 of 3')).toBeTruthy();
  expect(screen.getByTestId('chart-preview-segment-w0').props.accessibilityState.checked).toBe(true);
  expect(screen.getByTestId('chart-preview-map-offset', { includeHiddenElements: true }).props.style.top).not.toBe(previousTop);
});

it('keeps the just-reached current waypoint until the server advances it', () => {
  render(<ChartWorldPreview chart={ready(3, 1, [0, 1])} width={286} />);
  expect(screen.getByText('Real waypoint 2')).toBeTruthy();
  expect(screen.getByText('2 of 3')).toBeTruthy();
  expect(screen.getByTestId('chart-preview-segment-w1').props.accessibilityState.checked).toBe(true);
});

it('focuses the final waypoint for a completed Chart', () => {
  render(<ChartWorldPreview chart={ready(3, 2, [0, 1, 2], true)} width={286} />);
  expect(screen.getByText('3 of 3')).toBeTruthy();
  expect(screen.getByText('Real waypoint 3')).toBeTruthy();
  expect(screen.getByTestId('chart-preview-segment-w2').props.accessibilityState.checked).toBe(true);
  expect(screen.getByLabelText(/Chart complete/)).toBeTruthy();
});

it('bounds long titles on small screens while keeping the full title accessible', () => {
  const chart = ready();
  chart.waypoints[0].title = 'A long real waypoint title '.repeat(15);
  render(<ChartWorldPreview chart={chart} width={250} />);
  expect(screen.getByText(chart.waypoints[0].title).props.numberOfLines).toBe(2);
  expect(screen.getByLabelText(/A long real waypoint title/)).toBeTruthy();
});

it('does not invent a count for an empty route', () => {
  render(<ChartWorldPreview chart={ready(0)} width={286} />);
  expect(screen.queryByText(/of 0/)).toBeNull();
  expect(screen.queryByTestId('chart-preview-segments')).toBeNull();
});
