import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme/v2';
import { PAYWALL_EASE_OUT, PAYWALL_TIMING } from './paywallMotion';
import { paywallType } from './paywallType';

export type TrialTimelineStop = { title: string; sub: string };

type Props = {
  W: number;
  stops: readonly [TrialTimelineStop, TrialTimelineStop, TrialTimelineStop];
  /** True while the timeline is on screen; each time it turns true the rail refills. */
  play: boolean;
  reduceMotion: boolean;
};

function Stop({ W, stop, lit }: { W: number; stop: TrialTimelineStop; lit: SharedValue<number> }) {
  const dot = W * 0.034;
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value, transform: [{ scale: 0.6 + 0.4 * lit.value }] }));
  return (
    <View style={styles.stop}>
      <View style={{ width: dot, height: dot }}>
        <View style={[StyleSheet.absoluteFill, styles.dotIdle, { borderRadius: dot / 2 }]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.dotLit, { borderRadius: dot / 2 }, litStyle]} />
      </View>
      <Text style={[paywallType.timelineTitle(W), { marginTop: W * 0.022 }]}>{stop.title}</Text>
      <Text style={paywallType.timelineSub(W)}>{stop.sub}</Text>
    </View>
  );
}

/** Today → Day 5 → Day 7. The rail fills left to right and each stop lights as it is reached. */
export function TrialTimeline({ W, stops, play, reduceMotion }: Props) {
  const fill = useSharedValue(reduceMotion ? 1 : 0);
  const lit = [useSharedValue(reduceMotion ? 1 : 0), useSharedValue(reduceMotion ? 1 : 0), useSharedValue(reduceMotion ? 1 : 0)];

  useEffect(() => {
    if (reduceMotion) {
      fill.value = 1;
      lit.forEach((v) => (v.value = 1));
      return;
    }
    // Leaving: hold the drawn state while the slot fades, so nothing snaps mid-fade.
    if (!play) return;
    cancelAnimation(fill);
    lit.forEach((v) => cancelAnimation(v));
    const { timelineDelayMs, timelineFillMs } = PAYWALL_TIMING;
    fill.value = 0;
    fill.value = withDelay(timelineDelayMs, withTiming(1, { duration: timelineFillMs, easing: PAYWALL_EASE_OUT }));
    lit.forEach((v, i) => {
      v.value = 0;
      v.value = withDelay(timelineDelayMs + (timelineFillMs / 2) * i, withTiming(1, { duration: 260, easing: PAYWALL_EASE_OUT }));
    });
    // `lit` is a fixed trio of shared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, play, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const dot = W * 0.034;

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={stops.map((s) => `${s.title}: ${s.sub}`).join('. ')}
      style={styles.wrap}
      testID="v2-paywall-trial-timeline"
    >
      <View style={[styles.rail, { top: dot / 2 - 0.75 }]}>
        <View style={[StyleSheet.absoluteFill, styles.railIdle]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.railFill, fillStyle]} />
      </View>
      {stops.map((stop, i) => (
        <Stop key={stop.title} W={W} stop={stop} lit={lit[i]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row' },
  stop: { flex: 1, alignItems: 'center' },
  rail: { position: 'absolute', left: '16.67%', right: '16.67%', height: 1.5 },
  railIdle: { backgroundColor: colors.paywall.hairline },
  railFill: { backgroundColor: colors.paywall.goldDeep, transformOrigin: 'left' },
  dotIdle: { backgroundColor: colors.paywall.hairlineStrong },
  dotLit: { backgroundColor: colors.paywall.gold },
});
