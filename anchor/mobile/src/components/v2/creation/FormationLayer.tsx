import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import { colors, typography } from '@/theme/v2';
import type { SigilFormation } from '@/utils/sigil/traditional-generator';
import { constructionFraction, vertexArrivalFractions, type FormationTimeline } from './creationMotion';

const INK = colors.ink.base;
const POINT = 8;
const PEN = 5;

export type StagePoint = { x: number; y: number };

/** Geometry of the square a formation is drawn on, in the structure's 100-unit box. */
export function kameaGeometry(formation: Pick<SigilFormation, 'gridSize' | 'gridCells'>) {
  const cells = formation.gridCells;
  const n = Math.max(1, formation.gridSize);
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  const min = { x: Math.min(...xs), y: Math.min(...ys) };
  const max = { x: Math.max(...xs), y: Math.max(...ys) };
  const pitch = n > 1 ? (max.x - min.x) / (n - 1) : 30;
  return { n, pitch, left: min.x - pitch / 2, top: min.y - pitch / 2, side: pitch * n };
}

/**
 * Where a cell's number sits, in px. The resting (ink) number and its lit (accent) twin share
 * this exactly, so the lit one lands precisely on top rather than beside it.
 */
function numeralBox(cell: { x: number; y: number }, pitch: number, unit: number) {
  const font = Math.max(8, Math.min(4.2, pitch * 0.22) * unit);
  return {
    left: (cell.x - pitch / 2) * unit + pitch * unit * 0.08,
    top: (cell.y - pitch / 2) * unit + pitch * unit * 0.05,
    fontSize: font,
    lineHeight: Math.round(font * 1.2),
  };
}

/**
 * The square as an instrument: an engraved drafting plate of the grid's cells, each carrying the
 * number a letter reduces to. Numbers sit in the cell's corner so the point a letter becomes,
 * at the cell's centre, is never covered.
 */
const KameaSquare = memo(function KameaSquare({
  formation,
  size,
  fadeStart,
  fadeEnd,
  progress,
}: {
  formation: SigilFormation;
  size: number;
  fadeStart: number;
  fadeEnd: number;
  progress: SharedValue<number>;
}) {
  const { n, pitch, left, top, side } = kameaGeometry(formation);
  const unit = size / 100;
  const rules = [];
  const PLATE_STROKE = 'rgba(244, 246, 250, 0.24)';
  const RULE_STROKE = 'rgba(244, 246, 250, 0.11)';

  for (let i = 1; i < n; i += 1) {
    rules.push(<Line key={`v${i}`} x1={left + pitch * i} y1={top} x2={left + pitch * i} y2={top + side} stroke={RULE_STROKE} strokeWidth={0.22} />);
    rules.push(<Line key={`h${i}`} x1={left} y1={top + pitch * i} x2={left + side} y2={top + pitch * i} stroke={RULE_STROKE} strokeWidth={0.22} />);
  }

  // Corner registration ticks to evoke a precision drafting instrument
  const tick = 1.4;
  const corners = [
    // Top-left
    <Line key="tl-h" x1={left - tick} y1={top} x2={left + tick} y2={top} stroke={PLATE_STROKE} strokeWidth={0.28} />,
    <Line key="tl-v" x1={left} y1={top - tick} x2={left} y2={top + tick} stroke={PLATE_STROKE} strokeWidth={0.28} />,
    // Top-right
    <Line key="tr-h" x1={left + side - tick} y1={top} x2={left + side + tick} y2={top} stroke={PLATE_STROKE} strokeWidth={0.28} />,
    <Line key="tr-v" x1={left + side} y1={top - tick} x2={left + side} y2={top + tick} stroke={PLATE_STROKE} strokeWidth={0.28} />,
    // Bottom-left
    <Line key="bl-h" x1={left - tick} y1={top + side} x2={left + tick} y2={top + side} stroke={PLATE_STROKE} strokeWidth={0.28} />,
    <Line key="bl-v" x1={left} y1={top + side - tick} x2={left} y2={top + side + tick} stroke={PLATE_STROKE} strokeWidth={0.28} />,
    // Bottom-right
    <Line key="br-h" x1={left + side - tick} y1={top + side} x2={left + side + tick} y2={top + side} stroke={PLATE_STROKE} strokeWidth={0.28} />,
    <Line key="br-v" x1={left + side} y1={top + side - tick} x2={left + side} y2={top + side + tick} stroke={PLATE_STROKE} strokeWidth={0.28} />,
  ];

  const numbersStyle = useAnimatedStyle(() => {
    // Secondary numbers soften and dissolve first in the withdrawal
    const nFadeEnd = fadeStart + (fadeEnd - fadeStart) * 0.45;
    const opacity = interpolate(progress.value, [fadeStart, nFadeEnd], [1, 0], 'clamp');
    return { opacity };
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Dark technical plate fill */}
        <Rect x={left} y={top} width={side} height={side} stroke={PLATE_STROKE} strokeWidth={0.32} fill="#0E151C" fillOpacity={0.88} />
        {rules}
        {corners}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, numbersStyle]} pointerEvents="none">
        {formation.gridCells.map((cell) => (
          <Text key={cell.value} style={[styles.cellNumber, styles.cellNumberRest, numeralBox(cell, pitch, unit)]}>
            {cell.value}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

/** A cell's number lighting when a letter lands on it: this letter became this number. */
const CellHighlight = memo(function CellHighlight({
  value,
  box,
  landing,
  fadeStart,
  fadeEnd,
  progress,
  accent,
}: {
  value: number;
  box: ReturnType<typeof numeralBox>;
  landing: number;
  fadeStart: number;
  fadeEnd: number;
  progress: SharedValue<number>;
  accent: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.value, [landing - 0.012, landing], [0, 1], 'clamp') *
      interpolate(progress.value, [fadeStart, fadeStart + (fadeEnd - fadeStart) * 0.5], [1, 0], 'clamp'),
  }));
  return (
    <Animated.Text style={[styles.cellNumber, box, { color: accent }, style]}>
      {value}
    </Animated.Text>
  );
});

/**
 * One point of the structure. It appears when its letter lands on its cell, answers when the
 * line reaches it, and withdraws with the rest of the construction once the mark is whole.
 */
const VertexPoint = memo(function VertexPoint({
  x,
  y,
  letter,
  stack,
  landing,
  arrival,
  fadeStart,
  fadeEnd,
  progress,
  accent,
}: {
  x: number;
  y: number;
  letter: string | null;
  /** How many earlier letters already landed on this cell, so labels do not sit on each other. */
  stack: number;
  landing: number;
  arrival: number;
  fadeStart: number;
  fadeEnd: number;
  progress: SharedValue<number>;
  accent: string;
}) {
  const style = useAnimatedStyle(() => {
    const appear = interpolate(progress.value, [landing - 0.01, landing + 0.012], [0, 1], 'clamp');
    const leave = interpolate(progress.value, [fadeStart + (fadeEnd - fadeStart) * 0.35, fadeEnd], [1, 0], 'clamp');
    return { opacity: appear * leave, transform: [{ scale: 0.4 + appear * 0.6 }] };
  });
  // The destination point responds as the line arrives; only the point, never its label.
  const dotStyle = useAnimatedStyle(() => {
    const answer = interpolate(progress.value, [arrival - 0.006, arrival + 0.008, arrival + 0.03], [0, 1, 0], 'clamp');
    return { transform: [{ scale: 1 + answer * 0.7 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.pointWrap, { left: x - POINT / 2, top: y - POINT / 2 }, style]}>
      <Animated.View style={[styles.point, { backgroundColor: accent }, dotStyle]} />
      {letter ? (
        <Animated.Text style={[styles.pointLabel, { color: accent, left: POINT + 2 + stack * 9 }]}>{letter}</Animated.Text>
      ) : null}
    </Animated.View>
  );
});

/**
 * Formation, drawn from the real computation: the square the intention's category selects,
 * each distilled letter carried onto the cell its number names, and the one line that joins
 * them in order — drawn segment by segment, pausing at each point. Every point here is a vertex
 * of the saved structure and the line is the saved path itself.
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
  const stacks = useMemo(() => {
    const seen = new Map<number, number>();
    return formation.vertices.map((vertex) => {
      const count = seen.get(vertex.value) ?? 0;
      seen.set(vertex.value, count + 1);
      return count;
    });
  }, [formation]);
  const geometry = useMemo(() => kameaGeometry(formation), [formation]);
  const unit = size / 100;
  const fadeStart = timeline.settleStart;
  const fadeEnd = timeline.settleStart + (1 - timeline.settleStart) * 0.6;

  // One highlight per cell that receives a letter, lit by the first letter to land there.
  const lit = useMemo(() => {
    const first = new Map<number, number>();
    formation.vertices.forEach((vertex, index) => {
      if (!first.has(vertex.value)) first.set(vertex.value, index);
    });
    return [...first.entries()].map(([value, index]) => ({ value, landing: timeline.landings[index] ?? 0, cell: formation.vertices[index].cell }));
  }, [formation, timeline.landings]);

  const clockIn = timeline.clockIn;
  const clockOut = timeline.clockOut;
  const trace = useDerivedValue(() => constructionFraction(progress.value, clockIn, clockOut));

  // The pen: where the line is being drawn right now, along the real path.
  const along = useMemo(() => vertexArrivalFractions(formation.vertices), [formation]);
  const px = useMemo(() => formation.vertices.map((vertex) => vertex.x * unit), [formation, unit]);
  const py = useMemo(() => formation.vertices.map((vertex) => vertex.y * unit), [formation, unit]);
  const penStyle = useAnimatedStyle(() => {
    const drawn = trace.value;
    let x = px[0] ?? 0;
    let y = py[0] ?? 0;
    for (let i = 1; i < along.length; i += 1) {
      if (drawn <= along[i]) {
        const span = along[i] - along[i - 1];
        const t = span <= 0 ? 1 : (drawn - along[i - 1]) / span;
        x = px[i - 1] + (px[i] - px[i - 1]) * t;
        y = py[i - 1] + (py[i] - py[i - 1]) * t;
        break;
      }
      x = px[i];
      y = py[i];
    }
    const visible =
      interpolate(progress.value, [timeline.constructStart, timeline.constructStart + 0.01], [0, 1], 'clamp') *
      interpolate(progress.value, [timeline.constructEnd, timeline.constructEnd + 0.02], [1, 0], 'clamp');
    return { opacity: visible, transform: [{ translateX: x - PEN / 2 }, { translateY: y - PEN / 2 }] };
  });

  const gridStyle = useAnimatedStyle(() => {
    const arrive = interpolate(progress.value, [0, timeline.gridEnd * 0.9], [0, 1], 'clamp');
    const recede = interpolate(progress.value, [fadeStart, fadeEnd], [1, 0], 'clamp');
    return { opacity: arrive * recede, transform: [{ scale: 0.96 + arrive * 0.04 + (1 - recede) * 0.03 }] };
  });

  const stagedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [timeline.constructStart, timeline.constructEnd], [0, 1], 'clamp'),
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { width: size, height: size }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, gridStyle]} renderToHardwareTextureAndroid>
        <KameaSquare formation={formation} size={size} fadeStart={fadeStart} fadeEnd={fadeEnd} progress={progress} />
      </Animated.View>
      {lit.map((entry) => (
        <CellHighlight
          key={entry.value}
          value={entry.value}
          box={numeralBox(entry.cell, geometry.pitch, unit)}
          landing={entry.landing}
          fadeStart={fadeStart}
          fadeEnd={fadeEnd}
          progress={progress}
          accent={accent}
        />
      ))}
      {/* The authoritative line drawn in clean off-white / silver ink on the dark drafting plate.
          Colour arrives once the mark is whole. Reduced motion stages it in by opacity instead of tracing. */}
      <Animated.View style={[StyleSheet.absoluteFill, reduceMotion ? stagedStyle : null]}>
        <AnchorMark svg={svg} size={size} strokeColor="#F4F6FA" drawProgress={reduceMotion ? undefined : trace} />
      </Animated.View>
      {formation.vertices.map((vertex, index) => (
        <VertexPoint
          key={index}
          x={vertex.x * unit}
          y={vertex.y * unit}
          letter={vertex.letter}
          stack={stacks[index]}
          landing={timeline.landings[index] ?? 0}
          arrival={reduceMotion ? 2 : timeline.vertexArrivals[index] ?? 2}
          fadeStart={fadeStart}
          fadeEnd={fadeEnd}
          progress={progress}
          accent={accent}
        />
      ))}
      {reduceMotion ? null : <Animated.View style={[styles.pen, penStyle]} />}
    </View>
  );
});

/**
 * The letters themselves, carried from the distilled row to the cells their numbers name.
 * Drawn above the stage (not inside the mark) because the journey starts outside it. Each
 * letter shows the number it becomes as it travels, and hands over to its point on landing.
 */
export const MappingTokens = memo(function MappingTokens({
  letters,
  numbers,
  origins,
  targets,
  departures,
  landings,
  progress,
  accent,
  fontSize,
}: {
  letters: string[];
  numbers: number[];
  /** Where each letter sits in the lifted row (stage coordinates), or null if unknown. */
  origins: Array<StagePoint | null>;
  /** Where its point lands (stage coordinates). */
  targets: StagePoint[];
  departures: number[];
  landings: number[];
  progress: SharedValue<number>;
  accent: string;
  fontSize: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {letters.map((letter, index) =>
        targets[index] ? (
          <MappingToken
            key={`${letter}-${index}`}
            letter={letter}
            number={numbers[index]}
            origin={origins[index] ?? targets[index]}
            target={targets[index]}
            departure={departures[index] ?? 0}
            landing={landings[index] ?? 0}
            progress={progress}
            accent={accent}
            fontSize={fontSize}
          />
        ) : null,
      )}
    </View>
  );
});

const TOKEN = 44;

const MappingToken = memo(function MappingToken({
  letter,
  number,
  origin,
  target,
  departure,
  landing,
  progress,
  accent,
  fontSize,
}: {
  letter: string;
  number: number;
  origin: StagePoint;
  target: StagePoint;
  departure: number;
  landing: number;
  progress: SharedValue<number>;
  accent: string;
  fontSize: number;
}) {
  const style = useAnimatedStyle(() => {
    const raw = interpolate(progress.value, [departure, landing], [0, 1], 'clamp');
    // Leaves gently, lands softly: an ease-in-out without overshoot.
    const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    const visible =
      interpolate(progress.value, [departure, departure + 0.008], [0, 1], 'clamp') *
      interpolate(progress.value, [landing - 0.01, landing + 0.004], [1, 0], 'clamp');
    const x = origin.x + (target.x - origin.x) * t;
    const y = origin.y + (target.y - origin.y) * t;
    return { opacity: visible, transform: [{ translateX: x - TOKEN / 2 }, { translateY: y - TOKEN / 2 }, { scale: 1 - t * 0.45 }] };
  });
  const numberStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [departure + (landing - departure) * 0.15, departure + (landing - departure) * 0.45], [0, 1], 'clamp'),
  }));
  return (
    <Animated.View style={[styles.token, style]}>
      <Animated.Text style={[styles.tokenLetter, { color: '#F4F6FA', fontSize, lineHeight: fontSize * 1.1 }]}>{letter}</Animated.Text>
      <Animated.Text style={[styles.tokenNumber, { color: accent }, numberStyle]}>{number}</Animated.Text>
    </Animated.View>
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
  cellNumber: { position: 'absolute', fontFamily: typography.bodyBold, includeFontPadding: false },
  cellNumberRest: { color: 'rgba(244, 246, 250, 0.38)' },
  pen: { position: 'absolute', left: 0, top: 0, width: PEN, height: PEN, borderRadius: PEN / 2, backgroundColor: '#F4F6FA' },
  token: { position: 'absolute', left: 0, top: 0, width: TOKEN, height: TOKEN, alignItems: 'center', justifyContent: 'center' },
  tokenLetter: { fontFamily: typography.displayBold },
  tokenNumber: { position: 'absolute', right: 0, top: 2, fontFamily: typography.bodyBold, fontSize: 11, lineHeight: 13 },
});
