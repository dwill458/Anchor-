import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { colors } from '@/theme/v2';
import { PAYWALL_TIMING } from './paywallMotion';

type Props = { width: number; height: number; reduceMotion: boolean };

/** Start, four waypoints, then the flag's foot; fractions of the tile. */
const ROUTE: ReadonlyArray<readonly [number, number]> = [
  [0.09, 0.86],
  [0.24, 0.79],
  [0.42, 0.8],
  [0.56, 0.6],
  [0.7, 0.57],
  [0.83, 0.44],
];
const WAYPOINT_COLORS = [colors.paywall.textFaint, colors.paywall.textFaint, colors.paywall.goldDeep, colors.paywall.gold];

function Waypoint({ x, y, r, color, pop }: { x: number; y: number; r: number; color: string; pop: SharedValue<number> }) {
  const radius = useDerivedValue(() => r * pop.value);
  return <Circle cx={x} cy={y} r={radius} color={color} />;
}

/**
 * Decorative "My path" route. The line draws start to end, the four waypoints
 * pop in order 350 ms apart, and the gold flag lands last.
 */
export function PaywallChartTile({ width, height, reduceMotion }: Props) {
  const points = useMemo(() => ROUTE.map(([fx, fy]) => [fx * width, fy * height] as const), [height, width]);
  const route = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const mid = (x0 + x1) / 2;
      p.cubicTo(mid, y0, mid, y1, x1, y1);
    }
    return p.detach();
  }, [points]);
  const [fx, fy] = points[points.length - 1];
  const flag = useMemo(() => {
    const pole = height * 0.26;
    const p = Skia.PathBuilder.Make();
    p.moveTo(fx, fy - pole);
    p.lineTo(fx + width * 0.075, fy - pole + pole * 0.2);
    p.lineTo(fx + width * 0.055, fy - pole + pole * 0.32);
    p.lineTo(fx + width * 0.075, fy - pole + pole * 0.46);
    p.lineTo(fx, fy - pole + pole * 0.42);
    p.close();
    const staff = Skia.PathBuilder.Make();
    staff.moveTo(fx, fy);
    staff.lineTo(fx, fy - pole);
    return { cloth: p.detach(), staff: staff.detach() };
  }, [fx, fy, height, width]);

  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const pops = [useSharedValue(reduceMotion ? 1 : 0), useSharedValue(reduceMotion ? 1 : 0), useSharedValue(reduceMotion ? 1 : 0), useSharedValue(reduceMotion ? 1 : 0)];
  const flagIn = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      pops.forEach((v) => (v.value = 1));
      flagIn.value = 1;
      return;
    }
    const { routeDelayMs, routeMs, waypointGapMs, flagAtMs } = PAYWALL_TIMING;
    draw.value = withDelay(routeDelayMs, withTiming(1, { duration: routeMs, easing: Easing.inOut(Easing.quad) }));
    pops.forEach((v, i) => {
      v.value = withDelay(routeDelayMs + waypointGapMs * (i + 0.5), withTiming(1, { duration: 320, easing: Easing.out(Easing.back(2.4)) }));
    });
    flagIn.value = withDelay(flagAtMs, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.8)) }));
    // Plays once per mount; a late reduce-motion answer snaps it to the drawn state.
    // `pops` is a fixed set of shared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const flagTransform = useDerivedValue(() => [{ translateY: (1 - flagIn.value) * -height * 0.12 }]);
  const flagOpacity = useDerivedValue(() => flagIn.value);
  const dot = Math.max(2.6, width * 0.014);

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={route} style="stroke" strokeWidth={1.6} strokeCap="round" color={colors.paywall.goldDeep} start={0} end={draw} />
        <Circle cx={points[0][0]} cy={points[0][1]} r={dot * 0.9} color={colors.paywall.textFaint} />
        {pops.map((pop, i) => (
          <Waypoint key={i} x={points[i + 1][0]} y={points[i + 1][1]} r={dot} color={WAYPOINT_COLORS[i]} pop={pop} />
        ))}
        <Group transform={flagTransform} opacity={flagOpacity}>
          <Path path={flag.staff} style="stroke" strokeWidth={1.4} color={colors.paywall.gold} />
          <Path path={flag.cloth} color={colors.paywall.gold} />
          <Circle cx={fx} cy={fy} r={dot * 1.15} color={colors.paywall.gold} />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { position: 'absolute', left: 0, top: 0 } });
