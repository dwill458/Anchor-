/**
 * ChargeRing — compact circular progress indicator for today's practice.
 *
 * Uses SVG strokeDashoffset (same pattern as ProgressHaloRing).
 * Sized for use inside TodayAnchorCard (default 44px).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ChargeRingProps {
  /** 0–1 float representing completion (today sessions / goal). */
  progress: number;
  size?: number;
  strokeWidth?: number;
}

export const ChargeRing: React.FC<ChargeRingProps> = ({
  progress,
  size = 44,
  strokeWidth = 3,
}) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withTiming(clampedProgress, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [clampedProgress, progressValue]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progressValue.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={`${colors.gold}30`}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc — starts from top (-90°) */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.gold}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
