import { useMemo } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { ChartMapAnimState } from './chartMapContracts';
import { OVERVIEW_CAMERA } from './chartMapGeometry';

/**
 * Creates every shared value of the map (see ChartMapAnimState). Stable across
 * renders: ChartActiveView owns it, <ChartMap> renders it, sequences drive it.
 */
export function useChartMapAnimState(
  initial?: Partial<{ revealArc: number; flagIndex: number; closed: number; camera: { cx: number; cy: number; s: number } }>,
): ChartMapAnimState {
  const cx = useSharedValue<number>(initial?.camera?.cx ?? OVERVIEW_CAMERA.cx);
  const cy = useSharedValue<number>(initial?.camera?.cy ?? OVERVIEW_CAMERA.cy);
  const s = useSharedValue<number>(initial?.camera?.s ?? OVERVIEW_CAMERA.s);
  const revealArc = useSharedValue<number>(initial?.revealArc ?? 0);
  const fog = useSharedValue(0);
  const mapOpacity = useSharedValue(1);
  const flagIndex = useSharedValue<number>(initial?.flagIndex ?? 0);
  const flagDrop = useSharedValue(1);
  const flagOpacity = useSharedValue(1);
  // Rests at 1 (invisible: opacity .9*(1-u)); sequences tween 0 -> 1.
  const pulse = useSharedValue(1);
  const stampIndex = useSharedValue(-1);
  const stamp = useSharedValue(0);
  const glyph = useSharedValue(0);
  const goldDot = useSharedValue(0);
  const coverArc = useSharedValue<number>(initial?.revealArc ?? 0);
  const closed = useSharedValue<number>(initial?.closed ?? 0);

  return useMemo<ChartMapAnimState>(
    () => ({
      camera: { cx, cy, s },
      revealArc, fog, mapOpacity, flagIndex, flagDrop, flagOpacity, pulse, stampIndex, stamp, glyph, goldDot, coverArc, closed,
    }),
    [cx, cy, s, revealArc, fog, mapOpacity, flagIndex, flagDrop, flagOpacity, pulse, stampIndex, stamp, glyph, goldDot, coverArc, closed],
  );
}
