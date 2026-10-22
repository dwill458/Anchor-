import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2';

/** Pending work is indeterminate; only a completed save fills the entire line. */
export function VisionHairline({ pending, label, testID }: { pending: boolean; label: string; testID?: string }) {
  const reduced = useV2ReduceMotion(), progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = pending ? (reduced ? .5 : withRepeat(withTiming(1, { duration: 1400 }), -1, true)) : withTiming(1, { duration: 220 });
  }, [pending, reduced]);
  const style = useAnimatedStyle(() => ({ width: pending ? '25%' : '100%', transform: [{ translateX: pending ? progress.value * 112 : 0 }] }));
  return <View testID={testID} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: pending }} style={styles.track}>
    <Animated.View style={[styles.line, style]} />
  </View>;
}
const styles = StyleSheet.create({ track: { width: 150, height: 1, overflow: 'hidden', backgroundColor: '#B08A4A35' }, line: { height: 1, backgroundColor: '#B08A4A' } });
