/**
 * HandDrawnThreadLine.tsx
 *
 * A single hand-drawn stroke that reads as a value: a faint full-length track
 * with a filled thread laid over it from the left up to `percent`.
 *
 * The drawn quality is deterministic. Wobble and weight are fixed functions of
 * the x coordinate (no randomness), so the line is identical on every render
 * and never jitters. Each stroke is a filled ribbon whose weight varies along
 * its length and tapers to a point at both ends.
 *
 * Display only. It does not compute or decay Thread Strength; the braided
 * `ThreadStrength` component keeps every other surface.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';

export interface HandDrawnThreadLineProps {
  /** Thread Strength value, clamped 0-100. */
  percent: number;
  /** Category colour token for the filled thread. */
  color: string;
  /** Custom track color (defaults to colors.text.secondary). */
  trackColor?: string;
  /** Custom label color (defaults to colors.text.secondary). */
  labelColor?: string;
  /** No baseline yet: the track renders with no fill and no percentage. */
  unmeasured?: boolean;
  /** Compact rows use a fixed short line and a smaller label. */
  compact?: boolean;
  /** Fixed line width in dp; when omitted the line fills the space beside the label. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TRACK_OPACITY = 0.15;
/** Below this many dp the fill would read as a dot, so it is floored. */
const MIN_FILL_PX = 9;
const SAMPLE_STEP_PX = 3;

type Dims = { height: number; weight: number; taper: number };
const FULL: Dims = { height: 18, weight: 3.6, taper: 20 };
const COMPACT: Dims = { height: 12, weight: 2.6, taper: 12 };

/** Centre line: two fixed sines give a slow drift plus a small tremor. */
function centreY(x: number, height: number): number {
  const amplitude = height * 0.13;
  return height / 2 + amplitude * (0.62 * Math.sin(x / 31 + 0.6) + 0.38 * Math.sin(x / 11.5 + 2.1));
}

/** Uneven weight along the stroke, before tapering. */
function weightAt(x: number, weight: number): number {
  return weight * (0.82 + 0.34 * (0.5 + 0.5 * Math.sin(x / 17 + 1.3)));
}

/**
 * A filled ribbon from x = 0 to x = length, tapered at both ends. The wobble
 * uses absolute x so a fill of any length lies exactly on the track.
 */
export function buildThreadRibbonPath(length: number, dims: Dims): string {
  if (!(length > 0)) return '';
  const { height, weight, taper } = dims;
  const ease = Math.min(taper, length * 0.45);
  const count = Math.max(6, Math.ceil(length / SAMPLE_STEP_PX));
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= count; i += 1) {
    const x = (length * i) / count;
    const edge = Math.min(x, length - x);
    const t = ease > 0 ? Math.min(1, edge / ease) : 1;
    const taperFactor = 0.12 + 0.88 * Math.sin((t * Math.PI) / 2);
    const half = (weightAt(x, weight) * taperFactor) / 2;
    const y = centreY(x, height);
    top.push(`${x.toFixed(1)} ${(y - half).toFixed(2)}`);
    bottom.push(`${x.toFixed(1)} ${(y + half).toFixed(2)}`);
  }
  return `M ${top.join(' L ')} L ${bottom.reverse().join(' L ')} Z`;
}

export function HandDrawnThreadLine({
  percent,
  color,
  trackColor,
  labelColor,
  unmeasured = false,
  compact = false,
  width,
  style,
  testID = 'thread-line',
}: HandDrawnThreadLineProps) {
  const dims = compact ? COMPACT : FULL;
  const clamped = Math.min(100, Math.max(0, Math.round(Number.isFinite(percent) ? percent : 0)));
  const [measured, setMeasured] = useState(0);
  const lineWidth = width ?? measured;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const w = Math.round(event.nativeEvent.layout.width);
    setMeasured((prev) => (prev === w ? prev : w));
  }, []);

  const trackPath = useMemo(() => buildThreadRibbonPath(lineWidth, dims), [lineWidth, dims]);
  // Value-proportional, with a floor so a low value is still a visible thread.
  const fillLength = useMemo(() => {
    if (unmeasured || lineWidth <= 0) return 0;
    return Math.min(lineWidth, Math.max((lineWidth * clamped) / 100, Math.min(lineWidth, MIN_FILL_PX)));
  }, [clamped, lineWidth, unmeasured]);
  const fillPath = useMemo(() => buildThreadRibbonPath(fillLength, dims), [fillLength, dims]);

  const label = unmeasured ? '' : `${clamped}%`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={unmeasured ? 'Consistency not established yet' : `Consistency ${clamped}%`}
      style={[styles.row, style]}
    >
      <View
        testID={`${testID}-track`}
        onLayout={width === undefined ? handleLayout : undefined}
        style={[
          width === undefined ? styles.lineFlex : styles.lineFixed,
          { height: dims.height },
          width !== undefined && { width },
        ]}
      >
        {lineWidth > 0 ? (
          <Svg width={lineWidth} height={dims.height} viewBox={`0 0 ${lineWidth} ${dims.height}`}>
            <Path d={trackPath} fill={trackColor ?? colors.text.secondary} opacity={TRACK_OPACITY} />
            {fillPath ? <Path d={fillPath} fill={color} /> : null}
          </Svg>
        ) : null}
      </View>
      {label ? (
        <Text
          style={[
            styles.label,
            compact && styles.labelCompact,
            labelColor ? { color: labelColor } : undefined,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineFlex: { flex: 1, justifyContent: 'center' },
  lineFixed: { flexGrow: 0, flexShrink: 0, justifyContent: 'center' },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    minWidth: 32,
    textAlign: 'right',
  },
  labelCompact: { fontSize: 11.5, minWidth: 30 },
});
