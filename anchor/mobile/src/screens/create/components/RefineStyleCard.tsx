import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  withDelay,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Cloud,
  Compass,
  Crown,
  Flame,
  Lock,
  Palette,
  Repeat,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Waves,
  Zap,
  Check,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import type { RefineStyleIconName, RefineStyleOption } from '../constants/refineStyles';

interface RefineStyleCardProps {
  option: RefineStyleOption;
  index: number;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: (option: RefineStyleOption) => void;
  onLockedPress: (option: RefineStyleOption) => void;
}

const ICONS: Record<RefineStyleIconName, LucideIcon> = {
  Target,
  Zap,
  Compass,
  Waves,
  Crown,
  Sparkles,
  Sliders,
  Cloud,
  Flame,
  Repeat,
  ShieldCheck,
  Palette,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function RefineStyleCard({
  option,
  index,
  isSelected,
  isLocked,
  onSelect,
  onLockedPress,
}: RefineStyleCardProps) {
  const pressScale = useSharedValue(1);
  const mountProgress = useSharedValue(0);
  const selectionProgress = useSharedValue(isSelected ? 1 : 0);
  const lockProgress = useSharedValue(isLocked ? 1 : 0);
  const shakeX = useSharedValue(0);
  const Icon = ICONS[option.iconName];

  useEffect(() => {
    mountProgress.value = withDelay(index * 45, withTiming(1, { duration: 360 }));
  }, [index, mountProgress]);

  useEffect(() => {
    selectionProgress.value = withTiming(isSelected ? 1 : 0, { duration: 260 });
  }, [isSelected, selectionProgress]);

  useEffect(() => {
    lockProgress.value = withTiming(isLocked ? 1 : 0, { duration: 180 });
  }, [isLocked, lockProgress]);

  const animatedCard = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      selectionProgress.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.14)', 'rgba(212, 175, 55, 0.95)']
    );

    return {
      borderColor,
      transform: [
        { translateY: interpolate(mountProgress.value, [0, 1], [10, 0]) },
        { translateX: shakeX.value },
        { scale: pressScale.value },
        { scale: interpolate(selectionProgress.value, [0, 1], [1, 1.015]) },
      ],
      opacity: mountProgress.value,
      shadowOpacity: interpolate(selectionProgress.value, [0, 1], [0.06, 0.35]),
      shadowRadius: interpolate(selectionProgress.value, [0, 1], [5, 14]),
      elevation: interpolate(selectionProgress.value, [0, 1], [1, 8]),
    };
  });

  const selectedIconTint = useAnimatedStyle(() => ({
    opacity: selectionProgress.value,
  }));

  const lockOverlayStyle = useAnimatedStyle(() => ({ opacity: lockProgress.value }));
  const checkBadgeStyle = useAnimatedStyle(() => ({ opacity: selectionProgress.value }));

  function handlePress() {
    if (isLocked) {
      shakeX.value = withSequence(
        withTiming(-5, { duration: 50 }),
        withTiming(5, { duration: 50 }),
        withTiming(-4, { duration: 45 }),
        withTiming(4, { duration: 45 }),
        withTiming(0, { duration: 55 })
      );
      onLockedPress(option);
      return;
    }

    onSelect(option);
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        pressScale.value = withTiming(0.98, { duration: 90 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { stiffness: 260, damping: 18 });
      }}
      style={[styles.card, animatedCard]}
      accessibilityRole="button"
      accessibilityLabel={`${option.title} style`}
      accessibilityHint={isLocked ? 'Locked. Double tap to open upgrade options.' : option.shortDescription}
      accessibilityState={{ selected: isSelected, disabled: isLocked }}
    >
      <BlurView intensity={12} tint="dark" style={styles.blurLayer}>
        <View style={styles.iconWrap}>
          <Icon size={30} color="rgba(245, 245, 220, 0.75)" />
          <Animated.View style={[styles.selectedIconLayer, selectedIconTint]} pointerEvents="none">
            <Icon size={30} color={colors.gold} />
          </Animated.View>
        </View>

        <Text style={styles.title}>{option.title}</Text>
        <Text style={styles.category}>{option.category}</Text>
        {!!option.shortDescription && (
          <Text style={styles.description} numberOfLines={2}>
            {option.shortDescription}
          </Text>
        )}

        {option.recommendedForFirstAnchor && (
          <View style={styles.recommendedChip}>
            <Text style={styles.recommendedText}>RECOMMENDED</Text>
          </View>
        )}

        {isSelected && (
          <Animated.View style={[styles.checkBadge, checkBadgeStyle]}>
            <Check size={14} color={colors.charcoal} strokeWidth={3} />
          </Animated.View>
        )}

        {isLocked && (
          <Animated.View style={[styles.lockOverlay, lockOverlayStyle]}>
            <View style={styles.lockBadge}>
              <Lock size={14} color={colors.gold} />
              <Text style={styles.lockText}>PRO</Text>
            </View>
          </Animated.View>
        )}
      </BlurView>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 188,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.2,
    backgroundColor: colors.ritual.glass,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
  },
  blurLayer: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 245, 220, 0.04)',
    marginBottom: spacing.sm,
  },
  selectedIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  category: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    letterSpacing: 1.15,
    color: 'rgba(245, 245, 220, 0.72)',
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  recommendedChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.48)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 'auto',
  },
  recommendedText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 9,
    color: colors.gold,
    letterSpacing: 0.8,
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 12, 18, 0.45)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: spacing.sm,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(15, 20, 25, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.55)',
    gap: 4,
  },
  lockText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 0.7,
  },
});
