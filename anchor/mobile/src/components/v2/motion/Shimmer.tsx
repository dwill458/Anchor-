import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { AnchorMotion } from '@/theme/v2';

const DIM = 0.55;

/** A slow breathing pulse for a placeholder that is waiting on something. Still under reduced motion. */
type ShimmerProps = { style?: StyleProp<ViewStyle>; testID?: string; accessibilityElementsHidden?: boolean; children?: ReactNode };

export function Shimmer({ style, testID, accessibilityElementsHidden, children }: ShimmerProps) {
  const reduceMotion = useV2ReduceMotion();
  const level = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      level.value = 1;
      return;
    }
    level.value = withRepeat(
      withTiming(DIM, { duration: AnchorMotion.duration.ambient / 2, easing: AnchorMotion.easing.gentle, reduceMotion: ReduceMotion.Never }),
      -1,
      true,
    );
    return () => cancelAnimation(level);
  }, [level, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: level.value }));
  return (
    <Animated.View testID={testID} accessibilityElementsHidden={accessibilityElementsHidden} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}
