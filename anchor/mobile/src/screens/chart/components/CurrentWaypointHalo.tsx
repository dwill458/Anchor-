import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

/**
 * Restrained breathing halo behind the current (non-blocked) waypoint. This
 * is the map's one continuous animation — everything else is static or
 * one-shot — kept off the JS thread via Reanimated worklets.
 */
export type CurrentWaypointHaloProps = {
  size: number;
  reducedMotion: boolean;
  /** true while an advancement animation is settling this node into place. */
  settling?: boolean;
};

export const CurrentWaypointHalo: React.FC<CurrentWaypointHaloProps> = ({ size, reducedMotion, settling = false }) => {
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      breath.value = 0.6;
      return;
    }

    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    return () => {
      cancelAnimation(breath);
    };
  }, [reducedMotion, breath]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return { opacity: 0.55, transform: [{ scale: 1 }] };
    }
    return {
      opacity: 0.2 + breath.value * 0.3,
      transform: [{ scale: 0.94 + breath.value * 0.08 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: settling ? colors.gold : `${colors.gold}55`,
        },
        animatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'rgba(212,175,55,0.06)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
  },
});
