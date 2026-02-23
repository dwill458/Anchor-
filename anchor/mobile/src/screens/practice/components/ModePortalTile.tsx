import React, { useCallback } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
  const isFeatured = variant === 'charge';

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

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.44 + pressed.value * 0.56,
    transform: [{ scale: 1 + pressed.value * 0.2 }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      style={[styles.pressable, style, animatedCard]}
    >
      <View style={[styles.card, isFeatured ? styles.cardFeatured : styles.cardSecondary]}>
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, isFeatured ? styles.iconFeatured : styles.iconSecondary]}>{icon}</View>
          <Animated.View style={[styles.dot, dotStyle]} />
        </View>
        <Text style={isFeatured ? styles.titleFeatured : styles.titleSecondary}>{title}</Text>
        <Text style={isFeatured ? styles.meaningFeatured : styles.meaningSecondary}>{meaning}</Text>
        <Text style={isFeatured ? styles.durationFeatured : styles.durationSecondary}>{durationHint}</Text>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 18,
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardFeatured: {
    minHeight: 160,
    backgroundColor: colors.practice.cardFeaturedSurface,
    borderColor: colors.practice.cardFeaturedBorder,
    borderRadius: 18,
    padding: spacing.lg,
  },
  cardSecondary: {
    minHeight: 132,
    backgroundColor: colors.practice.cardSecondarySurface,
    borderColor: colors.practice.cardSecondaryBorder,
    borderRadius: 12,
    padding: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconFeatured: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.practice.cardIconSurface,
    borderColor: colors.practice.cardIconBorder,
  },
  iconSecondary: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.practice.cardIconSecondarySurface,
    borderColor: colors.practice.cardIconSecondaryBorder,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.practice.cardDotSurface,
    borderWidth: 1,
    borderColor: colors.practice.cardDotBorder,
  },
  titleFeatured: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 16,
    letterSpacing: 1.3,
    color: colors.gold,
    marginBottom: spacing.xs + 2,
  },
  titleSecondary: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.bone,
    opacity: 0.85,
    marginBottom: spacing.xs + 1,
  },
  meaningFeatured: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.silver,
    fontStyle: 'italic',
    marginBottom: spacing.sm + 2,
  },
  meaningSecondary: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.silver,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    opacity: 0.8,
  },
  durationFeatured: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.bronze,
    textTransform: 'uppercase',
  },
  durationSecondary: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.bronze,
    textTransform: 'uppercase',
  },
});
