import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { AnchorMotion } from '@/theme/v2';

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One frame of a pressed surface. Under reduced motion it dims instead of sinking. */
export function pressFrame(pressed: number, scaleTo: number, reduceMotion: boolean): { scale: number; opacity: number } {
  'worklet';
  return reduceMotion
    ? { scale: 1, opacity: 1 - pressed * 0.15 }
    : { scale: 1 - pressed * (1 - scaleTo), opacity: 1 };
}

/**
 * Touch response: the surface sinks a hair under the finger (120ms) and settles
 * back on the snap spring. `pressed` (0 → 1) is exposed so an arrow or icon can
 * lean into the press too. Under reduced motion the surface dims instead.
 */
export function usePressScale(scaleTo: number = AnchorMotion.press.scale) {
  const reduceMotion = useV2ReduceMotion();
  const pressed = useSharedValue(0);
  const onPressIn = useCallback(() => {
    pressed.value = withTiming(1, {
      duration: AnchorMotion.duration.micro,
      easing: AnchorMotion.easing.standard,
      reduceMotion: ReduceMotion.Never,
    });
  }, [pressed]);
  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, { ...AnchorMotion.spring.snap, reduceMotion: ReduceMotion.Never });
  }, [pressed]);
  const style = useAnimatedStyle(() => {
    const frame = pressFrame(pressed.value, scaleTo, reduceMotion);
    return reduceMotion ? { opacity: frame.opacity } : { transform: [{ scale: frame.scale }] };
  });
  return { pressed, style, onPressIn, onPressOut };
}

/** A brief wash of gold over the field a blocked action is waiting on. */
export function useAttention() {
  const level = useSharedValue(0);
  const pulse = useCallback(() => {
    level.value = withSequence(
      withTiming(1, { duration: AnchorMotion.duration.micro, easing: AnchorMotion.easing.enter, reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: AnchorMotion.duration.expressive + 180, easing: AnchorMotion.easing.standard, reduceMotion: ReduceMotion.Never }),
    );
  }, [level]);
  return { level, pulse };
}

export function AttentionWash({ level, color, radius }: { level: SharedValue<number>; color: string; radius?: number }) {
  const style = useAnimatedStyle(() => ({ opacity: level.value * 0.16 }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: radius }, style]} />;
}
