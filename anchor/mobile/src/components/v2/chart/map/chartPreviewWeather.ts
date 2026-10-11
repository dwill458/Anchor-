import { useMemo } from 'react';
import { useChartHighWater } from '@/hooks/v2/chart/chartHighWater';
import { nextHighWater, routeRevealArc, type ChartWeatherProgress } from './chartProgress';
import { buildRouteTable, waypointPlacement } from './chartMapGeometry';

/** Read-only preview equivalent of ChartActiveView's routeRevealArc calculation. */
export function useChartWeatherCoverArc(progress: ChartWeatherProgress | null | undefined): number {
  const highWater = useChartHighWater(undefined, progress?.courseId);
  const table = useMemo(() => buildRouteTable(), []);
  const inputs = progress?.inputs ?? [];
  const placement = useMemo(() => waypointPlacement(Math.max(1, inputs.length)), [inputs.length]);
  const effectiveHighWater = useMemo(() => nextHighWater(highWater.map, inputs), [highWater.map, inputs]);
  return useMemo(() => routeRevealArc({
    inputs,
    currentIndex: progress?.currentIndex ?? 0,
    isFinished: progress?.isFinished ?? false,
    hw: effectiveHighWater,
    placement,
    table,
  }), [effectiveHighWater, inputs, placement, progress?.currentIndex, progress?.isFinished, table]);
}
