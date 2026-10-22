import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

interface RevealProps {
  children: React.ReactNode;
  /** Milliseconds before the fade begins. */
  delay?: number;
  duration?: number;
  /** Pixels the content rises through as it appears. */
  rise?: number;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fade (and a small rise) on mount. Plain shared-value animation — no layout animations — so it
 * is safe inside the navigation stack. With reduced motion it is simply there.
 */
export function Reveal({ children, delay = 0, duration = 320, rise = 16, reduceMotion = false, style }: RevealProps) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [delay, duration, progress, reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * rise }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
