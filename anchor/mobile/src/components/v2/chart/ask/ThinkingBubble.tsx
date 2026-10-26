import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import { ASK_TOKENS, type AskAccent } from './askChartTheme';

function Dot({ index, accent, reducedMotion }: { index: number; accent: AskAccent; reducedMotion: boolean }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) lift.value = withDelay(index * 160, withRepeat(withSequence(
      withTiming(1, { duration: 550, reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: 550, reduceMotion: ReduceMotion.Never }),
    ), -1, false, undefined, ReduceMotion.Never), ReduceMotion.Never);
    else lift.value = 0;
    return () => cancelAnimation(lift);
  }, [index, lift, reducedMotion]);
  const motion = useAnimatedStyle(() => ({ opacity: reducedMotion ? 0.7 : 0.45 + 0.55 * lift.value, transform: [{ translateY: reducedMotion ? 0 : -5 * lift.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: accent.fill }, motion]} />;
}

export function ThinkingBubble({ accent, reducedMotion, opening, leaving = false }: { accent: AskAccent; reducedMotion: boolean; opening: boolean; leaving?: boolean }) {
  const [status, setStatus] = useState(reducedMotion ? 0 : -1);
  const copy = opening ? CHART_COPY.ask.openingStatus : CHART_COPY.ask.thinkingStatus;
  useEffect(() => {
    if (reducedMotion) { setStatus(0); return; }
    setStatus(-1);
    let cycle: ReturnType<typeof setInterval> | undefined;
    const timer = setTimeout(() => {
      setStatus(0);
      cycle = setInterval(() => setStatus(value => (value + 1) % copy.length), 1500);
    }, 1100);
    return () => { clearTimeout(timer); clearInterval(cycle); };
  }, [copy, reducedMotion]);
  const opacity = useSharedValue(1);
  useEffect(() => { opacity.value = reducedMotion ? 1 : withTiming(leaving ? 0 : 1, { duration: 120, reduceMotion: ReduceMotion.Never }); }, [leaving, opacity, reducedMotion]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.shell, { borderColor: accent.border }, fade]} testID="ask-thinking-bubble" accessible accessibilityLabel={CHART_COPY.ask.thinking}>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2].map(index => <Dot key={index} index={index} accent={accent} reducedMotion={reducedMotion} />)}
      </View>
      {status >= 0 ? <Animated.View key={status} entering={reducedMotion ? undefined : FadeIn.duration(180).reduceMotion(ReduceMotion.Never)} exiting={reducedMotion ? undefined : FadeOut.duration(180).reduceMotion(ReduceMotion.Never)} style={styles.status}><Text style={styles.text}>{copy[status]}</Text></Animated.View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 26, borderTopLeftRadius: 8, borderWidth: 1, backgroundColor: ASK_TOKENS.ivory, gap: spacing[3], ...ASK_TOKENS.shadow },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 18 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  status: { flexShrink: 1 },
  text: { ...typography.bodySM, color: colors.text.secondary },
});
