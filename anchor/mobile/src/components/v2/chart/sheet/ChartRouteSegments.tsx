import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import type { HighWaterMap, WaypointProgressInput } from '../map/chartMapContracts';
import { toProgressInput, waypointFraction } from '../map/chartProgress';
import { CHART_EASING } from '../chartMotion';

export function chartSegmentFractions(view: ChartViewModel, inputs?: WaypointProgressInput[], hw?: HighWaterMap): number[] {
  return view.waypoints.map(waypoint => waypoint.state === 'completed' ? 1 : waypoint.state === 'upcoming' ? 0 : waypointFraction(inputs?.find(input => input.id === waypoint.id) ?? toProgressInput(waypoint), hw?.[waypoint.id] ?? 0).p);
}
function Segment({ p, color, reducedMotion, index }: { p: number; color: string; reducedMotion: boolean; index: number }) {
  const fill = useSharedValue(p);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      fill.value = p;
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: 180, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    } else fill.value = withTiming(p, { duration: 600, easing: CHART_EASING.settle, reduceMotion: ReduceMotion.Never });
  }, [fill, opacity, p, reducedMotion]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%`, opacity: opacity.value }));
  return <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }} testID={`chart-route-segment-${index}`}><Animated.View style={[styles.fill, { backgroundColor: color }, style]} /></View>;
}
export function ChartRouteSegments({ view, inputs, hw, color, reducedMotion }: { view: ChartViewModel; inputs?: WaypointProgressInput[]; hw?: HighWaterMap; color: string; reducedMotion: boolean }) {
  return <View style={styles.row} testID="chart-route-segments">{chartSegmentFractions(view, inputs, hw).map((p, index) => <Segment key={view.waypoints[index].id} index={index} p={p} color={color} reducedMotion={reducedMotion} />)}</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 4 }, track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#2A3440', overflow: 'hidden' }, fill: { height: 6, borderRadius: 3 } });
