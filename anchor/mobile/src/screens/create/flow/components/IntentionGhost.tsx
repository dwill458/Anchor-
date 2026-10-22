import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  ContinueButtonFace,
  DrawLinkFace,
  INTENTION_SIDE_PADDING,
  IntentionFieldLabel,
  IntentionHeader,
  IntentionRule,
  RulesLine,
  StaticHints,
} from '../../components/IntentionChrome';
import type { FocusTip } from '@/constants/v2/focusAreas';

interface IntentionGhostProps {
  /** Height of the (now empty) field, so the rule and hints sit where they did. */
  fieldHeight: number;
  /** Characters typed, for the count. */
  count: number;
  reduceMotion: boolean;
  /** Coaching tip the live screen showed, so the chrome fades as it was. */
  tip?: FocusTip;
  /** Seconds the chrome takes to fade away. */
  duration?: number;
}

/**
 * The Intention screen's chrome, inert, laid over the flow's first moments and faded out in
 * 0.45 s while the typed words glide away. It is built from the same pieces as the live screen.
 * The field itself is not drawn: its glyphs belong to the canvas by then.
 */
export function IntentionGhost({ fieldHeight, count, reduceMotion, tip, duration = 0.45 }: IntentionGhostProps) {
  const insets = useSafeAreaInsets();
  const alpha = useSharedValue(1);
  const faceAlpha = useSharedValue(1);

  useEffect(() => {
    const fadeMs = reduceMotion ? 200 : duration * 1000;
    alpha.value = withTiming(0, { duration: fadeMs, easing: Easing.out(Easing.quad) });
    // The Continue face stays at full opacity until everything else is gone — fading a dark
    // button through the cream reads as it greying out — then leaves in a short fade of its own.
    faceAlpha.value = withDelay(fadeMs, withTiming(0, { duration: 120 }));
  }, [alpha, duration, faceAlpha, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: alpha.value }));
  const faceStyle = useAnimatedStyle(() => ({ opacity: faceAlpha.value }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.content, { paddingTop: insets.top + 32 }]}>
        <IntentionHeader />
        <View style={styles.fieldBlock}>
          <IntentionFieldLabel count={count} max={100} />
          <View style={{ height: fieldHeight + 14 }} />
          <IntentionRule />
          <StaticHints tip={tip} />
        </View>
      </View>

    </Animated.View>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Animated.View style={style}>
          <RulesLine />
        </Animated.View>
        <Animated.View style={faceStyle}>
          <ContinueButtonFace enabled />
        </Animated.View>
        <Animated.View style={style}>
          <DrawLinkFace enabled />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent on purpose: the canvas behind it is the paper, and the glyphs on it must show.
  root: { justifyContent: 'space-between' },
  content: { paddingHorizontal: INTENTION_SIDE_PADDING },
  fieldBlock: { marginTop: 28 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: INTENTION_SIDE_PADDING, paddingTop: 12, gap: 12 },
});
