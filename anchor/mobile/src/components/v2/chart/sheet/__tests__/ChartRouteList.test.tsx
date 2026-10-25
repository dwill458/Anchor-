import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { chartSegmentFractions } from '../ChartRouteSegments';
import { ChartRouteList } from '../ChartRouteList';
import { course, move, viewOf } from '../../panel/__tests__/chartPanelFixtures';

const doneCourse = () => course({ currentMoveId: null, moves: [move({ id: 'm1', title: 'Finish onboarding redesign', status: 'COMPLETED', completedAt: '2026-10-01T00:00:00Z' }), move({ id: 'm2', title: 'Launch creator campaign', status: 'COMPLETED', completedAt: '2026-10-02T00:00:00Z' })] });

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

it('renders exactly one row per waypoint, and never a second row for a repeated id', () => {
  const view = viewOf();
  expect(render(<ChartRouteList view={view} color="#D9A441" viewWaypoint={jest.fn()} />).queryAllByTestId(/^chart-route-row-/)).toHaveLength(3);
  const repeated = { ...view, waypoints: [...view.waypoints, { ...view.waypoints[2], number: 4 }] };
  const screen = render(<ChartRouteList view={repeated} color="#D9A441" viewWaypoint={jest.fn()} />);
  expect(screen.queryAllByTestId(/^chart-route-row-/)).toHaveLength(3);
  expect(screen.getAllByText('Reach 10,000 active users')).toHaveLength(1);
});

it('opens the current row by default, one row at a time, and the current row reopens when tapped', () => {
  const raw = course();
  raw.waypoints[1].completionCriteria = 'Growth is visible.';
  raw.waypoints[2].completionCriteria = 'Ten thousand people use it.';
  const screen = render(<ChartRouteList view={viewOf(raw)} color="#D9A441" viewWaypoint={jest.fn()} />);
  expect(screen.getByTestId('chart-route-body-1')).toBeTruthy();
  expect(screen.queryByTestId('chart-route-body-2')).toBeNull();
  fireEvent.press(screen.getByTestId('chart-route-row-2'));
  expect(screen.getByTestId('chart-route-body-2')).toBeTruthy();
  expect(screen.queryByTestId('chart-route-body-1')).toBeNull();
  // The other rows show only their reached-when line.
  expect(screen.queryByTestId('chart-route-reach')).toBeNull();
  expect(screen.getByText(/ten thousand people use it./)).toBeTruthy();
  fireEvent.press(screen.getByTestId('chart-route-row-1'));
  expect(screen.getByTestId('chart-route-body-1')).toBeTruthy();
  expect(screen.queryByTestId('chart-route-body-2')).toBeNull();
});

it('lists the current moves with a Next tag, and keeps Mark waypoint reached disabled until every move is done', () => {
  const onReach = jest.fn();
  const screen = render(<ChartRouteList view={viewOf()} color="#D9A441" viewWaypoint={jest.fn()} onReach={onReach} />);
  expect(screen.getByText('Finish onboarding redesign')).toBeTruthy();
  expect(screen.getAllByText('Next')).toHaveLength(1);
  expect(screen.getByText('2 moves left')).toBeTruthy();
  fireEvent.press(screen.getByTestId('chart-route-reach'));
  expect(onReach).not.toHaveBeenCalled();
  expect(screen.getByTestId('chart-route-reach').props.accessibilityState.disabled).toBe(true);
});

it('enables the same reach action once every move is done, and calls it once', () => {
  const onReach = jest.fn();
  const screen = render(<ChartRouteList view={viewOf(doneCourse())} color="#D9A441" viewWaypoint={jest.fn()} onReach={onReach} />);
  expect(screen.getByText('Ready')).toBeTruthy();
  expect(screen.queryByText('Next')).toBeNull();
  fireEvent.press(screen.getByTestId('chart-route-reach'));
  expect(onReach).toHaveBeenCalledTimes(1);
});
