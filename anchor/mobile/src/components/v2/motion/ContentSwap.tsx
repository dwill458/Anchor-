import { useEffect, useRef, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { AnchorMotion } from '@/theme/v2';

/** Content that swaps in place arrives a beat after the old content is gone, so the two never smear into one. */
const SWAP_IN = FadeIn.duration(AnchorMotion.duration.standard).delay(AnchorMotion.duration.micro).easing(AnchorMotion.easing.enter);
const SWAP_IN_REDUCED = FadeIn.duration(AnchorMotion.duration.quick);

/**
 * Cross-fades content that changes in place (a filter, a phase). The first content is simply
 * there; each later `contentKey` fades in. Entering-only on purpose: in normal flow a leaving
 * sibling would briefly double the height.
 */
export function ContentSwap({ contentKey, style, children }: { contentKey: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduceMotion = useV2ReduceMotion();
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);
  return (
    <Animated.View
      key={contentKey}
      style={style}
      entering={settled.current ? (reduceMotion ? SWAP_IN_REDUCED : SWAP_IN) : undefined}
    >
      {children}
    </Animated.View>
  );
}
