import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

type SanctuaryCandleIndicatorProps = {
  isLit: boolean;
  streakDays: number;
};

export const SanctuaryCandleIndicator: React.FC<SanctuaryCandleIndicatorProps> = ({
  isLit,
  streakDays,
}) => {
  const reduceMotionEnabled = useReduceMotionEnabled();

  const lit = useSharedValue(isLit ? 1 : 0);
  const flicker = useSharedValue(0);

  useEffect(() => {
    lit.value = isLit ? 1 : 0;
  }, [isLit, lit]);

  useEffect(() => {
    cancelAnimation(flicker);
    flicker.value = 0;

    if (!isLit || reduceMotionEnabled) return;

    flicker.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    return () => cancelAnimation(flicker);
  }, [flicker, isLit, reduceMotionEnabled]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (streakDays >= 7 ? 1 : 0) * (0.32 + lit.value * 0.28),
    transform: [{ scale: 1 + flicker.value * 0.015 }],
  }), [streakDays]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + lit.value * (0.58 + flicker.value * 0.12),
    transform: [{ scale: 0.92 + lit.value * (0.22 + flicker.value * 0.06) }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + lit.value * 0.35,
  }));

  const Wrapper = Platform.OS === 'ios' ? BlurView : View;
  const wrapperProps = Platform.OS === 'ios'
    ? ({ intensity: 18, tint: 'dark' as const } as const)
    : {};

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={isLit ? 'Sanctuary candle lit' : 'Sanctuary candle unlit'}
      style={styles.container}
    >
      <Wrapper {...wrapperProps} style={styles.glass}>
        <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.0)', 'rgba(212, 175, 55, 0.22)', 'rgba(212, 175, 55, 0.0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.haloGradient}
          />
        </Animated.View>

        <View style={styles.candle}>
          <Animated.View style={[styles.flameWrap, flameStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(255, 236, 184, 0.9)', 'rgba(212, 175, 55, 0.85)', 'rgba(205, 127, 50, 0.65)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.flame}
            />
          </Animated.View>

          <Animated.View style={[styles.body, bodyStyle]} pointerEvents="none" />
          <View style={styles.base} pointerEvents="none" />
        </View>
      </Wrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'visible',
  },
  glass: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(212, 175, 55, 0.03)',
  },
  haloGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 31,
  },
  candle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameWrap: {
    width: 12,
    height: 16,
    marginBottom: 2,
  },
  flame: {
    flex: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    transform: [{ rotate: '6deg' }],
  },
  body: {
    width: 12,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.bone,
    opacity: 0.75,
  },
  base: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
});

