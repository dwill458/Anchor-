import React, { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

/**
 * Module-level singleton ref — allows any component or navigator to trigger the
 * veil without prop drilling or context. Assigned once when NavigationVeil mounts.
 */
export const navigationVeilRef: { trigger: ((onPeak: () => void) => void) | null } = {
  trigger: null,
};

/**
 * NavigationVeil
 *
 * A dark overlay that signals a "mode shift" during tab transitions. When triggered:
 * 1. Fades in to 0.9 opacity (100ms, ease-out) — covers the screen before tab switch
 * 2. At peak opacity calls `onPeak()` — where the actual navigation fires
 * 3. Fades out to 0 (300ms, ease-out cubic) — clears quickly so content is visible fast
 *
 * ease-out cubic on the reveal means it starts fast and slows at the end, so the user
 * sees content within ~150ms of navigation firing rather than waiting for a sluggish
 * ease-in-out that barely moves in the first half of its duration.
 *
 * Always `pointerEvents="none"` so it never intercepts touches during its fade-out.
 */
export const NavigationVeil: React.FC = () => {
  const opacity = useSharedValue(0);

  const triggerTransition = useCallback(
    (onPeak: () => void) => {
      opacity.value = withTiming(
        0.9,
        { duration: 100, easing: Easing.out(Easing.quad) },
        () => {
          // Always fire navigation regardless of whether animation was interrupted —
          // omitting the `finished` guard prevents the veil getting stuck on rapid taps
          runOnJS(onPeak)();
          opacity.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
          });
        },
      );
    },
    [opacity],
  );

  // Register on mount, clean up on unmount
  useEffect(() => {
    navigationVeilRef.trigger = triggerTransition;
    return () => {
      navigationVeilRef.trigger = null;
    };
  }, [triggerTransition]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.veil, animatedStyle]}
    />
  );
};

const styles = StyleSheet.create({
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 999,
  },
});
