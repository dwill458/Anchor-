import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { AnchorMotion } from '@/theme/v2';
import { revealFrame, staggerDelay } from './entrance';

/**
 * 0 → 1 once, after `delay`. Under reduced motion it is a short fade and nothing moves.
 * The in-app reduce-motion setting decides, so Reanimated's own OS check is opted out of.
 */
export function useEntrance(
  delay = 0,
  duration: number = AnchorMotion.duration.standard,
  easing: typeof AnchorMotion.easing.enter = AnchorMotion.easing.enter,
): SharedValue<number> {
  const reduceMotion = useV2ReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = withTiming(1, { duration: AnchorMotion.duration.quick, reduceMotion: ReduceMotion.Never });
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration, easing, reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(progress);
  }, [delay, duration, easing, progress, reduceMotion]);
  return progress;
}

type RevealProps = {
  /** Position among siblings; later orders arrive a beat after earlier ones, up to the stagger cap. */
  order?: number;
  /** Waits for something before the first sibling (ms). */
  base?: number;
  rise?: number;
  /** When false the content is simply present: no entrance, no wrapper animation. */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** An element that rises into place once, when it mounts. */
export function Reveal({ order = 0, base = 0, rise = AnchorMotion.rise, enabled = true, style, children }: RevealProps) {
  if (!enabled) return <Animated.View style={style}>{children}</Animated.View>;
  return <RevealActive order={order} base={base} rise={rise} style={style}>{children}</RevealActive>;
}

function RevealActive({ order, base, rise, style, children }: Required<Pick<RevealProps, 'order' | 'base' | 'rise'>> & Pick<RevealProps, 'style' | 'children'>) {
  const reduceMotion = useV2ReduceMotion();
  const progress = useEntrance(staggerDelay(order, base));
  const animated = useAnimatedStyle(() => revealFrame(progress.value, rise, reduceMotion));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
