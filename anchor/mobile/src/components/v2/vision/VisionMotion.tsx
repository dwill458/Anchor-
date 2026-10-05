import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2';
import { AnchorMotion, colors } from '@/theme/v2';

/**
 * Motion for the Vision creation flow. Everything here runs on the shared
 * AnchorMotion tokens and answers to the reduce-motion setting: under it,
 * nothing travels, and what remains is a short fade.
 *
 * The rule the flow follows: motion explains a change. A screen arrives in
 * the order the eye should read it, a control answers the finger, content
 * that swaps cross-fades in place, and a blocked action says why. Copy,
 * counters and rules stay still.
 */

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Gap between siblings arriving in sequence: it reads as an order, never as a wait. */
export const VISION_STAGGER_MS = 60;
/** How far an arriving element rises. */
const RISE_PX = 14;

/** 0 → 1 once, after `delay`. Under reduced motion it is a short fade and nothing moves. */
export function useVisionEntrance(
  delay = 0,
  duration: number = AnchorMotion.duration.standard,
  easing: typeof AnchorMotion.easing.enter = AnchorMotion.easing.enter,
): SharedValue<number> {
  const reduceMotion = useV2ReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = withTiming(1, { duration: AnchorMotion.duration.quick });
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration, easing }));
    return () => cancelAnimation(progress);
  }, [delay, duration, easing, progress, reduceMotion]);
  return progress;
}

/** An element that rises into place. `order` staggers siblings; `base` waits for something before them. */
export function Reveal({ order = 0, base = 0, rise = RISE_PX, style, children }: {
  order?: number; base?: number; rise?: number; style?: StyleProp<ViewStyle>; children: ReactNode;
}) {
  const reduceMotion = useV2ReduceMotion();
  const progress = useVisionEntrance(base + order * VISION_STAGGER_MS);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * rise }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Touch response: the surface sinks a hair under the finger (120ms) and settles
 * back on the snap spring. `pressed` (0 → 1) is exposed so an arrow or icon can
 * lean into the press too. Under reduced motion the surface dims instead.
 */
export function usePressScale(scaleTo = 0.98) {
  const reduceMotion = useV2ReduceMotion();
  const pressed = useSharedValue(0);
  const onPressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: AnchorMotion.duration.micro, easing: AnchorMotion.easing.standard });
  }, [pressed]);
  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, AnchorMotion.spring.snap);
  }, [pressed]);
  const style = useAnimatedStyle(() => (reduceMotion
    ? { opacity: 1 - pressed.value * 0.15 }
    : { transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }] }));
  return { pressed, style, onPressIn, onPressOut };
}

/** A brief wash of gold over the field a blocked action is waiting on. */
export function useAttention() {
  const level = useSharedValue(0);
  const pulse = useCallback(() => {
    level.value = withSequence(
      withTiming(1, { duration: AnchorMotion.duration.micro, easing: AnchorMotion.easing.enter }),
      withTiming(0, { duration: AnchorMotion.duration.expressive + 180, easing: AnchorMotion.easing.standard }),
    );
  }, [level]);
  return { level, pulse };
}

export function AttentionWash({ level, color, radius }: { level: SharedValue<number>; color: string; radius?: number }) {
  const style = useAnimatedStyle(() => ({ opacity: level.value * 0.16 }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: radius }, style]} />;
}

/** In-screen content that arrives or leaves: out fast, in a beat later, so the two never smear into one. */
const CONTENT_IN = FadeIn.duration(AnchorMotion.duration.standard).delay(AnchorMotion.duration.micro).easing(AnchorMotion.easing.enter);
const CONTENT_IN_REDUCED = FadeIn.duration(AnchorMotion.duration.quick);
const CONTENT_OUT = FadeOut.duration(AnchorMotion.duration.micro).easing(AnchorMotion.easing.exit);
export function useVisionContentMotion() {
  const reduceMotion = useV2ReduceMotion();
  return { entering: reduceMotion ? CONTENT_IN_REDUCED : CONTENT_IN, exiting: CONTENT_OUT };
}

/** A chosen photo arrives the way a print is laid down: settling from a hair too large. */
export const VISION_PHOTO_ARRIVE = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.05 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: AnchorMotion.easing.enter },
}).duration(AnchorMotion.duration.expressive);

/** Actions over a photo wait for the photo to land before they appear. */
export const VISION_PHOTO_ACTIONS_IN = FadeIn.delay(AnchorMotion.duration.standard).duration(AnchorMotion.duration.quick);

const STAGE_IN = FadeIn.duration(AnchorMotion.duration.standard).delay(AnchorMotion.duration.micro - 40).easing(AnchorMotion.easing.enter);
const STAGE_IN_REDUCED = FadeIn.duration(AnchorMotion.duration.quick);
const STAGE_OUT = FadeOut.duration(AnchorMotion.duration.micro).easing(AnchorMotion.easing.exit);

/**
 * Between stages the old screen fades out (120ms) and the new one fades in
 * just after, over a shared paper ground, so a photograph never slides against
 * cream. The container only cross-fades; each stage's own content carries the
 * rise. The first stage is not animated by the container (the stage's own
 * entrance covers it).
 */
export function VisionStageTransition({ stage, children }: { stage: string; children: ReactNode }) {
  const reduceMotion = useV2ReduceMotion();
  const settled = useRef(false);
  useEffect(() => { settled.current = true; }, []);
  return (
    <View style={styles.ground}>
      <Animated.View
        key={stage}
        style={StyleSheet.absoluteFill}
        entering={settled.current ? (reduceMotion ? STAGE_IN_REDUCED : STAGE_IN) : undefined}
        exiting={STAGE_OUT}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: colors.canvas },
});
