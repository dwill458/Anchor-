import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/v2';

const VIEW_W = 1000;
export const TORN_EDGE_RATIO = 0.09;
const VIEW_H = 90;

/**
 * A torn-paper top edge, deterministic so it never shimmers between renders.
 * Cream below the tear, transparent above it. Static path: no filter, mask or
 * per-frame work.
 */
export function tornEdgePath(seed = 7, steps = 46): string {
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const step = VIEW_W / steps;
  let d = `M0,${VIEW_H} L0,${38 + rand() * 12}`;
  let wave = 0;
  for (let i = 1; i <= steps; i++) {
    wave += (rand() - 0.5) * 16;
    wave *= 0.8;
    const y = 42 + Math.sin(i * 0.37) * 9 + wave + (rand() - 0.5) * 12;
    d += ` L${(i * step).toFixed(1)},${Math.max(10, Math.min(72, y)).toFixed(1)}`;
  }
  return `${d} L${VIEW_W},${VIEW_H} Z`;
}

export const VisionTornEdge = memo(function VisionTornEdge({ width, color = colors.canvas, seed = 7, testID }: { width: number; color?: string; seed?: number; testID?: string }) {
  const d = useMemo(() => tornEdgePath(seed), [seed]);
  return (
    <Svg testID={testID} pointerEvents="none" accessible={false} width={width} height={width * TORN_EDGE_RATIO}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
      <Path d={d} fill={color} />
    </Svg>
  );
});
