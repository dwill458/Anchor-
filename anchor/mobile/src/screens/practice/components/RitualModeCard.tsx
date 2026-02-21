import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@/components/common';
import { colors, spacing, typography } from '@/theme';

interface RitualModeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  meta?: string;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const RitualModeCard: React.FC<RitualModeCardProps> = ({
  icon,
  title,
  description,
  cta,
  meta,
  onPress,
}) => {
  const press = useSharedValue(0);
  const glow = useSharedValue(0);

  const onPressIn = useCallback(() => {
    press.value = withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) });
    glow.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [glow, press]);

  const onPressOut = useCallback(() => {
    press.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
    glow.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [glow, press]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.015 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
    transform: [{ scale: 1 + glow.value * 0.025 }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      style={[styles.pressable, pressStyle]}
    >
      <GlassCard style={styles.card} contentStyle={styles.content}>
        <Animated.View pointerEvents="none" style={[styles.glowPulse, glowStyle]} />
        <View style={styles.topRow}>
          <View style={styles.iconWrap}>{icon}</View>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.ctaWrap}>
          <Text style={styles.cta}>{cta}</Text>
        </View>
      </GlassCard>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 20,
  },
  card: {
    borderColor: 'rgba(212,175,55,0.26)',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  glowPulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.tertiary,
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    color: colors.text.primary,
    letterSpacing: 0.3,
  },
  description: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  ctaWrap: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.34)',
    backgroundColor: 'rgba(212,175,55,0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  cta: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: colors.gold,
    letterSpacing: 0.25,
  },
});
