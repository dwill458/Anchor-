import React from 'react';
import { render } from '@testing-library/react-native';
import { ChartRouteSegments, chartSegmentFractions } from '../ChartRouteSegments';
import { course, viewOf } from '../../panel/__tests__/chartPanelFixtures';
import { toProgressInput, waypointFraction } from '../../map/chartProgress';

it('uses exactly the route fraction, reached=1, upcoming=0, with the same baseline and high-water', () => {
  const raw = course();
  const view = viewOf(raw);
  const inputs = view.waypoints.map(w => toProgressInput(w, raw.waypoints.find(item => item.id === w.id)?.metric));
  const hw = { w2: .8 };
  const p = waypointFraction(inputs[1], .8).p;
  expect(chartSegmentFractions(view, inputs, hw)).toEqual([1, p, 0]);
  const screen = render(<ChartRouteSegments view={view} inputs={inputs} hw={hw} color="#D9A441" reducedMotion />);
  expect(screen.getByTestId('chart-route-segment-1').props.accessibilityValue.now).toBe(Math.round(p * 100));
});
