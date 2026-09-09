import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { V2ChartRouteMap } from '../V2ChartRouteMap';
import type { V2WaypointPresentation } from '@/adapters/v2/chart';

describe('V2ChartRouteMap', () => {
  const mockWaypoints: V2WaypointPresentation[] = [
    {
      id: 'wp-1',
      value: '100 users',
      description: 'First 100',
      state: 'completed',
      isCurrent: false,
      isDestination: false,
      reached: true,
      reachedAt: '2026-09-01T00:00:00Z',
      moves: [],
      doneMoveCount: 0,
      totalMoveCount: 0,
      raw: {} as any,
    },
    {
      id: 'wp-2',
      value: '1,000 users',
      description: 'First 1k',
      state: 'current',
      isCurrent: true,
      isDestination: false,
      reached: false,
      reachedAt: null,
      moves: [{ id: 'm1', waypointId: 'wp-2', text: 'Share link', done: false }],
      doneMoveCount: 0,
      totalMoveCount: 1,
      raw: {} as any,
    },
    {
      id: 'wp-3',
      value: '10,000 users',
      description: 'Destination',
      state: 'upcoming',
      isCurrent: false,
      isDestination: true,
      reached: false,
      reachedAt: null,
      moves: [],
      doneMoveCount: 0,
      totalMoveCount: 0,
      raw: {} as any,
    },
  ];

  it('renders SVG painted route map container and waypoint nodes', () => {
    const onWaypointPress = jest.fn();
    const { getByTestId, getByText } = render(
      <V2ChartRouteMap
        waypoints={mockWaypoints}
        currentWaypointIndex={1}
        template="gentle-s"
        onWaypointPress={onWaypointPress}
      />,
    );

    expect(getByTestId('v2-chart-route-map')).toBeTruthy();
    expect(getByTestId('waypoint-node-wp-1')).toBeTruthy();
    expect(getByTestId('waypoint-node-wp-2')).toBeTruthy();
    expect(getByTestId('waypoint-node-wp-3')).toBeTruthy();
    expect(getByText('100 users')).toBeTruthy();
    expect(getByText('1,000 users')).toBeTruthy();
    expect(getByText('CURRENT')).toBeTruthy();
  });

  it('triggers onWaypointPress callback on node tap', () => {
    const onWaypointPress = jest.fn();
    const { getByTestId } = render(
      <V2ChartRouteMap
        waypoints={mockWaypoints}
        currentWaypointIndex={1}
        onWaypointPress={onWaypointPress}
      />,
    );

    fireEvent.press(getByTestId('waypoint-node-wp-2'));
    expect(onWaypointPress).toHaveBeenCalledWith('wp-2');
  });
});
