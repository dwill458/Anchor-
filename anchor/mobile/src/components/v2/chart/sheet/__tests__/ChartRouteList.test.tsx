import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { chartSegmentFractions } from '../ChartRouteSegments';
import { ChartRouteList } from '../ChartRouteList';
import { viewOf } from '../../panel/__tests__/chartPanelFixtures';

it('shows dates and truthful current progress; upcoming titles can be inspected from the route', () => {
  const viewWaypoint = jest.fn();
  const screen = render(<ChartRouteList view={viewOf()} color="#D9A441" viewWaypoint={viewWaypoint} />);
  expect(screen.getByText('Your route')).toBeTruthy();
  const date = new Date(viewOf().waypoints[0].reachedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  expect(screen.getByText(`Reached ${date}`)).toBeTruthy();
  expect(screen.getByText(`${Math.round(chartSegmentFractions(viewOf())[1] * 100)}%`)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Waypoint 3: Reach 10,000 active users'));
  expect(viewWaypoint).toHaveBeenCalledWith(2);
});
