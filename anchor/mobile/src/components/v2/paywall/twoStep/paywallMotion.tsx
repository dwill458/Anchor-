import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/**
 * Two-step Anchor Pro paywall: every layout ratio and timing in one place.
 * Layout values are fractions of the design width W (the prototype screen is
 * ~2.18 W tall); `[step1, step2]` pairs are what the shared hero and the cream
 * edge travel between.
 */
export const PAYWALL_LAYOUT = {
  /** Widest the composition grows; wider screens centre a W-wide column. */
  maxDesignWidth: 440,
  /** Height of the status-bar band the prototype was drawn under. */
  prototypeStatusBar: 0.125,
  headlineTop: 0.21,
  creamEdge: [1.14, 0.86] as const,
  /** How much higher the cream edge sits at the screen sides than at centre. */
  creamSag: 0.15,
  goldLine: 0.005,
  medallionTop: [0.68, 0.49] as const,
  medallionSize: [0.38, 0.25] as const,
  headlineSize: [0.084, 0.1] as const,
  subSize: 0.037,
  subMaxWidth: 0.84,
  /** Minimum air between the copy and the medallion when large text pushes it down. */
  copyToMedallionGap: 0.03,
  gutter: 0.05,
  afterCreamGap: 0.05,
  wordmarkUnderline: 0.11,
  /** Vertical travel of rising copy and of the CTA label swap. */
  rise: 0.03,
  labelShift: 0.016,
  float: 0.009,
} as const;

export const PAYWALL_EASE_OUT = Easing.out(Easing.cubic);
export const PAYWALL_STEP_EASE = Easing.bezier(0.65, 0, 0.25, 1);

export const PAYWALL_TIMING = {
  medallionFadeMs: 900,
  medallionScaleMs: 1100,
  medallionDelayMs: 150,
  medallionFromScale: 0.86,
  underlineMs: 900,
  underlineDelayMs: 500,
  riseMs: 650,
  riseStaggerMs: 70,
  introRiseDelayMs: 140,
  /** Step-2 copy starts rising once step-1 copy has faded. */
  stepRiseDelayMs: 220,
  stepOutMs: 220,
  stepMs: 900,
  routeDelayMs: 900,
  routeMs: 1400,
  waypointGapMs: 350,
  flagAtMs: 2300,
  sheenMs: 1400,
  sheenIntroDelayMs: 1100,
  sheenStepDelayMs: 700,
  planSelectMs: 350,
  timelineDelayMs: 700,
  timelineFillMs: 900,
  pressMs: 180,
  pressScale: 0.975,
  ctaSheenEveryMs: 5500,
  ctaSheenMs: 1600,
  playRingEveryMs: 3000,
  playRingMs: 1200,
  floatMs: 7000,
  labelSwapMs: 300,
} as const;

type RiseProps = {
  /** True while this step is on screen. */
  active: boolean;
  /** Position in the step's stagger. */
  order: number;
  /** Rise distance in dp (3% W). */
  distance: number;
  reduceMotion: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Copy that rises 3% W while fading in, on a 70 ms stagger, and fades out in
 * ~220 ms when its step leaves. Copy on screen at mount uses the intro delay;
 * every later entry waits for the outgoing step to clear.
 */
export function PaywallRise({ active, order, distance, reduceMotion, style, children }: RiseProps) {
  const progress = useSharedValue(reduceMotion && active ? 1 : 0);
  // Only copy that is on screen at mount uses the intro delay; any later entry follows a step change.
  const atMount = useRef(true);

  useEffect(() => {
    cancelAnimation(progress);
    const isMount = atMount.current;
    atMount.current = false;
    if (reduceMotion) {
      progress.value = active ? 1 : 0;
      return;
    }
    if (active) {
      const base = isMount ? PAYWALL_TIMING.introRiseDelayMs : PAYWALL_TIMING.stepRiseDelayMs;
      progress.value = 0;
      progress.value = withDelay(
        base + order * PAYWALL_TIMING.riseStaggerMs,
        withTiming(1, { duration: PAYWALL_TIMING.riseMs, easing: PAYWALL_EASE_OUT }),
      );
    } else {
      progress.value = withTiming(0, { duration: PAYWALL_TIMING.stepOutMs, easing: PAYWALL_EASE_OUT });
    }
  }, [active, order, progress, reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
