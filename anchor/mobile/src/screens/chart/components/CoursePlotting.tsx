/**
 * CoursePlotting — the plan-generation ceremony.
 *
 * A 1:1 port of the prototype's `Plotting` state. It is a ceremony, not a
 * spinner: the route draws itself in, nodes and stars fade up on a stagger,
 * and a compass turns slowly over the destination node. The prototype's CSS
 * keyframes map to Reanimated as:
 *
 *   `.plot-grid path` fadeIn 1.8s
 *   `.plot-star`      fadeIn 1.4s   staggered 0.60 + i*0.16s
 *   `.plot-seg`       drawSeg 1s    cubic-bezier(.4,0,.2,1), 1.10 + i*0.55s
 *   `.plot-node`      fadeIn 0.7s   staggered 1.20 + i*0.55s
 *   `.plot-compass`   slowSpin 14s  linear infinite
 *
 * Under reduced motion the artwork renders in its final state immediately;
 * the caller's timing is unaffected either way.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { C, F, ls, MOTION } from '../chartTokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Point = { x: number; y: number };

/** Prototype route geometry, on its 330×190 canvas. */
const PTS: Point[] = [
  { x: 30, y: 150 },
  { x: 100, y: 118 },
  { x: 168, y: 132 },
  { x: 236, y: 92 },
  { x: 300, y: 58 },
];

/** First ten prototype star positions, scaled onto the plotting canvas. */
const STARS: [number, number][] = [
  [38, 44],
  [96, 28],
  [148, 66],
  [232, 40],
  [286, 22],
  [318, 70],
  [404, 36],
  [452, 20],
  [530, 44],
  [566, 96],
];

const GRID = [
  'M0 60 C 90 40, 220 90, 330 44',
  'M0 118 C 110 100, 230 150, 330 96',
  'M0 168 C 120 152, 240 186, 330 140',
];

/** Catmull-Rom through `pts`, emitted as cubic bezier segment paths. */
function segments(pts: Point[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || pts[i + 1];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    out.push(`M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`);
  }
  return out;
}

const Seg: React.FC<{ d: string; delay: number; still: boolean }> = ({ d, delay, still }) => {
  const t = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return undefined;
    t.value = withDelay(
      delay,
      withTiming(1, { duration: MOTION.segDraw, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
    );
    return () => cancelAnimation(t);
  }, [delay, still, t]);

  const props = useAnimatedProps(() => ({ strokeDashoffset: 200 * (1 - t.value) }));

  return (
    <AnimatedPath
      animatedProps={props}
      d={d}
      stroke={C.gold}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeDasharray="200"
      fill="none"
      opacity={0.75}
    />
  );
};

const FadeCircle: React.FC<{
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  delay: number;
  duration: number;
  still: boolean;
}> = ({ cx, cy, r, fill, stroke, strokeWidth, delay, duration, still }) => {
  const o = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return undefined;
    o.value = withDelay(delay, withTiming(1, { duration, easing: Easing.ease }));
    return () => cancelAnimation(o);
  }, [delay, duration, o, still]);

  const props = useAnimatedProps(() => ({ opacity: o.value }));

  return (
    <AnimatedCircle
      animatedProps={props}
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
};

export const CoursePlotting: React.FC<{
  /** Echoed back as the ceremony's title, as the prototype does. */
  destination: string;
  /** Shown beneath the artwork. */
  status?: string;
}> = ({ destination, status = 'Reading your Anchors and reflections…' }) => {
  const reduceMotion = useReducedMotion();
  const still = !!reduceMotion;
  const segs = useMemo(() => segments(PTS), []);
  const spin = useSharedValue(0);
  const grid = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return undefined;
    grid.value = withTiming(1, { duration: MOTION.gridFade, easing: Easing.ease });
    spin.value = withRepeat(
      withTiming(1, { duration: MOTION.compassSpin, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(grid);
    };
  }, [grid, spin, still]);

  const gridProps = useAnimatedProps(() => ({ opacity: grid.value }));
  const compassStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root]}
      accessibilityLabel="Plotting your course"
      accessibilityLiveRegion="polite"
    >
      {/* purple wash */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="plotWash">
              <Stop offset="0" stopColor="rgba(62,44,91,0.34)" />
              <Stop offset="0.7" stopColor="rgba(62,44,91,0)" />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="45%" r="55%" fill="url(#plotWash)" />
        </Svg>
      </View>

      <Text style={styles.kicker}>PLOTTING YOUR COURSE</Text>
      <Text style={styles.destination}>{destination}</Text>

      <View style={styles.canvas}>
        <Svg width={330} height={190}>
          {GRID.map((d, i) => (
            <AnimatedPath
              key={i}
              animatedProps={gridProps}
              d={d}
              stroke="rgba(245,240,232,0.05)"
              strokeWidth={1}
              fill="none"
            />
          ))}

          {STARS.map(([x, y], i) => (
            <FadeCircle
              key={i}
              cx={x * 0.46 + 14}
              cy={y * 0.9 + 8}
              r={1}
              fill="rgba(245,240,232,0.5)"
              delay={MOTION.starDelay + i * MOTION.starStagger}
              duration={MOTION.starFade}
              still={still}
            />
          ))}

          {segs.map((d, i) => (
            <Seg
              key={i}
              d={d}
              delay={MOTION.segDelay + i * MOTION.segStagger}
              still={still}
            />
          ))}

          {PTS.map((p, i) => (
            <FadeCircle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === PTS.length - 1 ? 6.5 : 4.5}
              fill={i === PTS.length - 1 ? 'none' : 'rgba(212,175,55,0.85)'}
              stroke={C.gold}
              strokeWidth={1.3}
              delay={MOTION.nodeDelay + i * MOTION.segStagger}
              duration={MOTION.nodeFade}
              still={still}
            />
          ))}
        </Svg>

        {/* compass over the destination node */}
        <Animated.View style={[styles.compass, compassStyle]} pointerEvents="none">
          <Svg width={32} height={32}>
            <G>
              <Circle cx={16} cy={16} r={16} fill="none" stroke="rgba(212,175,55,0.28)" strokeWidth={1} />
              <Path
                d="M20 10l-2.6 6.4-6.4 2.6 2.6-6.4 6.4-2.6z"
                fill="none"
                stroke="rgba(212,175,55,0.6)"
                strokeWidth={1.1}
                strokeLinejoin="round"
              />
            </G>
          </Svg>
        </Animated.View>
      </View>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  kicker: {
    fontFamily: F.hSemi,
    fontSize: 9.5,
    letterSpacing: ls(9.5, 0.22),
    color: 'rgba(212,175,55,0.62)',
  },
  destination: {
    fontFamily: F.hSemi,
    fontSize: 19,
    lineHeight: 19 * 1.4,
    color: C.bone,
    textAlign: 'center',
    marginTop: 14,
  },
  canvas: { marginTop: 26, width: 330, height: 190 },
  compass: { position: 'absolute', left: 284, top: 42, width: 32, height: 32 },
  status: {
    fontFamily: F.b,
    fontSize: 11.5,
    color: C.boneFaint,
    marginTop: 22,
  },
});
