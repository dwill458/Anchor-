import React, { useCallback } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard } from '@/components/common';
import { colors, spacing, typography } from '@/theme';

type PortalVariant = 'charge' | 'stabilize' | 'burn';

interface ModePortalTileProps {
  variant: PortalVariant;
  title: string;
  meaning: string;
  durationHint: string;
  icon: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const VARIANT_STYLES: Record<
  PortalVariant,
  {
    borderColor: string;
    backgroundColor: string;
    glowColor: string;
    titleColor: string;
    radiusStyle: ViewStyle;
  }
> = {
  charge: {
    borderColor: 'rgba(212,175,55,0.36)',
    backgroundColor: 'rgba(26,21,35,0.48)',
    glowColor: 'rgba(212,175,55,0.22)',
    titleColor: '#E7D9AF',
    radiusStyle: { borderRadius: 24, borderTopRightRadius: 38, borderBottomLeftRadius: 30 },
  },
  stabilize: {
    borderColor: 'rgba(188,177,208,0.28)',
    backgroundColor: 'rgba(22,24,35,0.5)',
    glowColor: 'rgba(188,177,208,0.16)',
    titleColor: '#D8DCEB',
    radiusStyle: { borderRadius: 30, borderTopLeftRadius: 38, borderBottomRightRadius: 34 },
  },
  burn: {
    borderColor: 'rgba(162,134,78,0.34)',
    backgroundColor: 'rgba(21,17,23,0.62)',
    glowColor: 'rgba(180,112,62,0.18)',
    titleColor: '#D7C5A3',
    radiusStyle: { borderRadius: 22, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderBottomLeftRadius: 16 },
  },
};

export const ModePortalTile: React.FC<ModePortalTileProps> = ({
  variant,
  title,
  meaning,
  durationHint,
  icon,
  style,
  onPress,
}) => {
  const pressed = useSharedValue(0);
  const tokens = VARIANT_STYLES[variant];

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, {
      duration: 120,
      easing: Easing.out(Easing.cubic),
    });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [pressed]);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.015 }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pressed.value * 0.32,
  }));

  const startStyle = useAnimatedStyle(() => ({
    opacity: 0.44 + pressed.value * 0.56,
    transform: [{ translateX: pressed.value * 2 }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      style={[styles.pressable, style, animatedCard]}
    >
      <GlassCard
        style={[
          styles.card,
          tokens.radiusStyle,
          { borderColor: tokens.borderColor, backgroundColor: tokens.backgroundColor },
        ]}
        contentStyle={styles.content}
        borderColor={tokens.borderColor}
        backgroundColor={tokens.backgroundColor}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.pulseOverlay, { backgroundColor: tokens.glowColor }, pulseStyle]}
        />
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { borderColor: tokens.borderColor }]}>{icon}</View>
          <Animated.Text style={[styles.start, startStyle]}>Start ›</Animated.Text>
        </View>
        <Text style={[styles.title, { color: tokens.titleColor }]}>{title}</Text>
        <Text style={styles.meaning}>{meaning}</Text>
        <Text style={styles.duration}>{durationHint}</Text>
      </GlassCard>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 28,
  },
  card: {
    minHeight: 126,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pulseOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  start: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  meaning: {
    marginTop: 2,
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
  },
  duration: {
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    lineHeight: 14,
    color: colors.text.tertiary,
  },
});
