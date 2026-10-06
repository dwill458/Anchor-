import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';
import type { V2ProgressSparkPoint } from '@/adapters/v2/progress/types';
import { progressTokens } from './progressTokens';

export interface V2ProgressSparklineProps {
  points: V2ProgressSparkPoint[];
  /** Current Consistency, printed beside the label. */
  current: number | null;
  testID?: string;
}

const HEIGHT = 54;
const PAD = 6;
/** The Established threshold; drawn only when the range reaches it. */
const ESTABLISHED = 50;

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.round(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** Pure geometry, exported for tests: points placed by date across the width. */
export function sparkCoordinates(
  points: V2ProgressSparkPoint[],
  width: number,
  height: number = HEIGHT,
): Array<{ x: number; y: number }> {
  if (points.length === 0 || width <= 0) return [];
  const values = points.map((p) => p.value);
  const min = Math.min(...values, ESTABLISHED) - 4;
  const max = Math.max(...values, ESTABLISHED) + 4;
  const first = dayNumber(points[0].dateKey);
  const span = Math.max(1, dayNumber(points[points.length - 1].dateKey) - first);
  return points.map((p) => ({
    x: ((dayNumber(p.dateKey) - first) / span) * width,
    y: height - ((p.value - min) / (max - min)) * height,
  }));
}

/** Consistency over the last 30 days, from persisted values only. Hidden with fewer than two points. */
export const V2ProgressSparkline: React.FC<V2ProgressSparklineProps> = ({
  points,
  current,
  testID = 'v2-progress-spark',
}) => {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === w ? prev : w));
  }, []);

  const drawn = useMemo(() => {
    // Leave room for the end dot and its stroke.
    const inner = Math.max(0, width - PAD * 2);
    return sparkCoordinates(points, inner, HEIGHT).map((p) => ({ x: p.x + PAD, y: p.y + PAD }));
  }, [points, width]);

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values, ESTABLISHED) - 4;
  const hi = Math.max(...values, ESTABLISHED) + 4;
  const baselineY = HEIGHT - ((ESTABLISHED - lo) / (hi - lo)) * HEIGHT + PAD;
  const line = drawn.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const end = drawn[drawn.length - 1];

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.label}>Thread Strength · last 30 days</Text>
        {current !== null ? <Text style={styles.value}>{Math.round(current)}</Text> : null}
      </View>
      <View onLayout={onLayout} style={{ height: HEIGHT + PAD * 2 }}>
        {drawn.length > 0 ? (
          <Svg width={width} height={HEIGHT + PAD * 2}>
            <Line
              x1={0}
              x2={width}
              y1={baselineY}
              y2={baselineY}
              stroke={progressTokens.inkWash(0.18)}
              strokeDasharray="3 4"
            />
            <Path d={line} fill="none" stroke={colors.ink.base} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={end.x} cy={end.y} r={4.5} fill={colors.cream} stroke={progressTokens.gold} strokeWidth={2} />
          </Svg>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: progressTokens.hairline },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  label: { ...typography.labelSM, fontSize: 10, letterSpacing: 1, color: progressTokens.muted },
  value: { ...typography.labelMD, color: progressTokens.text },
});
