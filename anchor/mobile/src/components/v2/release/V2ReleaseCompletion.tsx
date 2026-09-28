import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2Button } from '@/components/v2';
import { colors, spacing } from '@/theme/v2';
import { RELEASE_COPY } from '@/constants/v2/release';
import { v2Haptics } from '@/hooks/v2';
import { releaseTypography } from './releaseTypography';

interface Props { intentionText: string; reduceMotion?: boolean; onPrimary: () => void; onSecondary?: () => void; testID?: string; }
/** Mounted only after the server has confirmed release and the empty interval has ended. */
export function V2ReleaseCompletion({ intentionText, reduceMotion = false, onPrimary, onSecondary, testID }: Props) {
  const insets = useSafeAreaInsets();
  const paper = useSharedValue(0);
  const words = useSharedValue(0);
  const actions = useSharedValue(0);
  const title = useRef<Text>(null);
  const notified = useRef(false);
  useEffect(() => {
    const duration = reduceMotion ? 120 : 420;
    paper.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    words.value = withDelay(reduceMotion ? 0 : 130, withTiming(1, { duration }));
    actions.value = withDelay(reduceMotion ? 0 : 260, withTiming(1, { duration }));
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
  return <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]} testID={testID ?? 'v2-release-completion'}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.paper, ground]} />
    <Animated.View style={[styles.body, body]}>
      <Text style={styles.kicker}>{RELEASE_COPY.completionKicker}</Text>
      <Text ref={title} style={styles.title} accessibilityRole="header">{RELEASE_COPY.completionTitle}</Text>
      <Text style={styles.detail}>{RELEASE_COPY.completionBody}</Text>
      <Text style={styles.intention}>“{intentionText}”</Text>
    </Animated.View>
    <Animated.View style={[styles.actions, ctas]}>
      <V2Button variant="primary" size="large" onPress={onPrimary} testID="v2-release-completion-primary">{RELEASE_COPY.completionPrimaryCta}</V2Button>
      {onSecondary && <V2Button variant="tertiary" size="large" onPress={onSecondary} testID="v2-release-completion-secondary">{RELEASE_COPY.completionSecondaryCta}</V2Button>}
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 24 },
  paper: { backgroundColor: colors.frame },
  body: { flex: 1, justifyContent: 'center', gap: spacing[3] },
  kicker: { ...releaseTypography.small, color: colors.text.secondary },
  title: { ...releaseTypography.title, color: colors.ink.base },
  detail: { ...releaseTypography.body, color: colors.text.secondary },
  intention: { ...releaseTypography.body, color: colors.ink.base, marginTop: spacing[2] },
  actions: { gap: spacing[2] },
});
