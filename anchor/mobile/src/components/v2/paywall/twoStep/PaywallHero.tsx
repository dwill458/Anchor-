import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { PaywallAnchorArt, type PaywallAnchorArtModel } from './PaywallAnchorArt';
import { PAYWALL_EASE_OUT, PAYWALL_LAYOUT, PAYWALL_TIMING } from './paywallMotion';

type Props = {
  art: PaywallAnchorArtModel | null;
  /** Left edge of the W-wide column inside the screen. */
  columnLeft: number;
  designWidth: number;
  /** Medallion top for each step, in content coordinates. */
  top: readonly [number, number];
  step: SharedValue<number>;
  /** Bumped on every step change; replays the single sheen pass. */
  stepChanges: number;
  reduceMotion: boolean;
};

const SHEEN_COLORS = ['rgba(255, 248, 232, 0)', 'rgba(255, 248, 232, 0.34)', 'rgba(255, 248, 232, 0)'] as const;

/**
 * The one persistent medallion. It is laid out once at its step-1 frame and
 * reaches its step-2 frame by translate + scale only, so the step change
 * never re-mounts or re-lays-out the artwork.
 */
export function PaywallHero({ art, columnLeft, designWidth: W, top, step, stepChanges, reduceMotion }: Props) {
  const [size1, size2] = [PAYWALL_LAYOUT.medallionSize[0] * W, PAYWALL_LAYOUT.medallionSize[1] * W];
  const centreTravel = top[1] + size2 / 2 - (top[0] + size1 / 2);
  const scaleTo = size2 / size1;

  const fade = useSharedValue(reduceMotion ? 1 : 0);
  const grow = useSharedValue(reduceMotion ? 1 : PAYWALL_TIMING.medallionFromScale);
  const float = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      fade.value = 1;
      grow.value = 1;
      return;
    }
    fade.value = withDelay(
      PAYWALL_TIMING.medallionDelayMs,
      withTiming(1, { duration: PAYWALL_TIMING.medallionFadeMs, easing: PAYWALL_EASE_OUT }),
    );
    grow.value = withDelay(
      PAYWALL_TIMING.medallionDelayMs,
      withTiming(1, { duration: PAYWALL_TIMING.medallionScaleMs, easing: PAYWALL_EASE_OUT }),
    );
    // The system reduce-motion flag resolves asynchronously; settling it re-runs this to its end state.
  }, [fade, grow, reduceMotion]);

  useEffect(() => {
    cancelAnimation(float);
    if (reduceMotion) {
      float.value = 0;
      return;
    }
    const half = PAYWALL_TIMING.floatMs / 2;
    const drift = { duration: half, easing: Easing.inOut(Easing.sin) };
    float.value = withDelay(
      PAYWALL_TIMING.medallionDelayMs + PAYWALL_TIMING.medallionScaleMs,
      withRepeat(withSequence(withTiming(1, drift), withTiming(0, drift)), -1),
    );
  }, [float, reduceMotion]);

  useEffect(() => {
    cancelAnimation(sheen);
    sheen.value = 0;
    if (reduceMotion) return;
    const delay = stepChanges === 0 ? PAYWALL_TIMING.sheenIntroDelayMs : PAYWALL_TIMING.sheenStepDelayMs;
    sheen.value = withDelay(delay, withTiming(1, { duration: PAYWALL_TIMING.sheenMs, easing: Easing.inOut(Easing.quad) }));
  }, [reduceMotion, sheen, stepChanges]);

  const stepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: step.value * centreTravel }, { scale: 1 + step.value * (scaleTo - 1) }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * PAYWALL_LAYOUT.float * W }],
  }));
  const introStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: grow.value }] }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value > 0 && sheen.value < 1 ? 1 : 0,
    transform: [{ translateX: (sheen.value * 2 - 1) * size1 * 1.1 }, { rotate: '24deg' }],
  }));

  const round = { width: size1, height: size1, borderRadius: size1 / 2 };

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.frame, { left: columnLeft + (W - size1) / 2, top: top[0] }, round, stepStyle]}
      testID="v2-paywall-hero"
    >
      <Animated.View style={[round, floatStyle]}>
        <Animated.View style={[round, styles.shadow, introStyle]}>
          <View style={[round, styles.clip]}>
            <PaywallAnchorArt art={art} size={size1} />
            <Animated.View style={[styles.sheen, { width: size1 * 0.42, height: size1 * 1.6, top: -size1 * 0.3, left: size1 * 0.29 }, sheenStyle]}>
              <LinearGradient colors={SHEEN_COLORS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute' },
  shadow: {
    backgroundColor: '#0F1020',
    ...Platform.select({
      ios: { shadowColor: '#0B0C18', shadowOpacity: 0.32, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
      default: { elevation: 14 },
    }),
  },
  clip: { overflow: 'hidden' },
  sheen: { position: 'absolute' },
});
