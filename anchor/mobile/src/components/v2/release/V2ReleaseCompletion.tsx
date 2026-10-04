import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2Button } from '@/components/v2';
import type { V2ReleaseEnding } from '@/adapters/v2/release';
import { colors, spacing } from '@/theme/v2';
import type { V2ReleaseActionId } from '@/constants/v2/release';
import { v2Haptics } from '@/hooks/v2';
import { releaseTypography } from './releaseTypography';

interface Props {
  ending: V2ReleaseEnding;
  reduceMotion?: boolean;
  onAction: (action: V2ReleaseActionId) => void;
  testID?: string;
}

/** The result reveal takes 400ms (Reduced Motion: a short crossfade). */
const REVEAL_MS = 400;

/** Mounted only after the server has confirmed release and the empty interval has ended. */
export function V2ReleaseCompletion({ ending, reduceMotion = false, onAction, testID }: Props) {
  const insets = useSafeAreaInsets();
  const paper = useSharedValue(0);
  const words = useSharedValue(0);
  const actions = useSharedValue(0);
  const title = useRef<Text>(null);
  const notified = useRef(false);
  useEffect(() => {
    const duration = reduceMotion ? 120 : REVEAL_MS;
    paper.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    words.value = withDelay(reduceMotion ? 0 : 130, withTiming(1, { duration }));
    actions.value = withDelay(reduceMotion ? 0 : 260, withTiming(1, { duration }));
    // Soft success haptic once, at settle; focus then moves to the heading.
    const timer = setTimeout(() => {
      if (!notified.current) { notified.current = true; v2Haptics.completion(); }
      const node = findNodeHandle(title.current);
      if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
    }, reduceMotion ? 120 : 680);
    return () => clearTimeout(timer);
  }, [reduceMotion, paper, words, actions]);
  const ground = useAnimatedStyle(() => ({ opacity: paper.value }));
  const body = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: reduceMotion ? 0 : (1 - words.value) * 7 }] }));
  const ctas = useAnimatedStyle(() => ({ opacity: actions.value }));
  const heading = ending.title ?? ending.eyebrow;
  return <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]} testID={testID ?? 'v2-release-completion'}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.paper, ground]} />
    <Animated.View style={[styles.bodyWrap, body]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {ending.title ? <Text style={styles.kicker} testID="v2-release-completion-eyebrow">{ending.eyebrow}</Text> : null}
        <Text ref={title} style={styles.title} accessibilityRole="header" testID="v2-release-completion-heading">{heading}</Text>
        <Text style={styles.detail} testID="v2-release-completion-body">{ending.body}</Text>
        <Text style={styles.intention}>“{ending.intentionText}”</Text>
        {ending.successor ? (
          <View style={styles.successor} testID="v2-release-completion-successor">
            <Text style={styles.intention}>“{ending.successor.intentionText}”</Text>
            <Text style={styles.note}>{ending.successor.note}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Animated.View>
    <Animated.View style={[styles.actions, ctas]}>
      <V2Button variant="primary" size="large" onPress={() => onAction(ending.primary.id)} testID="v2-release-completion-primary">{ending.primary.label}</V2Button>
      {ending.secondary ? <V2Button variant="tertiary" size="large" onPress={() => onAction(ending.secondary!.id)} testID="v2-release-completion-secondary">{ending.secondary.label}</V2Button> : null}
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 24 },
  paper: { backgroundColor: colors.frame },
  bodyWrap: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', gap: spacing[3] },
  kicker: { ...releaseTypography.small, color: colors.text.secondary },
  title: { ...releaseTypography.title, color: colors.ink.base },
  detail: { ...releaseTypography.body, color: colors.text.secondary },
  intention: { ...releaseTypography.body, color: colors.ink.base, marginTop: spacing[2] },
  successor: { gap: spacing[1] },
  note: { ...releaseTypography.small, color: colors.text.secondary },
  actions: { gap: spacing[2] },
});
