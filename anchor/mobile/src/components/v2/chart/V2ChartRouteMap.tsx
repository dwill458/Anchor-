import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Path,
  Circle,
  G,
} from 'react-native-svg';
import { Check } from 'lucide-react-native';
import type {
  ChartRouteTemplate,
  V2WaypointPresentation,
} from '@/adapters/v2/chart';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface V2ChartRouteMapProps {
  waypoints: V2WaypointPresentation[];
  currentWaypointIndex: number;
  template?: ChartRouteTemplate;
  onWaypointPress: (waypointId: string) => void;
  onAnchorPress?: () => void;
  testID?: string;
}

const TEMPLATES: Record<ChartRouteTemplate, [number, number][]> = {
  'gentle-s': [[0.14, 0.87], [0.24, 0.70], [0.39, 0.56], [0.62, 0.49], [0.63, 0.29], [0.82, 0.10]],
  'wide-zigzag': [[0.14, 0.87], [0.43, 0.72], [0.23, 0.57], [0.62, 0.42], [0.42, 0.27], [0.82, 0.10]],
  'rising-arc': [[0.14, 0.87], [0.23, 0.70], [0.35, 0.53], [0.47, 0.38], [0.62, 0.23], [0.82, 0.10]],
  'double-bend': [[0.14, 0.87], [0.30, 0.73], [0.20, 0.57], [0.60, 0.44], [0.48, 0.26], [0.82, 0.10]],
};

interface Point {
  x: number;
  y: number;
}

function calculateGeometry(total: number, template: ChartRouteTemplate = 'gentle-s') {
  const anchors = TEMPLATES[template] || TEMPLATES['gentle-s'];
  const height = Math.max(420, total > 5 ? 420 + (total - 5) * 60 : 420);
  const width = 390;

  const points: Point[] = Array.from({ length: total + 1 }, (_, i) => {
    const t = (i / total) * 5;
    const k = Math.min(4, Math.floor(t));
    const f = t - k;
    return {
      x: width * (anchors[k][0] + (anchors[k + 1][0] - anchors[k][0]) * f),
      y: height * (anchors[k][1] + (anchors[k + 1][1] - anchors[k][1]) * f),
    };
  });

  return { points, height, width };
}

function cubicBezier(a: Point, b: Point, i: number, n: number, template: ChartRouteTemplate): [Point, Point, Point, Point] {
  const dy = b.y - a.y;
  const bend =
    template === 'gentle-s' && n === 5
      ? [97, -28, 18, -117, 50][i] ?? 40
      : [48, -43, 40, -38, 30][i % 5];
  return [
    a,
    { x: a.x + bend, y: a.y + dy * 0.27 },
    { x: b.x + bend * 0.5, y: b.y - dy * 0.4 },
    b,
  ];
}

function sampleCurve(c: [Point, Point, Point, Point], t: number): Point {
  const s = 1 - t;
  return {
    x: s * s * s * c[0].x + 3 * s * s * t * c[1].x + 3 * s * t * t * c[2].x + t * t * t * c[3].x,
    y: s * s * s * c[0].y + 3 * s * s * t * c[1].y + 3 * s * t * t * c[2].y + t * t * t * c[3].y,
  };
}

function generateBrushPath(c: [Point, Point, Point, Point], width: number, seed = 0): string {
  const left: string[] = [];
  const right: string[] = [];
  const steps = 40;

  for (let j = 0; j <= steps; j++) {
    const t = j / steps;
    const p = sampleCurve(c, t);
    const a = sampleCurve(c, Math.max(0, t - 0.005));
    const b = sampleCurve(c, Math.min(1, t + 0.005));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const w = width * (0.85 + 0.12 * Math.sin(j * 0.3 + seed));

    left.push(`${(p.x - (dy / len) * (w / 2)).toFixed(1)},${(p.y + (dx / len) * (w / 2)).toFixed(1)}`);
    right.unshift(`${(p.x + (dy / len) * (w / 2)).toFixed(1)},${(p.y - (dx / len) * (w / 2)).toFixed(1)}`);
  }
  return 'M' + left.join(' L') + ' L' + right.join(' L') + 'Z';
}

function generateBrushHair(c: [Point, Point, Point, Point], k: number): string {
  let d = '';
  const steps = 20;
  for (let j = 0; j <= steps; j++) {
    const t = j / steps;
    const p = sampleCurve(c, t);
    const x = p.x + Math.sin(t * 12 + k) * 0.5 + k * 0.8 - 2.0;
    const y = p.y + Math.cos(t * 14 + k) * 0.6;
    d += (j === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

export function V2ChartRouteMap({
  waypoints,
  currentWaypointIndex,
  template = 'gentle-s',
  onWaypointPress,
  onAnchorPress,
  testID = 'v2-chart-route-map',
}: V2ChartRouteMapProps) {
  const total = waypoints.length;
  const { points, height, width } = calculateGeometry(total, template);

  return (
    <View testID={testID} style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Completed route gradient */}
          <LinearGradient id="completedPaint" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#8EE0CF" />
            <Stop offset="0.28" stopColor="#41C8C6" />
            <Stop offset="0.58" stopColor="#65C7DC" />
            <Stop offset="1" stopColor="#6C90F3" />
          </LinearGradient>

          {/* Upcoming route gradient */}
          <LinearGradient id="upcomingPaint" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#9CB9ED" />
            <Stop offset="0.55" stopColor="#D4D4D0" />
            <Stop offset="1" stopColor="#E7E3D9" />
          </LinearGradient>

          {/* Destination Sunpath */}
          <LinearGradient id="sunpathPaint" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#FBD581" />
            <Stop offset="1" stopColor="#FFA32C" />
          </LinearGradient>

          {/* Current waypoint halo */}
          <RadialGradient id="waypointHalo">
            <Stop offset="0" stopColor="#7890FA" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#CFD7FF" stopOpacity="0.05" />
          </RadialGradient>
        </Defs>

        {/* Painted Route Segments */}
        {waypoints.map((_, i) => {
          const c = cubicBezier(points[i], points[i + 1], i, total, template);
          const isPainted = currentWaypointIndex < 0 || i <= currentWaypointIndex;
          const isLast = i === total - 1;
          const strokeFill = isLast
            ? 'url(#sunpathPaint)'
            : isPainted
              ? 'url(#completedPaint)'
              : 'url(#upcomingPaint)';
          const strokeWidth = isPainted ? 16 : isLast ? 6 : 4;
          const brushPath = generateBrushPath(c, strokeWidth, i);

          return (
            <G key={`segment-${i}`}>
              <Path d={brushPath} fill={strokeFill} opacity={isPainted ? 0.95 : 0.65} />
              {/* Brush hair textures */}
              <Path
                d={generateBrushHair(c, 1)}
                stroke={isPainted ? '#FFFFFF' : '#D8D2C8'}
                strokeWidth={0.8}
                strokeDasharray="6,8"
                opacity={0.5}
                fill="none"
              />
              <Path
                d={generateBrushHair(c, 2)}
                stroke={isPainted ? '#51E1C6' : '#B8BCBA'}
                strokeWidth={0.6}
                strokeDasharray="4,6"
                opacity={0.4}
                fill="none"
              />
            </G>
          );
        })}

        {/* START Node artwork at base */}
        <G transform={`translate(${points[0].x - 16}, ${points[0].y - 16})`}>
          <Circle cx="16" cy="16" r="16" fill={colors.surface} stroke={colors.border.strong} strokeWidth="1.5" />
          <Circle cx="16" cy="16" r="6" fill="#3157D8" />
        </G>

        {/* Waypoint Visual Elements in SVG */}
        {waypoints.map((wp, i) => {
          const pt = points[i + 1];
          const isLast = i === total - 1;
          const isCurrent = i === currentWaypointIndex;

          if (isLast) {
            // Amber destination star & rays
            return (
              <G key={`svg-node-${wp.id}`} transform={`translate(${pt.x}, ${pt.y})`}>
                {/* Outer halo */}
                <Circle cx="0" cy="0" r="22" fill="#FFA32C" opacity="0.2" />
                {/* Ray bursts */}
                <Path
                  d="M0 -18 L0 -24 M13 -13 L17 -17 M18 0 L24 0 M13 13 L17 17 M0 18 L0 24 M-13 13 L-17 17 M-18 0 L-24 0 M-13 -13 L-17 -17"
                  stroke="#FFA32C"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {/* Core diamond / star */}
                <Path
                  d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z"
                  fill="#FFA32C"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </G>
            );
          }

          if (isCurrent) {
            // Cobalt current node with halo and burst rays
            return (
              <G key={`svg-node-${wp.id}`} transform={`translate(${pt.x}, ${pt.y})`}>
                <Circle cx="0" cy="0" r="24" fill="url(#waypointHalo)" />
                <Circle cx="0" cy="0" r="16" fill="#8DA5FC" opacity="0.3" />
                {/* Ray bursts */}
                <Path
                  d="M-4 -16 L-5 -22 M16 -4 L22 -5 M-16 4 L-22 5"
                  stroke="#487BFA"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <Circle cx="0" cy="0" r="13" fill="#3157F5" />
                <Circle cx="0" cy="0" r="8" fill="#3157F5" stroke="#FFFFFF" strokeWidth="2.5" />
              </G>
            );
          }

          if (wp.reached) {
            // Teal reached checkmark node
            return (
              <G key={`svg-node-${wp.id}`} transform={`translate(${pt.x}, ${pt.y})`}>
                <Circle cx="0" cy="0" r="12" fill="#227385" />
              </G>
            );
          }

          // Upcoming node
          return (
            <G key={`svg-node-${wp.id}`} transform={`translate(${pt.x}, ${pt.y})`}>
              <Circle cx="0" cy="0" r="8" fill={colors.surface} stroke="#BCBFBC" strokeWidth="2" />
            </G>
          );
        })}
      </Svg>

      {/* START Label */}
      <Pressable
        onPress={onAnchorPress}
        accessibilityRole="button"
        accessibilityLabel="Start anchor node"
        style={[
          styles.startBadge,
          {
            left: Math.max(8, points[0].x - 28),
            top: points[0].y + 20,
          },
        ]}
      >
        <Text style={styles.startBadgeText}>START</Text>
      </Pressable>

      {/* Interactive Waypoint Nodes & Labels overlaid for touch accuracy */}
      {waypoints.map((wp, i) => {
        const pt = points[i + 1];
        const isLast = i === total - 1;
        const isCurrent = i === currentWaypointIndex;
        const labelX = Math.min(width - 130, Math.max(16, pt.x + (isCurrent ? 24 : 16)));
        const labelY = Math.max(12, pt.y - 14);

        return (
          <React.Fragment key={`touch-${wp.id}`}>
            {/* Tappable node area */}
            <Pressable
              testID={`waypoint-node-${wp.id}`}
              onPress={() => onWaypointPress(wp.id)}
              accessibilityRole="button"
              accessibilityLabel={`${wp.value}. ${wp.state}. Tap to view details`}
              style={[
                styles.nodeTouchArea,
                {
                  left: pt.x - 22,
                  top: pt.y - 22,
                },
              ]}
            >
              {wp.reached && !isLast && (
                <View style={styles.checkIconCenter}>
                  <Check size={14} color="#51E1C6" strokeWidth={3} />
                </View>
              )}
            </Pressable>

            {/* Waypoint Label */}
            <Pressable
              onPress={() => onWaypointPress(wp.id)}
              accessibilityRole="button"
              accessibilityLabel={`View waypoint: ${wp.value}`}
              style={[
                styles.labelContainer,
                isCurrent && styles.currentLabelContainer,
                {
                  left: labelX,
                  top: labelY,
                },
              ]}
            >
              <Text numberOfLines={1} style={[styles.labelText, isCurrent && styles.currentLabelText]}>
                {wp.value}
              </Text>
              {isCurrent && <Text style={styles.currentBadge}>CURRENT</Text>}
              {isLast && (
                <Text style={styles.destinationEyebrow}>
                  {wp.reached ? 'DESTINATION REACHED' : 'DESTINATION'}
                </Text>
              )}
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  startBadge: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  startBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  nodeTouchArea: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    maxWidth: 140,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  currentLabelContainer: {
    borderColor: '#3157F5',
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#3157F5',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  labelText: {
    ...typography.bodySM,
    fontWeight: '600',
    color: colors.text.primary,
  },
  currentLabelText: {
    fontWeight: '700',
    color: '#3157F5',
  },
  currentBadge: {
    ...typography.caption,
    color: '#3157F5',
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  destinationEyebrow: {
    ...typography.caption,
    color: '#FFA32C',
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
