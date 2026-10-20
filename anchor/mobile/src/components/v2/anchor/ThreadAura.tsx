import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import {
  HOME_AURA_BLOOM_IN_MS,
  HOME_AURA_FADE_OUT_MS,
  HOME_AURA_INITIAL_SCALE,
  HOME_AURA_REST_SCALE,
  HOME_AURA_SETTLE_MS,
  detailsAuraOpacity,
  homeAuraEntranceTargets,
  normalizeThreadStrength,
  THREAD_AURA_SPAN,
  threadAuraParameters,
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
  active: boolean;
  /**
   * For `variant === 'home'`: whether this Anchor is the confirmed centered active hero
   * in the Home carousel (`slot === 0 && index === selectedIndex && !carouselMoving`).
   * Defaults to `active` when omitted.
   */
  heroActive?: boolean;
  /**
   * Shared ref from `V2HomeHero` tracking the last `anchorId` that played the Home entrance
   * bloom, preventing duplicate blooms across re-renders, hydration, or navigation away/back.
   */
  lastActivatedAnchorIdRef?: { current: string | null };
  /** Optional carousel drag offset for immediate UI-thread attenuation when swiping begins. */
  carouselOffset?: SharedValue<number>;
  carouselSpacing?: number;
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
  const activationKey = props.anchorId ?? props.svg;
  const fallbackActivatedRef = useRef<string | null>(null);
  const activatedRef = props.lastActivatedAnchorIdRef ?? fallbackActivatedRef;
  const activatedAtRef = useRef<number>(0);
  const wasHeroActiveRef = useRef(false);
  const previousStrengthRef = useRef(props.threadStrength);

  const targets = homeAuraEntranceTargets(props.threadStrength);
  const initialOpacity = !isHome ? detailsAuraOpacity(props.threadStrength) : !heroActive ? 0 : props.reducedMotion ? targets.restingOpacity : targets.initialOpacity;
  const initialScale = !isHome ? 1 : !heroActive ? HOME_AURA_INITIAL_SCALE : props.reducedMotion ? HOME_AURA_REST_SCALE : targets.initialScale;

  const opacity = useSharedValue(initialOpacity);
  const scale = useSharedValue(initialScale);

  useEffect(() => {
    if (!isHome) {
      opacity.value = detailsAuraOpacity(props.threadStrength);
      scale.value = 1;
      return;
    }

    const nextTargets = homeAuraEntranceTargets(props.threadStrength);

    // Zero (or not-yet-known) strength never glows. Unknown data is not consumed as an activation,
    // so the bloom still plays once the authoritative value arrives.
    if (nextTargets.restingOpacity <= 0) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 0;
      scale.value = HOME_AURA_REST_SCALE;
      previousStrengthRef.current = props.threadStrength;
      wasHeroActiveRef.current = heroActive;
      if (heroActive && typeof props.threadStrength === 'number' && Number.isFinite(props.threadStrength)) {
        activatedRef.current = activationKey;
        activatedAtRef.current = Date.now();
      }
      return;
    }

    if (!heroActive) {
      wasHeroActiveRef.current = false;
      cancelAnimation(opacity);
      cancelAnimation(scale);
      if (props.reducedMotion) {
        opacity.value = 0;
        scale.value = HOME_AURA_REST_SCALE;
      } else {
        opacity.value = withTiming(0, {
          duration: HOME_AURA_FADE_OUT_MS,
          easing: Easing.out(Easing.quad),
        });
        scale.value = withTiming(HOME_AURA_INITIAL_SCALE, {
          duration: HOME_AURA_FADE_OUT_MS,
          easing: Easing.out(Easing.quad),
        });
      }
      return;
    }

    const now = Date.now();
    const isNewHero =
      activatedRef.current !== activationKey ||
      (!wasHeroActiveRef.current && activatedAtRef.current > 0 && now - activatedAtRef.current < 100);

    if (isNewHero) {
      activatedRef.current = activationKey;
      activatedAtRef.current = now;
      wasHeroActiveRef.current = true;
      previousStrengthRef.current = props.threadStrength;
      cancelAnimation(opacity);
      cancelAnimation(scale);
      if (props.reducedMotion) {
        opacity.value = nextTargets.restingOpacity;
        scale.value = HOME_AURA_REST_SCALE;
      } else {
        opacity.value = nextTargets.initialOpacity;
        scale.value = nextTargets.initialScale;
        opacity.value = withSequence(
          withTiming(nextTargets.peakOpacity, {
            duration: HOME_AURA_BLOOM_IN_MS,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(nextTargets.restingOpacity, {
            duration: HOME_AURA_SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          }),
        );
        scale.value = withSequence(
          withTiming(nextTargets.peakScale, {
            duration: HOME_AURA_BLOOM_IN_MS,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(nextTargets.restingScale, {
            duration: HOME_AURA_SETTLE_MS,
            easing: Easing.out(Easing.cubic),
          }),
        );
      }
      return;
    }

    if (!wasHeroActiveRef.current) {
      wasHeroActiveRef.current = true;
      previousStrengthRef.current = props.threadStrength;
      cancelAnimation(opacity);
      cancelAnimation(scale);
      if (props.reducedMotion) {
        opacity.value = nextTargets.restingOpacity;
        scale.value = HOME_AURA_REST_SCALE;
      } else {
        opacity.value = withTiming(nextTargets.restingOpacity, {
          duration: HOME_AURA_BLOOM_IN_MS,
          easing: Easing.out(Easing.cubic),
        });
        scale.value = withTiming(HOME_AURA_REST_SCALE, {
          duration: HOME_AURA_BLOOM_IN_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
      return;
    }

    if (props.reducedMotion) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = nextTargets.restingOpacity;
      scale.value = HOME_AURA_REST_SCALE;
      previousStrengthRef.current = props.threadStrength;
      return;
    }

    if (previousStrengthRef.current !== props.threadStrength) {
      previousStrengthRef.current = props.threadStrength;
      opacity.value = withTiming(nextTargets.restingOpacity, {
        duration: HOME_AURA_SETTLE_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [activationKey, activatedRef, heroActive, isHome, opacity, props.reducedMotion, props.threadStrength, scale]);

  useEffect(() => () => {
    wasHeroActiveRef.current = false;
    cancelAnimation(opacity);
    cancelAnimation(scale);
  }, [opacity, scale]);

  const { carouselOffset, carouselSpacing, strengthProgress, strengthBloom, reducedMotion } = props;
  const finalProgress = Math.max(normalizeThreadStrength(props.threadStrength), 0.001);
  const animatedLayerStyle = useAnimatedStyle(() => {
    const dragFade = isHome && carouselOffset && carouselSpacing && carouselSpacing > 0
      ? interpolate(Math.abs(carouselOffset.value), [0, carouselSpacing * 0.32], [1, 0], 'clamp')
      : 1;
    if (strengthProgress) {
      const p = Math.max(0, Math.min(1, strengthProgress.value));
      return {
        opacity: detailsAuraOpacity(p * 100),
        transform: [{ scale: interpolate(p, [0, finalProgress], [0.82, 1], 'clamp') * (reducedMotion ? 1 : strengthBloom?.value ?? 1) }],
      };
    }
    return {
      opacity: opacity.value * dragFade,
      transform: [{ scale: scale.value }],
    };
  }, [isHome, carouselOffset, carouselSpacing, strengthProgress, strengthBloom, reducedMotion, finalProgress]);

  // Native installations without Skia, and web without CanvasKit, retain the same SVG geometry.
  const Renderer = useMemo(() => {
    if (tier === 'low' || props.reducedMotion) return null;
    try { return require('./ThreadAuraCanvas').ThreadAuraCanvas as React.ComponentType<ThreadAuraProps & { animate: boolean; particlesEnabled: boolean }>; }
    catch { return null; }
  }, [tier, props.reducedMotion]);
  const noGlow = normalizeThreadStrength(props.threadStrength) <= 0;
  const animate = props.active && heroActive && foreground && !props.reducedMotion && tier !== 'low';
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    testID={`thread-aura-${props.variant}`} style={[styles.layer, { width: props.size * THREAD_AURA_SPAN, height: props.size * THREAD_AURA_SPAN, left: -props.size * (THREAD_AURA_SPAN - 1) / 2, top: -props.size * (THREAD_AURA_SPAN - 1) / 2 }, animatedLayerStyle]}>
    {noGlow ? null : Renderer ? <Renderer {...props} active={props.active && heroActive && foreground} animate={animate} particlesEnabled={tier === 'high'} /> : <ThreadAuraStatic {...props} lowCost={tier === 'low'} />}
  </Animated.View>;
});

/**
 * Renderer fallback: native SVG blurred rings around the coin edge, strength-correct, never a circular wash.
 * `lowCost` (low tier) skips the SVG Gaussian blur, which is software-rendered on Android and
 * expensive per carousel card, and fakes the bloom with stacked translucent rings instead.
 */
export const ThreadAuraStatic = memo(function ThreadAuraStatic(props: ThreadAuraProps & { lowCost?: boolean }) {
  const id = React.useId().replace(/:/g, '');
  const p = threadAuraParameters(normalizeThreadStrength(props.threadStrength), props.variant);
  const span = props.size * THREAD_AURA_SPAN;
  const r = props.size / 2;
  // Keep the low-tier ring inside the same strength-calibrated reach as the shader. Using
  // overall glow intensity here made the fallback rings much wider at ordinary strengths.
  const strokeWidth = r * p.midWidth * 0.65;
  const opacity = Math.min(1, p.bloom + p.core * 0.4);
  if (props.lowCost) {
    return <Svg width="100%" height="100%" viewBox={`0 0 ${span} ${span}`}>
      <Circle cx={span / 2} cy={span / 2} r={r * 1.04} fill="none" stroke={props.categoryColor} strokeWidth={strokeWidth} opacity={opacity} />
      <Circle cx={span / 2} cy={span / 2} r={r * 1.04} fill="none" stroke={props.categoryColor} strokeWidth={strokeWidth * 2.2} opacity={opacity * 0.35} />
    </Svg>;
  }
  return <Svg width="100%" height="100%" viewBox={`0 0 ${span} ${span}`}>
    <Defs><Filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <FeGaussianBlur stdDeviation={r * p.bloomWidth * 0.8} />
    </Filter></Defs>
    <Circle cx={span / 2} cy={span / 2} r={r * 1.04} fill="none" stroke={props.categoryColor} strokeWidth={strokeWidth}
      opacity={opacity} filter={`url(#${id})`} />
  </Svg>;
});

const styles = StyleSheet.create({ layer: { position: 'absolute' } });
