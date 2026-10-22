import React from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { V2ChartScreen } from './V2ChartScreen';

type Params = { anchorId: string; waypointId: string };

/** Compatibility/deep-link entry into the persistent Chart scene. */
export function V2ChartWaypointScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const { anchorId, waypointId } = route.params ?? { anchorId: '', waypointId: '' };
  return <V2ChartScreen anchorId={anchorId} initialWaypointId={waypointId} testID="v2-chart-waypoint" />;
}
