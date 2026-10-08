import React, { memo, useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { mixHex } from '@/components/v2/anchor/anchorExpressions';
import { shouldAnimateGlow, useHomeGlowSeenStore } from '@/stores/v2/homeGlowSeenStore';
import { HERO_GOLD, HERO_GOLD_LIGHT, HERO_HALO_SCALE, HERO_RING, heroWarmth } from './homeHeroPresence';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Where the halo's gradient is cool (unmeasured / low Consistency) and where it has warmed to. */
export const HALO_COOL = '#EADFC8';
export const HALO_WARM = '#E6C77A';

/** How long the glow takes to ease from the Thread Strength last seen on Home to the current one. */
export const HOME_GLOW_EASE_MS = 1200;

let haloSerial = 0;

type HaloGeometry = { span: number; half: number; size: number };

/**
 * One layer of the halo light. Pale ivory at `warmth` 0, warm gold at 1. The contact shadow is drawn
 * only on the top layer, so a crossfade never stacks two shadows.
 */
function HaloLight({ geometry, warmth, layerId, withShadow }: { geometry: HaloGeometry; warmth: number; layerId: string; withShadow: boolean }) {
  const { span, half, size } = geometry;
  const glow = mixHex(HALO_COOL, HALO_WARM, warmth);
  const strength = 0.5 + 0.3 * warmth;
  return (
    <Svg width={span} height={span} viewBox={`0 0 ${span} ${span}`}>
      <Defs>
        <RadialGradient id={`${layerId}-glow`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
          <Stop offset="0" stopColor={glow} stopOpacity={strength} />
          <Stop offset="0.52" stopColor={glow} stopOpacity={strength * 0.42} />
          <Stop offset="1" stopColor={glow} stopOpacity={0} />
        </RadialGradient>
        {withShadow ? (
          <RadialGradient id={`${layerId}-shadow`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor="#14162B" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#14162B" stopOpacity={0} />
          </RadialGradient>
        ) : null}
      </Defs>
      <Circle cx={half} cy={half} r={half} fill={`url(#${layerId}-glow)`} />
      {/* Offset down and flattened: light falls from above the coin. */}
      {withShadow ? <Ellipse cx={half} cy={half + size * 0.5} rx={size * 0.46} ry={size * 0.09} fill={`url(#${layerId}-shadow)`} /> : null}
    </Svg>
  );
}

/**
 * The warmth the halo was showing before this render, while it eases toward the current value.
 * Null when it is settled. The record is written when the ease starts, so a remount never replays it.
 *
 * Until the store has hydrated, the light settles on the current value and records nothing. Once it
 * has, a stored value that differs from the current one eases from the stored value (a late ease, so a
 * change made while the app was closed is still shown). A stored value that matches, or no stored value,
 * settles. Reduce Motion settles and records. An unmeasured thread never animates or records.
 */
function useHomeGlowEase(anchorId: string | null, strength: number | null, reduceMotion: boolean) {
  const hydrated = useHomeGlowSeenStore((state) => state.hydrated);
  const progress = useSharedValue(1);
  const [fromWarmth, setFromWarmth] = useState<number | null>(null);

  // A layout effect, so the seen layer is mounted before the first paint of a late ease. The current
  // layer then never shows at full strength ahead of the crossfade, and the ease starts from the seen warmth.
  useLayoutEffect(() => {
    const store = useHomeGlowSeenStore.getState();
    if (!store.hydrated) {
      cancelAnimation(progress);
      progress.value = 1;
      setFromWarmth(null);
      return;
    }

    const measured = typeof strength === 'number' && Number.isFinite(strength);
    const seen = anchorId ? store.getSeen(anchorId) : undefined;
    const animate = Boolean(anchorId && measured && !reduceMotion && shouldAnimateGlow(seen, strength));

    if (anchorId && measured && seen !== strength) store.setSeen(anchorId, strength);

    if (!animate) {
      cancelAnimation(progress);
      progress.value = 1;
      setFromWarmth(null);
      return;
    }

    progress.value = 0;
    setFromWarmth(heroWarmth(seen));
    progress.value = withTiming(1, { duration: HOME_GLOW_EASE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished) runOnJS(setFromWarmth)(null);
    });
  }, [anchorId, strength, hydrated, reduceMotion, progress]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  return { fromWarmth, progress };
}

/**
 * Soft warm light behind the coin plus a contact shadow beneath it. It must cost nothing on a
 * mid-range phone, so at rest it is one static SVG. Radial gradients carry explicit rx/ry because
 * Android's renderer ignores `r`.
 *
 * The light follows Thread Strength (`strength`, 0..100, null when unmeasured). Its warmth moves
 * from pale ivory toward gold and lifts its strength a little. It is a quiet cue, never a gauge.
 * When the value has moved since Home last showed it, the light eases from the old warmth to the
 * new one (a crossfade of the two settled lights) over HOME_GLOW_EASE_MS.
 */
export const HeroHalo = memo(function HeroHalo({ size, boxHeight, strength, anchorId, reduceMotion = false }: {
  size: number;
  boxHeight: number;
  strength: number | null;
  /** Keys the stored last-seen value. Without it the light settles and nothing is recorded. */
  anchorId?: string | null;
  reduceMotion?: boolean;
}) {
  const id = React.useRef(`hero-halo-${(haloSerial += 1)}`).current;
  const span = Math.round(size * HERO_HALO_SCALE);
  const half = span / 2;
  const warmth = heroWarmth(strength);
  const { fromWarmth, progress } = useHomeGlowEase(anchorId ?? null, strength, reduceMotion);
  const geometry: HaloGeometry = { span, half, size };
  const fromStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const toStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.centred, { width: span, height: span, top: boxHeight / 2, marginLeft: -half, marginTop: -half }]}
    >
      {fromWarmth !== null ? (
        <Animated.View style={[StyleSheet.absoluteFill, fromStyle]}>
          <HaloLight geometry={geometry} warmth={fromWarmth} layerId={`${id}-from`} withShadow={false} />
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, toStyle]}>
        <HaloLight geometry={geometry} warmth={warmth} layerId={id} withShadow />
      </Animated.View>
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
