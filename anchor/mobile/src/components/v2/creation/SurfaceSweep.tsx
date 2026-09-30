import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/v2';
import { creationTiming } from './creationMotion';

/** A clipped reflection travels across the material once; there is no outer ring. */
export function SurfaceSweep({ size, play, reduceMotion, duration = 900 }: {
  size: number; play: boolean; reduceMotion: boolean; duration?: number;
}) {
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (!play || reduceMotion) return;
    sweep.value = 0;
    sweep.value = creationTiming(1, { duration });
  }, [duration, play, reduceMotion, sweep]);
  const style = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 0.32 : 0,
    transform: [{ translateX: -size * 0.6 + sweep.value * size * 1.9 }, { rotate: '-18deg' }],
  }));
  if (reduceMotion) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]}>
    <Animated.View style={[{ width: size * 0.32, height: size * 1.5, top: -size * 0.25 }, style]}>
      <LinearGradient colors={[`${colors.paper}00`, colors.paper, `${colors.paper}00`]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  </View>;
}
