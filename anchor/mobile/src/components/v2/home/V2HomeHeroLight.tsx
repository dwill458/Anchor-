import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { mixHex } from '@/components/v2/anchor/anchorExpressions';
import { HERO_GOLD, HERO_GOLD_LIGHT, HERO_HALO_SCALE, HERO_RING } from './homeHeroPresence';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Where the halo's gradient is cool (unmeasured / low Consistency) and where it has warmed to. */
const HALO_COOL = '#EADFC8';
const HALO_WARM = '#E6C77A';

let haloSerial = 0;

/**
 * Soft warm light behind the coin plus a contact shadow beneath it. One static SVG, no animation:
 * its job is to give a textureless line depth and objecthood, and it must cost nothing on a
 * mid-range phone. Radial gradients carry explicit rx/ry because Android's renderer ignores `r`.
 *
 * `warmth` (0..1, from Consistency) moves the light from pale ivory toward gold and lifts its
 * strength a little. It is a quiet cue, never a gauge: the number is on the line below.
 */
export const HeroHalo = memo(function HeroHalo({ size, boxHeight, warmth }: { size: number; boxHeight: number; warmth: number }) {
  const id = React.useRef(`hero-halo-${(haloSerial += 1)}`).current;
  const span = Math.round(size * HERO_HALO_SCALE);
  const glow = mixHex(HALO_COOL, HALO_WARM, warmth);
  const strength = 0.5 + 0.3 * warmth;
  const half = span / 2;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.centred, { width: span, height: span, top: boxHeight / 2, marginLeft: -half, marginTop: -half }]}
    >
      <Svg width={span} height={span} viewBox={`0 0 ${span} ${span}`}>
        <Defs>
          <RadialGradient id={`${id}-glow`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={strength} />
            <Stop offset="0.52" stopColor={glow} stopOpacity={strength * 0.42} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}-shadow`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor="#14162B" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#14162B" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={half} cy={half} r={half} fill={`url(#${id}-glow)`} />
        {/* Offset down and flattened: light falls from above the coin. */}
        <Ellipse cx={half} cy={half + size * 0.5} rx={size * 0.46} ry={size * 0.09} fill={`url(#${id}-shadow)`} />
      </Svg>
    </View>
  );
});

/**
 * A single thin gold ring around the coin that says where today stands: an empty track while the
 * Anchor has not been practised today, drawn closed once it has. It reuses the hold-to-seal ring
 * language — a hairline circle that fills from twelve o'clock — rather than inventing a new gauge.
 *
 * It is binary on purpose. The app has no per-day target to fill toward, and a ring that showed
 * invented partial progress would be a worse lie than a ring that is simply open or closed.
 */
export const HeroStatusRing = memo(function HeroStatusRing({ mountSize, done, entranceDelayMs, reduceMotion }: {
  mountSize: number;
  done: boolean;
  /**
   * Set only for the first-load entrance: the ring starts empty and sweeps after this wait, so the
   * entrance reads line → ring. Without it the ring simply is what it is on mount; only a later
   * change (finishing a practice) is animated.
   */
  entranceDelayMs?: number;
  reduceMotion: boolean;
}) {
  const radius = mountSize / 2 + HERO_RING.gap;
  const span = Math.ceil((radius + HERO_RING.stroke) * 2) + 2;
  const centre = span / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(done && entranceDelayMs === undefined ? 1 : 0);
  const firstRun = React.useRef(true);

  useEffect(() => {
    const target = done ? 1 : 0;
    const first = firstRun.current;
    firstRun.current = false;
    if (reduceMotion || (first && entranceDelayMs === undefined)) {
      progress.value = target;
      return;
    }
    const wait = first ? entranceDelayMs ?? 0 : 0;
    progress.value = withDelay(wait, withTiming(target, { duration: done ? 1100 : 300, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [done, entranceDelayMs, progress, reduceMotion]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.centred, { width: span, height: span, top: '50%', marginLeft: -span / 2, marginTop: -span / 2 }]}
    >
      <Svg width={span} height={span} viewBox={`0 0 ${span} ${span}`}>
        <Circle cx={centre} cy={centre} r={radius} stroke={HERO_GOLD} strokeOpacity={0.24} strokeWidth={0.9} fill="none" />
        {/* Start mark at twelve o'clock: the ring is waiting to be closed, not broken. */}
        {!done ? <Circle cx={centre} cy={centre - radius} r={2.1} fill={HERO_GOLD} fillOpacity={0.55} /> : null}
        <AnimatedCircle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={HERO_GOLD_LIGHT}
          strokeWidth={HERO_RING.stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          animatedProps={arc}
          // Start at twelve o'clock, sweep clockwise.
          transform={`rotate(-90 ${centre} ${centre})`}
        />
        <AnimatedCircle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={HERO_GOLD}
          strokeOpacity={0.85}
          strokeWidth={HERO_RING.stroke * 0.55}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          animatedProps={arc}
          transform={`rotate(-90 ${centre} ${centre})`}
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  centred: { position: 'absolute', left: '50%' },
});
