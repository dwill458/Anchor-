import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CHART_MAP_REDUCED_FADE } from './chartMotion';
import { CHART_MAP_TOKENS as T } from './map/chartMapTokens';
import { CHART_PANEL_COPY as COPY } from './map/chartRhythm';
import { categoryLabelOnPaper } from './panel/chartPanelColors';

type Props = {
  /** True from the moment the server confirms the reach until the flag moves on to the next waypoint. */
  visible: boolean;
  number: number;
  title: string;
  category: string | null | undefined;
  reducedMotion: boolean;
  testID?: string;
  bottom?: number;
};

const FADE_IN = 240;
const FADE_OUT = 260;

/**
 * The beat between "Yes, I've reached it" and the map moving on: the reached waypoint is named while its
 * stamp lands and the route draws. It rides the existing reach sequence (visible flips with the sequence's
 * own advance step), so the handoff to the map's next-waypoint animation is one continuous motion.
 */
export function ChartReachBeat({ visible, number, title, category, reducedMotion, testID, bottom = 36 }: Props) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: reducedMotion ? CHART_MAP_REDUCED_FADE : visible ? FADE_IN : FADE_OUT,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [visible, reducedMotion, opacity]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - opacity.value) * 8 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom }, style]} testID={testID ?? 'chart-reach-beat'}>
      {visible ? (
        <View style={styles.card} accessible accessibilityLiveRegion="polite" accessibilityLabel={`Waypoint ${number} reached: ${title}`}>
          <Text style={[styles.label, { color: categoryLabelOnPaper(category) }]}>{COPY.labels.reached}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, bottom: 36, alignItems: 'center' },
  card: {
    maxWidth: 340,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 32, 0.14)',
    backgroundColor: 'rgba(244, 241, 233, 0.94)',
    alignItems: 'center',
    gap: 2,
  },
  label: { fontFamily: T.sansStrong, fontSize: 11, letterSpacing: 1.8 },
  title: { fontFamily: T.serif, fontSize: 20, lineHeight: 24, color: T.ink, textAlign: 'center' },
});
