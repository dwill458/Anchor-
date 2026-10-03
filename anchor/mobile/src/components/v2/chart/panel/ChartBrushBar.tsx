import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { CHART_MAP_REDUCED_FADE } from '../chartMotion';

type Props = {
  /** 0..1 share of the current leg (1 = reached, 0 = upcoming). */
  fraction: number;
  color: string;
  reducedMotion: boolean;
  accessibilityLabel: string;
  testID?: string;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const HEIGHT = 11;

/** Fixed-seed generator: the brush looks hand-made but never changes between renders. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * The stroke for a bar of width `w`: slightly rough top and bottom edges and a
 * tapered, ragged leading (right) edge. Pure and deterministic.
 */
export function brushStrokePath(w: number, h: number = HEIGHT): string {
  const rnd = seeded(7);
  const step = 9;
  const n = Math.max(2, Math.ceil(w / step));
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= n; i++) {
    const x = Math.min(w, i * step);
    // Edges wander by about a pixel; the last stretch tapers toward the tip.
    const taper = Math.max(0, (x - (w - 26)) / 26);
    const ty = 0.8 + rnd() * 1.2 + taper * 1.6;
    const by = h - 0.8 - rnd() * 1.2 - taper * 2.4;
    top.push(`${x.toFixed(1)} ${ty.toFixed(1)}`);
    bottom.push(`${x.toFixed(1)} ${by.toFixed(1)}`);
  }
  const tip = `${(w + 1.5).toFixed(1)} ${(h / 2 + (rnd() - 0.5) * 1.5).toFixed(1)}`;
  return `M0 ${(h / 2).toFixed(1)} L${top.join(' L')} L${tip} L${bottom.reverse().join(' L')} Z`;
}

/** A few faint dry-brush streaks along the stroke. */
export function brushStreaks(w: number, h: number = HEIGHT): string {
  const rnd = seeded(31);
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const y = 2.2 + (i * (h - 4.4)) / 3 + (rnd() - 0.5) * 0.8;
    const x1 = rnd() * w * 0.25;
    const x2 = w * (0.55 + rnd() * 0.4);
    parts.push(`M${x1.toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

/**
 * The panel's brush-stroke progress bar (prototype .bar / #barfill). The width
 * follows the same p as the drawn route, so the bar and the map never disagree.
 * The stroke is right-aligned inside a clipping container that grows with p, so
 * the ragged tip always sits at the leading edge.
 */
export function ChartBrushBar({ fraction, color, reducedMotion, accessibilityLabel, testID }: Props) {
  const p = clamp01(Number.isFinite(fraction) ? fraction : 0);
  const width = useSharedValue(p);
  const [trackW, setTrackW] = useState(300);

  useEffect(() => {
    width.value = withTiming(p, {
      duration: reducedMotion ? CHART_MAP_REDUCED_FADE : 400,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [p, reducedMotion, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const stroke = useMemo(() => brushStrokePath(Math.max(8, trackW - 2)), [trackW]);
  const streaks = useMemo(() => brushStreaks(Math.max(8, trackW - 2)), [trackW]);

  return (
    <View
      testID={testID}
      style={styles.track}
      onLayout={(event: LayoutChangeEvent) => setTrackW(event.nativeEvent.layout.width || 300)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      <Animated.View style={[styles.clip, fill]}>
        <Svg width={trackW} height={HEIGHT} viewBox={`0 0 ${trackW} ${HEIGHT}`} style={styles.stroke}>
          <Path d={stroke} fill={color} />
          <Path d={streaks} stroke="rgba(244,241,233,.22)" strokeWidth={0.6} fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: HEIGHT, borderRadius: 5, backgroundColor: T.progressTrack, overflow: 'hidden' },
  clip: { height: HEIGHT, overflow: 'hidden' },
  stroke: { position: 'absolute', right: 0, top: 0 },
});
