import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import {
  carouselGlowWeight,
  detailsAuraOpacity,
  homeAuraRestingOpacity,
  HOME_AURA_SETTLE_MS,
  normalizeThreadStrength,
  staticAuraLayers,
  THREAD_AURA_SPAN,
  type ThreadAuraVariant,
} from './threadAuraModel';

export type ThreadAuraProps = {
  anchorId?: string;
  svg: string;
  threadStrength: number | null;
  categoryColor: string;
  size: number;
  artworkSize: number;
  variant: ThreadAuraVariant;
  /** Animation budget: the Skia frame loop runs only while this is true. */
  active: boolean;
  /**
   * For `variant === 'home'`: whether this Anchor is the confirmed centred hero. Gates the
   * animated Skia frame loop only. Presence is driven by `carouselOffset` and never by this flag.
   * Defaults to `active` when omitted.
   */
  heroActive?: boolean;
  /**
   * Carousel slot (-1, 0, 1) of this Anchor's mounted item. With `carouselOffset` and
   * `carouselSpacing` it gives the Anchor's live distance from centre on the UI thread.
   */
  carouselSlot?: number;
  /** Optional carousel drag offset: this item's position relative to its slot, in px. */
  carouselOffset?: SharedValue<number>;
  carouselSpacing?: number;
  /** Home only. False suppresses the glow entirely, e.g. while the arrival scene owns the hero. */
  glowEnabled?: boolean;
  /**
   * Practice-complete cards: the glow grows with the Thread Strength bar. A 0..1 shared value (the bar's
   * progress); opacity and reach follow it on the UI thread, up to `threadStrength`'s calibrated glow.
   */
  strengthProgress?: SharedValue<number>;
  /** Practice-only overshoot; changes reach without changing the authoritative strength. */
  strengthBloom?: SharedValue<number>;
  reducedMotion: boolean;
};

/** Decorative geometry only. The existing Anchor renderer always owns the sharp foreground. */
export const ThreadAura = memo(function ThreadAura(props: ThreadAuraProps) {
  const tier = useAppPerformanceTier();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  const isHome = props.variant === 'home';
  const heroActive = isHome ? (props.heroActive ?? props.active) : true;

  // Resting intensity follows Thread Strength. The first value is set directly, so a re-render
  // never resets the glow to zero; later strength changes ease over the settle duration.
  const restingOpacity = isHome ? homeAuraRestingOpacity(props.threadStrength) : detailsAuraOpacity(props.threadStrength);
  const opacity = useSharedValue(restingOpacity);
  const hasSettledOnceRef = useRef(false);
  useEffect(() => {
    if (!hasSettledOnceRef.current || props.reducedMotion) {
      hasSettledOnceRef.current = true;
      cancelAnimation(opacity);
      opacity.value = restingOpacity;
      return;
    }
    opacity.value = withTiming(restingOpacity, { duration: HOME_AURA_SETTLE_MS, easing: Easing.out(Easing.cubic) });
  }, [opacity, restingOpacity, props.reducedMotion]);
  useEffect(() => () => { cancelAnimation(opacity); }, [opacity]);

  const { carouselOffset, carouselSlot, carouselSpacing, glowEnabled = true, strengthProgress, strengthBloom, reducedMotion } = props;
  const finalProgress = Math.max(normalizeThreadStrength(props.threadStrength), 0.001);
  const animatedLayerStyle = useAnimatedStyle(() => {
    if (strengthProgress) {
      const p = Math.max(0, Math.min(1, strengthProgress.value));
      return {
        opacity: detailsAuraOpacity(p * 100),
        transform: [{ scale: interpolate(p, [0, finalProgress], [0.82, 1], 'clamp') * (reducedMotion ? 1 : strengthBloom?.value ?? 1) }],
      };
    }
    // Home: presence is the carousel's live position. Continuous in scroll progress, so there is
    // no activation step and no pop when the Anchor arrives. Details has no carousel: full presence.
    let weight = 1;
    if (isHome) {
      if (!glowEnabled) weight = 0;
      else if (carouselOffset && carouselSpacing && carouselSpacing > 0) {
        weight = carouselGlowWeight(((carouselSlot ?? 0) * carouselSpacing + carouselOffset.value) / carouselSpacing);
      } else {
        weight = heroActive ? 1 : 0;
      }
    }
    return { opacity: opacity.value * weight };
  }, [isHome, carouselOffset, carouselSlot, carouselSpacing, glowEnabled, heroActive, strengthProgress, strengthBloom, reducedMotion, finalProgress]);

  // Native installations without Skia, and web without CanvasKit, retain the same geometry.
  const Renderer = useMemo(() => {
    if (tier === 'low' || props.reducedMotion) return null;
    try { return require('./ThreadAuraCanvas').ThreadAuraCanvas as React.ComponentType<ThreadAuraProps & { animate: boolean; particlesEnabled: boolean }>; }
    catch { return null; }
  }, [tier, props.reducedMotion]);
  const noGlow = normalizeThreadStrength(props.threadStrength) <= 0;
  const animate = props.active && heroActive && foreground && !props.reducedMotion && tier !== 'low';
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    testID={`thread-aura-${props.variant}`} style={[styles.layer, { width: props.size * THREAD_AURA_SPAN, height: props.size * THREAD_AURA_SPAN, left: -props.size * (THREAD_AURA_SPAN - 1) / 2, top: -props.size * (THREAD_AURA_SPAN - 1) / 2 }, animatedLayerStyle]}>
    {noGlow ? null : Renderer ? <Renderer {...props} active={props.active && heroActive && foreground} animate={animate} particlesEnabled={tier === 'high'} /> : <ThreadAuraStatic {...props} />}
  </Animated.View>;
});

/**
 * Static renderer, the baseline the premium glow must hold on low tier, battery saver and reduced motion.
 * A thin luminous rim plus a soft radial-gradient halo. No blur filter, no per-frame work: the
 * carousel and strength animate only the wrapper's opacity on the UI thread.
 */
export const ThreadAuraStatic = memo(function ThreadAuraStatic(props: ThreadAuraProps) {
  const id = React.useId().replace(/:/g, '');
  const layers = staticAuraLayers(props.threadStrength);
  const span = props.size * THREAD_AURA_SPAN;
  const centre = span / 2;
  const rim = props.size / 2;
  const haloRadius = rim * (1 + layers.haloReach);
  // Gradient stops are fractions of the halo radius. The rim sits at `inner`; the falloff runs to 0 at the edge.
  const inner = rim / haloRadius;
  const mid = inner + (1 - inner) * 0.4;
  return <Svg width="100%" height="100%" viewBox={`0 0 ${span} ${span}`}>
    <Defs>
      <RadialGradient id={`${id}-halo`} cx={centre} cy={centre} r={haloRadius} gradientUnits="userSpaceOnUse">
        <Stop offset={inner} stopColor={props.categoryColor} stopOpacity={layers.haloRimOpacity} />
        <Stop offset={mid} stopColor={props.categoryColor} stopOpacity={layers.haloMidOpacity} />
        <Stop offset={1} stopColor={props.categoryColor} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Circle cx={centre} cy={centre} r={haloRadius} fill={`url(#${id}-halo)`} />
    <Circle cx={centre} cy={centre} r={rim * 1.02} fill="none" stroke={props.categoryColor}
      strokeWidth={props.size * layers.ringWidth} opacity={layers.ringOpacity} />
  </Svg>;
});

const styles = StyleSheet.create({ layer: { position: 'absolute' } });
