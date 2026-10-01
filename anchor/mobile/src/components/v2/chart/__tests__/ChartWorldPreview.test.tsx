import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ChartWorldPreview } from '../ChartWorldPreview';
import { chartArtFor, chartFrame, chartWindowAroundRoutePoint, pointAt, toFramePoint } from '../chartRouteGeometry';
import { resolveAnchorChartState } from '@/adapters/v2/home/chartAdapter';

it.each(['desire', 'health', 'career', 'relationships', 'creativity'])('centers the current node in the actual %s environment', category => {
  const art = chartArtFor(category);
  const window = chartWindowAroundRoutePoint(0.4, 336, 180, art);
  const frame = chartFrame(336, art, window);
  const node = toFramePoint(pointAt(0.4, art), frame);
  expect(frame.height).toBeCloseTo(180);
  expect(node.y).toBeCloseTo(90);
});

it('keeps long waypoint and Move copy in normal flow without line clipping', () => {
  const title = 'A long waypoint '.repeat(12);
  const move = 'A real next move '.repeat(15);
  const chart = resolveAnchorChartState({ loading: false, error: null, data: {
    chart: { id: 'c', status: 'ACTIVE', destinationText: 'A real destination', currentWaypointId: 'w', currentMoveId: 'm',
      waypoints: [{ id: 'w', position: 0, title, state: 'CURRENT' }], moves: [{ id: 'm', title: move }] },
  } as never });
  if (chart.state !== 'ready') throw new Error('Expected a real Chart');
  render(<ChartWorldPreview chart={chart} width={286} />);
  expect(screen.getByText(title).props.numberOfLines).toBeUndefined();
  expect(screen.getByText(move).props.numberOfLines).toBeUndefined();
  expect(screen.getByTestId('v2-home-chart-route', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText('Toward: A real destination')).toBeNull();
  expect(screen.getByText('Next move')).toBeTruthy();
  expect(screen.getByTestId('v2-home-chart-map').props.style[1].height).toBe(68);
  expect(screen.queryByTestId('v2-details-chart-map')).toBeNull();
});

it('keeps Details as a compact world matching the Vision preview height', () => {
  const chart = resolveAnchorChartState({ loading: false, error: null, data: {
    chart: { id: 'c', status: 'ACTIVE', destinationText: 'A real destination', currentWaypointId: 'w', currentMoveId: null,
      waypoints: [{ id: 'w', position: 0, title: 'Current waypoint', state: 'CURRENT' }], moves: [] },
  } as never });
  if (chart.state !== 'ready') throw new Error('Expected a real Chart');
  render(<ChartWorldPreview chart={chart} width={286} variant="details" />);
  expect(screen.getByTestId('v2-details-chart-map')).toBeTruthy();
  expect(screen.queryByText('Toward: A real destination')).toBeNull();
  expect(screen.getByTestId('v2-details-chart-map').props.style[1].height).toBeCloseTo(286 * .6);
  expect(screen.getByLabelText(/Toward: A real destination/)).toBeTruthy();
  expect(screen.queryByTestId('v2-home-chart-route', { includeHiddenElements: true })).toBeNull();
});
