import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MAP_H, MAP_W } from '@/components/v2/chart/map/chartMapContracts';
import { ChartMapCrop } from '../ChartMapCrop';
import { ChartMap } from '@/components/v2/chart/map/ChartMap';
import { waypointPlacement } from '@/components/v2/chart/map/chartMapGeometry';

jest.mock('@/components/v2/chart/map/ChartMap', () => ({ ChartMap: () => require('react').createElement(require('react-native').View, { testID: 'chart-map-test-double' }) }));
jest.mock('@/components/v2/chart/map/ChartWeatherNativeVeil', () => ({ ChartWeatherVeilPrimer: () => null }));

const data = { category: 'focus', status: 'active' as const, waypointIndex: 2, waypointTotal: 3, title: 'Second waypoint' };

it('updates only the cloud and land reveal arc while retaining crop geometry and waypoint visibility', () => {
  const screenView = render(<ChartMapCrop data={data} full={false} coverArc={180} />);
  const crop = screenView.getByTestId('chart-map-crop', { includeHiddenElements: true });
  fireEvent(crop, 'layout', { nativeEvent: { layout: { width: 260, height: 200 } } });

  let map = screenView.UNSAFE_getByType(ChartMap);
  expect(map.props.weather).toBe('textured');
  expect(map.props.reducedMotion).toBe(true);
  expect(map.props.width).toBe(260);
  expect(map.props.anim.coverArc.value).toBe(180);
  expect(map.props.anim.revealArc.value).toBe(waypointPlacement(3).arcs[1]);
  expect(map.props.markers.map((marker: { state: string }) => marker.state)).toEqual(['upcoming', 'current', 'upcoming']);

  screenView.rerender(<ChartMapCrop data={data} full={false} coverArc={240} />);
  map = screenView.UNSAFE_getByType(ChartMap);
  expect(map.props.width).toBe(260);
  expect(map.props.anim.coverArc.value).toBe(240);
  expect(map.props.anim.revealArc.value).toBe(waypointPlacement(3).arcs[1]);

  screenView.rerender(<ChartMapCrop data={{ ...data, status: 'complete' }} full={false} coverArc={420} weatherComplete={false} />);
  map = screenView.UNSAFE_getByType(ChartMap);
  expect(map.props.arrived).toBe(true);
  expect(map.props.weatherComplete).toBe(false);
  expect(map.props.anim.fog.value).toBe(0);
  expect(map.props.anim.coverArc.value).toBe(420);
});

it.each([1, 3, 5, 12])('crops the registered %i-waypoint map without stretching or uncovering future terrain', count => {
  const waypoints = Array.from({ length: count }, (_, i) => ({ id: `real-${i}`, title: `Real title ${i}`,
    reached: i === 0, isCurrent: i === Math.min(1, count - 1) }));
  const waypointIndex = Math.min(2, count);
  const view = render(<ChartMapCrop full={false} data={{ ...data, waypointIndex, waypointTotal: count }}
    height={145} initialWidth={286} waypoints={waypoints} coverArc={120} weatherComplete={false} />);
  const crop = view.getByTestId('chart-map-crop', { includeHiddenElements: true });
  expect(StyleSheet.flatten(crop.props.style).height).toBe(145);
  const map = view.UNSAFE_getByType(ChartMap);
  expect(map.props.width).toBe(286);
  expect(map.props.interactive).toBe(false);
  expect(map.props.weather).toBe('textured');
  expect(map.props.anim.coverArc.value).toBe(120);
  expect(map.props.anim.fog.value).toBe(0);
  expect(map.props.markers[0].state).toBe('done');
  expect(map.props.markers[0].id).toBe('real-0');
  const top = Math.max(0, Math.min(286 * MAP_H / MAP_W - 145,
    waypointPlacement(count).points[waypointIndex - 1].y * 286 / MAP_W - 145 * .42));
  expect(view.getByTestId('chart-preview-map-offset', { includeHiddenElements: true }).props.style.top).toBeCloseTo(-top);
  fireEvent(crop, 'layout', { nativeEvent: { layout: { width: 250, height: 145 } } });
  expect(view.UNSAFE_getByType(ChartMap).props.width).toBe(250);
  expect(view.UNSAFE_getByType(ChartMap).props.anim.coverArc.value).toBe(120);
  expect(StyleSheet.flatten(crop.props.style).height).toBe(145);
});
