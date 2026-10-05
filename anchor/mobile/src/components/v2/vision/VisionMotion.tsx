import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2';
import { AnchorMotion, colors } from '@/theme/v2';
import { useEntrance } from '@/components/v2/motion';

/**
 * Motion for the Vision creation flow. Everything here runs on the shared
 * AnchorMotion tokens and answers to the reduce-motion setting: under it,
 * nothing travels, and what remains is a short fade.
 *
 * The rule the flow follows: motion explains a change. A screen arrives in
 * the order the eye should read it, a control answers the finger, content
 * that swaps cross-fades in place, and a blocked action says why. Copy,
 * counters and rules stay still.
 *
 * The reusable pieces (entrance, press, attention) live in `components/v2/motion`
 * and are re-exported here so Vision and the screens that borrowed them keep
 * one import. What stays below is specific to Vision's stages and photographs.
 */
export {
  AnimatedPressable,
  AttentionWash,
  Reveal,
  useAttention,
  usePressScale,
} from '@/components/v2/motion';

/** Gap between siblings arriving in sequence: it reads as an order, never as a wait. */
export const VISION_STAGGER_MS = AnchorMotion.stagger.step;

/** 0 → 1 once, after `delay`. Under reduced motion it is a short fade and nothing moves. */
export const useVisionEntrance = useEntrance;

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
