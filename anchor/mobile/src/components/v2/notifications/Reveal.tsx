import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AnchorMotion } from '@/theme/v2/motion';
import { NOTIFICATION_MOTION, useNotificationReduceMotion } from './notificationMotion';

interface RevealProps {
  /** Position in the stagger order; later siblings arrive after earlier ones. */
  index?: number;
  /** Overrides the resolved Reduce Motion setting (mainly for tests and previews). */
  reduceMotion?: boolean;
  /** Play once per mount (default). Later prop or re-render changes never replay it. */
  once?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Fade-and-rise arrival for a piece of content. Plays once on mount; under
 * Reduce Motion it is an opacity-only fade of `reducedMs` with no rise.
 * UI-thread opacity/transform only - nothing here re-renders per frame.
 */
export const Reveal: React.FC<RevealProps> = ({
  index = 0,
  reduceMotion,
  once = true,
  style,
  children,
}) => {
  const hookReduced = useNotificationReduceMotion();
  const reduced = reduceMotion ?? hookReduced;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = withTiming(1, {
        duration: NOTIFICATION_MOTION.reducedMs,
        easing: AnchorMotion.easing.enter,
      });
      return;
    }
    progress.value = withDelay(
      Math.max(0, index) * NOTIFICATION_MOTION.staggerMs,
      withTiming(1, {
        duration: NOTIFICATION_MOTION.textRevealMs,
        easing: AnchorMotion.easing.enter,
      })
    );
    // `once` pins the effect to mount; otherwise it follows its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, once ? [] : [index, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduced
      ? []
      : [{ translateY: (1 - progress.value) * NOTIFICATION_MOTION.rise }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};

export default Reveal;
