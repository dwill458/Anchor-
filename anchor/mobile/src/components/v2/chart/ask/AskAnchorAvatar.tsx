import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import type { ChartAnchorArt } from '../ChartLandscape';
import type { AskAccent } from './askChartTheme';

type Props = {
  art: ChartAnchorArt | null;
  category: string | null | undefined;
  accent: AskAccent;
  size?: number;
  testID?: string;
};

/**
 * The person's own Anchor, rendered from their stored structure (never a stock icon). With no Anchor art yet it
 * falls back to a quiet category-coloured disc so layout never shifts.
 */
export const AskAnchorAvatar = memo(function AskAnchorAvatar({ art, category, accent, size = 34, testID }: Props) {
  if (!art?.svg) {
    return <View testID={testID} style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: accent.wash, borderColor: accent.border }]} />;
  }
  return (
    <CircularAnchorRenderer
      testID={testID}
      svg={art.svg}
      imageUrl={art.imageUrl}
      category={art.category ?? category}
      expression={art.expression ?? undefined}
      size={size}
      appearance="tinted"
      accessibilityLabel="Your Anchor"
    />
  );
});

/**
 * The avatar while Ask Chart is working: a slow, low-contrast breathing halo behind it. One opacity/scale pair on the
 * UI thread, no blur, no shadow, no rings. Under reduced motion the halo simply rests.
 */
export const AskThinkingAvatar = memo(function AskThinkingAvatar({ art, category, accent, size = 34, reducedMotion, testID }: Props & { reducedMotion: boolean }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      breath.value = 0.5;
      return undefined;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }), -1, true);
    return () => cancelAnimation(breath);
  }, [breath, reducedMotion]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.1 + breath.value * 0.2, transform: [{ scale: 0.94 + breath.value * 0.16 }] }));
  const haloSize = size * 1.5;
  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Ask Chart is thinking" accessibilityRole="progressbar">
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: haloSize, height: haloSize, borderRadius: haloSize / 2, backgroundColor: accent.fill }, halo]}
      />
      <AskAnchorAvatar art={art} category={category} accent={accent} size={size} />
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
