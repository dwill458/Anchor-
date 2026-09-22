import React, { useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { Check, Map } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import type {
  ChartRouteTemplate,
  V2WaypointPresentation,
} from '@/adapters/v2/chart';
import { radii, typography } from '@/theme/v2';

export interface V2ChartRouteMapProps {
  waypoints: V2WaypointPresentation[];
  currentWaypointIndex: number;
  template?: ChartRouteTemplate;
  activeAnchorSvg?: string | null;
  activeAnchorCategory?: string | null;
  onWaypointPress: (waypointId: string) => void;
  onAnchorPress?: () => void;
  onAllWaypointsPress?: () => void;
  testID?: string;
}

const landscapeImage = require('../../../../assets/chart/landscape.jpg');

const TEMPLATES: Record<ChartRouteTemplate, [number, number][]> = {
  'gentle-s': [
    [0.14, 0.87],
    [0.24, 0.70],
    [0.39, 0.56],
    [0.62, 0.49],
    [0.63, 0.29],
    [0.82, 0.10],
  ],
  'wide-zigzag': [
    [0.14, 0.87],
    [0.43, 0.72],
    [0.23, 0.57],
    [0.62, 0.42],
    [0.42, 0.27],
    [0.82, 0.10],
  ],
  'rising-arc': [
    [0.14, 0.87],
    [0.23, 0.70],
    [0.35, 0.53],
    [0.47, 0.38],
    [0.62, 0.23],
    [0.82, 0.10],
  ],
  'double-bend': [
    [0.14, 0.87],
    [0.30, 0.73],
    [0.20, 0.57],
    [0.60, 0.44],
    [0.48, 0.26],
    [0.82, 0.10],
  ],
};

interface Point {
  x: number;
  y: number;
}

function calculateGeometry(
  total: number,
  template: ChartRouteTemplate = 'gentle-s',
  labelLengths: number[] = [],
  containerWidth = 430,
) {
  const anchors = TEMPLATES[template] || TEMPLATES['gentle-s'];
  const longest = Math.max(0, ...labelLengths);
  const baseHeight = Math.max(
    406,
    total > 8 ? total * 89 : total > 5 ? 406 + (total - 5) * 57 : 406,
  );
  const height = baseHeight + (longest > 30 ? total * Math.ceil(longest / 14) * 15 : 0);

  const points: Point[] = Array.from({ length: total + 1 }, (_, i) => {
    const t = (i / total) * 5;
    const k = Math.min(4, Math.floor(t));
    const f = t - k;
    return {
      x: containerWidth * (anchors[k][0] + (anchors[k + 1][0] - anchors[k][0]) * f),
      y: height * (anchors[k][1] + (anchors[k + 1][1] - anchors[k][1]) * f),
    };
  });

  return { points, height };
}

function cubicBezier(
  a: Point,
  b: Point,
  i: number,
  n: number,
  template: ChartRouteTemplate,
): [Point, Point, Point, Point] {
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
  const steps = 45;

  for (let j = 0; j <= steps; j++) {
    const t = j / steps;
    const p = sampleCurve(c, t);
    const a = sampleCurve(c, Math.max(0, t - 0.003));
    const b = sampleCurve(c, Math.min(1, t + 0.003));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const w = width * (0.82 + 0.13 * Math.sin(j * 0.25 + seed) + 0.08 * Math.sin(j * 2.6 + seed));

    left.push(
      `${(p.x - (dy / len) * (w / 2)).toFixed(1)},${(p.y + (dx / len) * (w / 2)).toFixed(1)}`,
    );
    right.unshift(
      `${(p.x + (dy / len) * (w / 2)).toFixed(1)},${(p.y - (dx / len) * (w / 2)).toFixed(1)}`,
    );
  }
  return 'M' + left.join(' L') + ' L' + right.join(' L') + 'Z';
}

function generateBrushHair(c: [Point, Point, Point, Point], k: number): string {
  let d = '';
  const steps = 24;
  for (let j = 0; j <= steps; j++) {
    const t = j / steps;
    const p = sampleCurve(c, t);
    const x = p.x + Math.sin(t * 15 + k) * 0.55 + k * 0.85 - 3.5;
    const y = p.y + Math.cos(t * 17 + k) * 0.7;
    d += (j === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

function StarSvg({ done = false }: { done?: boolean }) {
  return (
    <Svg width={68} height={68} viewBox="0 0 90 90">
      <G stroke="#ffb046" strokeWidth={3.6} strokeLinecap="round">
        <Path d="m46 4 1 10m23-1-6 9m18 10-10 4m7 22-9-4M21 15l6 8M9 35l11 2M12 57l11-5m5 20 5-7" />
      </G>
      <Path
        d="m47 22 7 18 19 2-15 13 3 19-16-10-16 9 4-19-14-13 20-2Z"
        fill="#F28A2E"
        stroke="#ffb046"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="m47 25 1 24 21-6-16 12 6 15-15-10-12 9 6-18-14-8 19 2Z"
        fill="#ffb044"
        opacity={0.5}
      />
      {done && (
        <Path
          d="m34 49 8 8 15-18"
          fill="none"
          stroke="white"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

export function V2ChartRouteMap({
  waypoints,
  currentWaypointIndex,
  template = 'gentle-s',
  activeAnchorSvg,
  activeAnchorCategory,
  onWaypointPress,
  onAnchorPress,
  onAllWaypointsPress,
  testID = 'v2-chart-route-map',
}: V2ChartRouteMapProps) {
  const [containerWidth, setContainerWidth] = useState(430);
  const total = waypoints.length;

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 2) {
      setContainerWidth(width);
    }
  };

  const labelLengths = useMemo(() => waypoints.map((w) => w.value.length), [waypoints]);
  const { points, height } = useMemo(
    () => calculateGeometry(total, template, labelLengths, containerWidth),
    [total, template, labelLengths, containerWidth],
  );

  // Compute label positions with collision avoidance matching HTML reference
  const labels = useMemo(() => {
    const raw = waypoints.map((w, i) => {
      const p = points[i + 1] ?? { x: 0, y: 0 };
      const isLast = i === total - 1;
      const isCurrent = i === currentWaypointIndex;
      const labelWidth = isLast ? 115 : isCurrent ? 140 : 120;
      const x = isLast
        ? Math.min(containerWidth - labelWidth - 8, Math.max(12, p.x - 45))
        : Math.min(containerWidth - labelWidth - 10, Math.max(12, p.x + (isCurrent ? 14 : 22)));
      const y = isLast ? p.y + 28 : p.y + (isCurrent ? -26 : w.reached ? -8 : 6);
      const labelHeight = Math.max(2, Math.ceil(w.value.length / 14)) * 15 + (isLast ? 16 : isCurrent ? 25 : 0);

      return { x, y, width: labelWidth, height: labelHeight };
    });

    for (let i = raw.length - 2; i >= 0; i--) {
      const a = raw[i];
      for (let j = i + 1; j < raw.length; j++) {
        const b = raw[j];
        if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height + 5) {
          a.y = b.y + b.height + 5;
        }
      }
    }
    return raw;
  }, [waypoints, points, total, currentWaypointIndex, containerWidth]);

  return (
    <View testID={testID} onLayout={handleLayout} style={[styles.container, { height }]}>
      {/* Painterly terrain background */}
      <Image source={landscapeImage} style={styles.landscapeImage as any} resizeMode="stretch" />

      {/* SVG illustrated route strokes */}
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${containerWidth} ${height}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient
            id="paint"
            x1="60"
            y1={height * 0.9}
            x2="255"
            y2={height * 0.43}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#7C5CFA" />
            <Stop offset="0.24" stopColor="#3564ed" />
            <Stop offset="0.48" stopColor="#39bff0" />
            <Stop offset="0.67" stopColor="#2fcbb7" />
            <Stop offset="0.85" stopColor="#3685ed" />
            <Stop offset="1" stopColor="#3157D8" />
          </LinearGradient>

          <LinearGradient id="ahead" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#9ddce9" />
            <Stop offset="0.5" stopColor="#d0cddd" />
            <Stop offset="1" stopColor="#fbcf84" />
          </LinearGradient>

          <LinearGradient id="sunpath" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#fbd581" />
            <Stop offset="1" stopColor="#F28A2E" />
          </LinearGradient>
        </Defs>

        {/* Painted Route Segments with bristled hairs */}
        {waypoints.map((_, i) => {
          if (!points[i] || !points[i + 1]) return null;
          const c = cubicBezier(points[i], points[i + 1], i, total, template);
          const painted = currentWaypointIndex < 0 || i <= currentWaypointIndex;
          const isLast = i === total - 1;
          const strokeFill = isLast ? 'url(#sunpath)' : painted ? 'url(#paint)' : 'url(#ahead)';
          const strokeWidth = painted ? 20 : isLast ? 5 : i === currentWaypointIndex + 1 ? 8 : 4;
          const brushPath = generateBrushPath(c, strokeWidth, i);

          return (
            <G key={`segment-${i}`}>
              <Path d={brushPath} fill={strokeFill} opacity={painted ? 0.95 : 0.7} />
              {/* Bristled brush hair textures */}
              {Array.from({ length: painted ? 6 : 2 }, (__, k) => (
                <Path
                  key={`hair-${k}`}
                  d={generateBrushHair(c, k)}
                  stroke={painted ? (k % 2 ? '#b3f1f1' : '#f4f1e9') : '#f4f1e9'}
                  strokeWidth={k % 3 === 0 ? 0.8 : 0.35}
                  opacity={painted ? 0.4 : 0.65}
                  fill="none"
                  strokeDasharray={`${4 + k * 2},${8 + k * 3}`}
                />
              ))}
              {!painted && !isLast && (
                <Path
                  d={generateBrushHair(c, 3)}
                  fill="none"
                  stroke="#b9b9c6"
                  strokeWidth={1.8}
                  strokeDasharray="5,8"
                  opacity={0.55}
                />
              )}
            </G>
          );
        })}
      </Svg>

      {/* START: Active Anchor starting node */}
      <Pressable
        testID="chart-start-node"
        onPress={onAnchorPress}
        accessibilityRole="button"
        accessibilityLabel="Start: open your Anchor"
        style={[
          styles.startNode,
          {
            left: points[0]?.x ?? 28,
            top: points[0]?.y ?? height - 60,
          },
        ]}
      >
        <View style={styles.anchorBadge}>
          {activeAnchorSvg ? (
            <CircularAnchorRenderer
              svg={activeAnchorSvg}
              category={activeAnchorCategory}
              size="micro"
              accessibilityLabel="Start: your Anchor"
            />
          ) : (
            <View style={styles.fallbackStartCircle} />
          )}
        </View>
        <View style={styles.startCaptionPill}>
          <Text style={styles.startCaptionText}>START</Text>
        </View>
      </Pressable>

      {/* Waypoint Nodes & Labels */}
      {waypoints.map((wp, i) => {
        const pt = points[i + 1] ?? { x: 0, y: 0 };
        const isLast = i === total - 1;
        const isCurrent = i === currentWaypointIndex;
        const label = labels[i] ?? { x: pt.x + 20, y: pt.y - 10, width: 120 };

        return (
          <React.Fragment key={wp.id}>
            {/* Interactive Waypoint Node */}
            <Pressable
              testID={`waypoint-node-${wp.id}`}
              onPress={() => onWaypointPress(wp.id)}
              accessibilityRole="button"
              accessibilityLabel={`${wp.value}. ${isLast && !wp.reached ? 'Destination' : wp.state}. Open waypoint details`}
              accessibilityState={{ selected: isCurrent }}
              style={[
                styles.nodeTouchTarget,
                isLast && styles.nodeDestinationTarget,
                {
                  left: pt.x - (isLast ? 34 : 22),
                  top: pt.y - (isLast ? 34 : 22),
                },
              ]}
            >
              {isLast ? (
                <StarSvg done={wp.reached} />
              ) : isCurrent ? (
                <View style={styles.nodeCurrentRing}>
                  <View style={styles.nodeCurrentInner} />
                </View>
              ) : wp.reached ? (
                <View style={styles.nodeCompleted}>
                  <Check size={14} color="#b8fff0" strokeWidth={3.2} />
                </View>
              ) : (
                <View style={styles.nodeUpcoming} />
              )}
            </Pressable>

            {/* Waypoint Label */}
            <Pressable
              onPress={() => onWaypointPress(wp.id)}
              accessibilityRole="button"
              accessibilityLabel={`View ${wp.value}`}
              style={[
                styles.labelBox,
                isCurrent && !isLast && styles.currentLabelBox,
                isLast && styles.destinationLabelBox,
                {
                  left: label.x,
                  top: label.y,
                  width: label.width,
                },
              ]}
            >
              {isCurrent && !isLast ? (
                <>
                  <Text numberOfLines={2} style={styles.currentLabelText}>
                    {wp.value}
                  </Text>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>CURRENT</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text
                    numberOfLines={2}
                    style={[styles.labelText, isLast && styles.destinationLabelText]}
                  >
                    {wp.value}
                  </Text>
                  {isLast && (
                    <Text style={styles.destinationEyebrow}>
                      {wp.reached
                        ? 'DESTINATION REACHED'
                        : isCurrent
                          ? 'CURRENT · DESTINATION'
                          : 'DESTINATION'}
                    </Text>
                  )}
                </>
              )}
            </Pressable>
          </React.Fragment>
        );
      })}

      {/* Floating "View all waypoints" affordance at bottom-right */}
      {onAllWaypointsPress && (
        <Pressable
          testID="view-all-waypoints-button"
          onPress={onAllWaypointsPress}
          accessibilityRole="button"
          accessibilityLabel="View all waypoints"
          style={styles.allWaypointsButton}
        >
          <Map size={16} color="#142238" strokeWidth={1.8} />
          <Text style={styles.allWaypointsText}>View all waypoints</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#F4F1E9', // Cream paper
    overflow: 'hidden',
  },
  landscapeImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.88,
  },
  startNode: {
    position: 'absolute',
    transform: [{ translateX: -28 }, { translateY: -28 }],
    alignItems: 'center',
    zIndex: 4,
  },
  anchorBadge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: '#FFFCF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFDF7',
    elevation: 3,
    shadowColor: '#C9B6F2',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fallbackStartCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3157D8',
  },
  startCaptionPill: {
    backgroundColor: '#FFFDF5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  startCaptionText: {
    ...typography.caption,
    fontSize: 8,
    fontWeight: '800',
    color: '#142238',
    letterSpacing: 1.2,
  },
  nodeTouchTarget: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  nodeDestinationTarget: {
    width: 68,
    height: 68,
  },
  nodeCompleted: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#237B88', // Teal finished
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#7C5CFA',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    transform: [{ rotate: '-4deg' }],
  },
  nodeCurrentRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#3157D8',
    backgroundColor: '#FBF9F4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#3157D8',
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  nodeCurrentInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#3157D8',
  },
  nodeUpcoming: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.2,
    borderColor: '#2C4058',
    backgroundColor: '#FBF9F4',
    elevation: 1,
    shadowColor: '#23364E',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  labelBox: {
    position: 'absolute',
    paddingHorizontal: 4,
    paddingVertical: 2,
    zIndex: 6,
  },
  currentLabelBox: {
    backgroundColor: '#EAE8FBDD',
    borderWidth: 1,
    borderColor: '#E1DDF4',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#505988',
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  destinationLabelBox: {
    alignItems: 'center',
  },
  labelText: {
    fontSize: 12,
    lineHeight: 14,
    color: '#142238',
    fontWeight: '600',
  },
  currentLabelText: {
    fontSize: 12.5,
    lineHeight: 15,
    color: '#142238',
    fontWeight: '700',
  },
  destinationLabelText: {
    fontSize: 12.5,
    textAlign: 'center',
    fontWeight: '700',
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#3157D8',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 7.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  destinationEyebrow: {
    ...typography.caption,
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#F28A2E',
    marginTop: 3,
  },
  allWaypointsButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 8,
    backgroundColor: '#FFFDF7F2',
    borderRadius: radii.round,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#EAE6DF',
    elevation: 3,
    shadowColor: '#343748',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 7,
  },
  allWaypointsText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#142238',
  },
});
