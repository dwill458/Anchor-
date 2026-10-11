import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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
