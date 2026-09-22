import React, { memo, useMemo, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { SigilSvg } from '@/components/common/SigilSvg';
import type { AnchorExpression } from '@/constants/v2/creation';
import { getCategoryColor } from '@/theme/v2';
import { parseAnchorStructure, type AnchorStroke, type AnchorStructure } from './anchorStructure';
import { FOIL_STOPS, expressionSpec, resolvePaint, specUsesFoil, type ExpressionSpec } from './anchorExpressions';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Thinnest the primary stroke may render, in device pixels, however small the mark is drawn. */
const MIN_MARK_PX = 1.35;

let gradientSerial = 0;

export type AnchorMarkProps = {
  /** The stored structure SVG. It is rendered, never modified. */
  svg: string;
  category?: string | null;
  expression?: AnchorExpression;
  /** Rendered square size in dp. */
  size: number;
  /** Replaces the category colour for `category` paints (formation draws in ink first). */
  strokeColor?: string;
  /**
   * 0 → 1 traces the strokes in drawing order (perimeter first, then the mark). Driven on the
   * UI thread; omit it for a static mark.
   */
  drawProgress?: SharedValue<number>;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

type TraceWindow = { start: number; end: number; length: number };

/** Each stroke's share of the trace, proportional to its length. */
function traceWindows(strokes: AnchorStroke[]): TraceWindow[] {
  const total = strokes.reduce((sum, stroke) => sum + stroke.length, 0) || 1;
  let cursor = 0;
  return strokes.map((stroke) => {
    const start = cursor / total;
    cursor += stroke.length;
    return { start, end: cursor / total, length: Math.max(stroke.length, 0.001) };
  });
}

function TracedPath({ progress, window, ...pathProps }: React.ComponentProps<typeof Path> & { progress: SharedValue<number>; window: TraceWindow }) {
  const { start, end, length } = window;
  const animatedProps = useAnimatedProps(() => {
    const span = end - start || 1;
    const local = Math.min(1, Math.max(0, (progress.value - start) / span));
    return { strokeDashoffset: length * (1 - local) };
  });
  return <AnimatedPath {...pathProps} strokeDasharray={[length, length]} animatedProps={animatedProps} />;
}

/** Segment extensions for the architectural treatment: guides through each corner, never the mark. */
function constructionData(structure: AnchorStructure, extend: number): string {
  const segments: string[] = [];
  for (const stroke of structure.strokes) {
    if (stroke.role !== 'mark' || !stroke.vertices) continue;
    for (let i = 0; i < stroke.vertices.length - 1; i += 1) {
      const a = stroke.vertices[i];
      const b = stroke.vertices[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 0.5) continue;
      const ux = (b.x - a.x) / length;
      const uy = (b.y - a.y) / length;
      segments.push(
        `M ${(a.x - ux * extend).toFixed(2)} ${(a.y - uy * extend).toFixed(2)} L ${(b.x + ux * extend).toFixed(2)} ${(b.y + uy * extend).toFixed(2)}`,
      );
    }
  }
  return segments.join(' ');
}

function MarkLayers({
  structure,
  spec,
  color,
  foilRef,
  boost,
  drawProgress,
}: {
  structure: AnchorStructure;
  spec: ExpressionSpec;
  color: string;
  foilRef: string;
  boost: number;
  drawProgress?: SharedValue<number>;
}) {
  const windows = useMemo(() => traceWindows(structure.strokes), [structure]);
  const construction = useMemo(
    () => (spec.construction ? constructionData(structure, spec.construction.extend) : ''),
    [spec.construction, structure],
  );
  const markVertices = useMemo(
    () => structure.strokes.flatMap((stroke) => (stroke.role === 'mark' && stroke.vertices ? stroke.vertices : [])),
    [structure],
  );

  return (
    <>
      {construction && spec.construction ? (
        <Path
          d={construction}
          stroke={resolvePaint(spec.construction.paint, color, foilRef)}
          strokeWidth={structure.markWidth * spec.construction.widthScale * boost}
          strokeOpacity={spec.construction.opacity}
          strokeLinecap="butt"
          fill="none"
        />
      ) : null}
      {spec.layers.map((layer, layerIndex) => (
        <G key={layerIndex} transform={layer.dx || layer.dy ? `translate(${(layer.dx ?? 0) * boost} ${(layer.dy ?? 0) * boost})` : undefined}>
          {structure.strokes.map((stroke, strokeIndex) => {
            const common = {
              d: stroke.d,
              stroke: resolvePaint(layer.paint, color, foilRef),
              strokeWidth: stroke.strokeWidth * layer.widthScale * boost,
              strokeOpacity: layer.opacity * stroke.opacity,
              strokeLinecap: layer.linecap ?? 'round',
              strokeLinejoin: layer.linejoin ?? 'round',
              fill: 'none',
            } as const;
            return drawProgress ? (
              <TracedPath key={strokeIndex} {...common} progress={drawProgress} window={windows[strokeIndex]} />
            ) : (
              <Path key={strokeIndex} {...common} />
            );
          })}
        </G>
      ))}
      {spec.vertices && !drawProgress
        ? markVertices.map((vertex, index) => {
            const paint = resolvePaint(spec.vertices!.paint, color, foilRef);
            const r = structure.markWidth * spec.vertices!.radiusScale * boost;
            return spec.vertices!.hollow ? (
              <Circle key={index} cx={vertex.x} cy={vertex.y} r={r} stroke={paint} strokeWidth={structure.markWidth * 0.2 * boost} strokeOpacity={spec.vertices!.opacity} fill="none" />
            ) : (
              <Circle key={index} cx={vertex.x} cy={vertex.y} r={r} fill={paint} fillOpacity={spec.vertices!.opacity} />
            );
          })
        : null}
    </>
  );
}

/**
 * The one Anchor renderer: a stored structure drawn through an expression.
 *
 * Every surface that shows an Anchor's own mark — creation, Home, Anchor Details, Practice,
 * the library, sharing — should render it through here (via `CircularAnchorRenderer` where a
 * disc is wanted), so the same structure + expression looks the same everywhere. If the SVG is
 * not one this renderer understands it is drawn exactly as stored instead.
 */
export const AnchorMark = memo(function AnchorMark({
  svg,
  category,
  expression = 'original',
  size,
  strokeColor,
  drawProgress,
  accessibilityLabel,
  testID,
  style,
}: AnchorMarkProps) {
  const structure = parseAnchorStructure(svg);
  const spec = expressionSpec(expression);
  const color = strokeColor ?? getCategoryColor(category);
  const gradientId = useRef(`anchor-foil-${(gradientSerial += 1)}`).current;
  const a11y = {
    accessible: Boolean(accessibilityLabel),
    accessibilityRole: accessibilityLabel ? ('image' as const) : undefined,
    accessibilityLabel,
  };

  if (!structure) {
    return (
      <View testID={testID} style={[{ width: size, height: size }, style]} {...a11y}>
        <SigilSvg xml={svg} width={size} height={size} color={color} />
      </View>
    );
  }

  const unitsToPx = size / structure.box.width;
  // A thumbnail keeps the mark legible by thickening every layer together, so the treatment
  // keeps its proportions instead of the primary line vanishing.
  const boost = Math.min(3, Math.max(1, MIN_MARK_PX / (structure.markWidth * unitsToPx)));
  const { minX, minY, width, height } = structure.box;

  return (
    <View testID={testID} style={[{ width: size, height: size }, style]} {...a11y}>
      <Svg width={size} height={size} viewBox={structure.viewBox}>
        {specUsesFoil(spec) ? (
          <Defs>
            <LinearGradient id={gradientId} x1={minX} y1={minY} x2={minX + width} y2={minY + height} gradientUnits="userSpaceOnUse">
              {FOIL_STOPS.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
        ) : null}
        <MarkLayers
          structure={structure}
          spec={spec}
          color={color}
          foilRef={`url(#${gradientId})`}
          boost={boost}
          drawProgress={drawProgress}
        />
      </Svg>
    </View>
  );
});
