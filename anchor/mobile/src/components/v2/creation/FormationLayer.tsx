import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import { colors, typography } from '@/theme/v2';
import type { SigilFormation } from '@/utils/sigil/traditional-generator';
import { vertexArrivalFractions, type FormationTimeline } from './creationMotion';

const INK = colors.ink.base;
const POINT = 7;

/** Where along the whole formation each vertex is reached (fractions of formation progress). */
export function vertexArrivals(formation: SigilFormation, timeline: FormationTimeline): number[] {
  const span = timeline.pathEnd - timeline.pathStart;
  return vertexArrivalFractions(formation.vertices).map((fraction) => timeline.pathStart + fraction * span);
}

const VertexPoint = memo(function VertexPoint({
  x,
  y,
  letter,
  stack,
  arrival,
  settleStart,
  settleEnd,
  progress,
  accent,
}: {
  x: number;
  y: number;
  letter: string | null;
  /** How many earlier letters already landed on this cell, so labels do not sit on each other. */
  stack: number;
  arrival: number;
  settleStart: number;
  settleEnd: number;
  progress: SharedValue<number>;
  accent: string;
}) {
  const style = useAnimatedStyle(() => {
    const appear = interpolate(progress.value, [arrival, arrival + 0.025], [0, 1], 'clamp');
    const leave = interpolate(progress.value, [settleStart, settleEnd], [1, 0], 'clamp');
    return { opacity: appear * leave, transform: [{ scale: 0.4 + appear * 0.6 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.pointWrap, { left: x - POINT / 2, top: y - POINT / 2 }, style]}>
      <View style={[styles.point, { backgroundColor: accent }]} />
      {letter ? (
        <Animated.Text style={[styles.pointLabel, { color: accent, left: POINT + 2 + stack * 9 }]}>{letter}</Animated.Text>
      ) : null}
    </Animated.View>
  );
});

/**
 * Formation, drawn from the real computation: the grid the intention's category selects, each
 * distilled letter placed on its own cell in order, and the one line that joins them traced
 * at constant speed. Every point here is a vertex of the saved structure.
 */
export const FormationLayer = memo(function FormationLayer({
  svg,
  formation,
  size,
  progress,
  timeline,
  accent,
  reduceMotion,
}: {
  /** The stored structure — the same string that will be saved. */
  svg: string;
  formation: SigilFormation;
  size: number;
  progress: SharedValue<number>;
  timeline: FormationTimeline;
  accent: string;
  reduceMotion: boolean;
}) {
  const arrivals = useMemo(() => vertexArrivals(formation, timeline), [formation, timeline]);
  const stacks = useMemo(() => {
    const seen = new Map<number, number>();
    return formation.vertices.map((vertex) => {
      const count = seen.get(vertex.value) ?? 0;
      seen.set(vertex.value, count + 1);
      return count;
    });
  }, [formation]);
  const unit = size / 100;
  const settleStart = timeline.pathEnd;
  const settleEnd = timeline.pathEnd + (1 - timeline.pathEnd) * 0.55;

  const trace = useDerivedValue(() => {
    const span = timeline.pathEnd - timeline.pathStart;
    if (span <= 0) return progress.value >= timeline.pathStart ? 1 : 0;
    return Math.min(1, Math.max(0, (progress.value - timeline.pathStart) / span));
  });

  const gridStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, timeline.gridEnd * 0.85, settleStart, settleEnd],
      [0, 1, 1, 0],
      'clamp',
    ),
  }));

  const stagedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [timeline.gridEnd * 0.5, timeline.pathEnd], [0, 1], 'clamp'),
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { width: size, height: size }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, gridStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {formation.gridCells.map((cell) => (
            <Circle key={cell.value} cx={cell.x} cy={cell.y} r={formation.gridSize > 5 ? 0.7 : 0.9} fill={INK} fillOpacity={0.24} />
          ))}
        </Svg>
      </Animated.View>
      {/* The line in ink while it is being made; colour arrives once it is whole. Reduced
          motion stages it in by opacity instead of tracing it. */}
      <Animated.View style={[StyleSheet.absoluteFill, reduceMotion ? stagedStyle : null]}>
        <AnchorMark svg={svg} size={size} strokeColor={INK} drawProgress={reduceMotion ? undefined : trace} />
      </Animated.View>
      {reduceMotion
        ? null
        : formation.vertices.map((vertex, index) => (
            <VertexPoint
              key={index}
              x={vertex.x * unit}
              y={vertex.y * unit}
              letter={vertex.letter}
              stack={stacks[index]}
              arrival={arrivals[index]}
              settleStart={settleStart}
              settleEnd={settleEnd}
              progress={progress}
              accent={accent}
            />
          ))}
    </View>
  );
});

const styles = StyleSheet.create({
  pointWrap: { position: 'absolute', width: POINT, height: POINT },
  point: { width: POINT, height: POINT, borderRadius: POINT / 2 },
  pointLabel: {
    position: 'absolute',
    top: -13,
    fontFamily: typography.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
});
