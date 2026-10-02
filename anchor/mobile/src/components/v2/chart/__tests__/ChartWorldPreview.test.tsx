import React from 'react';
import { StyleSheet } from 'react-native';
import { colors, getCategoryTextColor } from '@/theme/v2';
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

it('Home: once today\'s Move is done the One Move row says so instead of naming the next Move', () => {
  const chart = resolveAnchorChartState({ loading: false, error: null, data: {
    chart: { id: 'c', status: 'ACTIVE', destinationText: 'A real destination', currentWaypointId: 'w', currentMoveId: 'm2',
      waypoints: [{ id: 'w', position: 0, title: 'Current waypoint', state: 'CURRENT' }],
      moves: [
        { id: 'm1', waypointId: 'w', title: 'Finished today', status: 'COMPLETED', completedAt: new Date().toISOString() },
        { id: 'm2', waypointId: 'w', title: 'Tomorrow\'s real move', status: 'ACTIVE' },
      ] },
  } as never });
  if (chart.state !== 'ready') throw new Error('Expected a real Chart');
  expect(chart.todayMoveDone).toBe(true);
  render(<ChartWorldPreview chart={chart} width={286} />);
  expect(screen.getByText("Today's move is done.")).toBeTruthy();
  expect(screen.getByTestId('v2-home-chart-one-move').props.children).toBe('Next move tomorrow.');
  expect(screen.queryByText('Next move')).toBeNull();
  expect(screen.queryByText("Tomorrow's real move")).toBeNull();
});

it('Home: a Chart with no Move completed today keeps the "Next move" row (todayMoveDone missing reads as false)', () => {
  const chart = resolveAnchorChartState({ loading: false, error: null, data: {
    chart: { id: 'c', status: 'ACTIVE', destinationText: 'A real destination', currentWaypointId: 'w', currentMoveId: 'm',
      waypoints: [{ id: 'w', position: 0, title: 'Current waypoint', state: 'CURRENT' }],
      moves: [{ id: 'm', waypointId: 'w', title: 'Do the thing', status: 'ACTIVE' }] },
  } as never });
  if (chart.state !== 'ready') throw new Error('Expected a real Chart');
  expect(chart.todayMoveDone).toBeUndefined();
  render(<ChartWorldPreview chart={chart} width={286} />);
  expect(screen.getByText('Next move')).toBeTruthy();
  expect(screen.getByTestId('v2-home-chart-one-move').props.children).toBe('Do the thing');
  expect(screen.queryByText("Today's move is done.")).toBeNull();
});

it.each(['desire', 'health', 'career', 'relationships', 'creativity', 'spirituality', 'abundance', 'family', 'learning', 'adventure', 'focus', 'custom'])(
  'Home: the "Next move" label uses the %s category colour (never gold) at AA contrast on the ink card',
  category => {
    const chart = resolveAnchorChartState({ loading: false, error: null, data: {
      chart: { id: 'c', status: 'ACTIVE', destinationText: 'A destination', currentWaypointId: 'w', currentMoveId: 'm',
        waypoints: [{ id: 'w', position: 0, title: 'Waypoint', state: 'CURRENT' }], moves: [{ id: 'm', title: 'A move' }] },
    } as never });
    if (chart.state !== 'ready') throw new Error('Expected a real Chart');
    render(<ChartWorldPreview chart={chart} width={286} category={category} />);
    const style = StyleSheet.flatten(screen.getByText('Next move').props.style);
    expect(String(style.color).toUpperCase()).not.toBe('#E0A038');
    expect(style.color).toBe(getCategoryTextColor(category, colors.ink.deep, colors.graphite.text.primary));
    expect(contrastOn(String(style.color), colors.ink.deep)).toBeGreaterThanOrEqual(4.5);
  },
);

function contrastOn(fg: string, bg: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
