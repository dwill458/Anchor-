import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { WAVEFORM_BARS } from '@/hooks/v2/chart/askChartDictation';

const MIN = 4;
const SPAN = 34;

type BarProps = {
  index: number;
  levels: SharedValue<number[]>;
  phase: SharedValue<number>;
  color: string;
  /** 'live' follows the microphone, 'idle' breathes gently (no level data), 'still' rests (reduced motion). */
  mode: 'live' | 'idle' | 'still';
};

const Bar = memo(function Bar({ index, levels, phase, color, mode }: BarProps) {
  const style = useAnimatedStyle(() => {
    const age = 0.3 + 0.7 * (index / (WAVEFORM_BARS - 1));
    if (mode === 'live') return { height: withTiming(MIN + (levels.value[index] ?? 0) * SPAN, { duration: 90, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }), opacity: age };
    if (mode === 'idle') return { height: MIN + 6 + 7 * Math.sin(phase.value * 2 * Math.PI + index * 0.55), opacity: age };
    return { height: MIN + 2, opacity: age };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
});

type Props = {
  levels: SharedValue<number[]>;
  color: string;
  reducedMotion: boolean;
  /** False once the device has shown it does not report input level: the bars then breathe instead of staying flat. */
  levelsSupported: boolean | null;
  testID?: string;
};

/**
 * The recording waveform: the last 28 microphone levels, newest on the right, each bar smoothed on the UI thread.
 * Where the device reports no level, it falls back to a calm idle motion rather than pretending to measure.
 */
export const AskWaveform = memo(function AskWaveform({ levels, color, reducedMotion, levelsSupported, testID }: Props) {
  const phase = useSharedValue(0);
  const mode: BarProps['mode'] = reducedMotion ? 'still' : levelsSupported === false ? 'idle' : 'live';
  useEffect(() => {
    if (mode !== 'idle') return undefined;
    phase.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear, reduceMotion: ReduceMotion.Never }), -1, false);
    return () => cancelAnimation(phase);
  }, [mode, phase]);
  return (
    <View style={styles.row} testID={testID ?? 'ask-waveform'} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: WAVEFORM_BARS }, (_, index) => (
        <Bar key={index} index={index} levels={levels} phase={phase} color={color} mode={mode} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: SPAN + MIN },
  bar: { width: 3, borderRadius: 2 },
});
