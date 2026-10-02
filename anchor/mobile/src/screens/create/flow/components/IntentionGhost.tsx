import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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

interface IntentionGhostProps {
  /** Height of the (now empty) field, so the rule and hints sit where they did. */
  fieldHeight: number;
  /** Characters typed, for the count. */
  count: number;
  reduceMotion: boolean;
  /** Seconds the chrome takes to fade away. */
  duration?: number;
}

/**
 * The Intention screen's chrome, inert, laid over the flow's first moments and faded out in
 * 0.45 s while the typed words glide away. It is built from the same pieces as the live screen.
 * The field itself is not drawn: its glyphs belong to the canvas by then.
 */
export function IntentionGhost({ fieldHeight, count, reduceMotion, duration = 0.45 }: IntentionGhostProps) {
  const insets = useSafeAreaInsets();
  const alpha = useSharedValue(1);

  useEffect(() => {
    alpha.value = withTiming(0, { duration: reduceMotion ? 200 : duration * 1000, easing: Easing.out(Easing.quad) });
  }, [alpha, duration, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: alpha.value }));

  return (
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
          <StaticHints />
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <RulesLine />
        <ContinueButtonFace enabled />
        <DrawLinkFace enabled />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Transparent on purpose: the canvas behind it is the paper, and the glyphs on it must show.
  root: { justifyContent: 'space-between' },
  content: { paddingHorizontal: INTENTION_SIDE_PADDING },
  fieldBlock: { marginTop: 28 },
  bottom: { paddingHorizontal: INTENTION_SIDE_PADDING, paddingTop: 12, gap: 12 },
});
