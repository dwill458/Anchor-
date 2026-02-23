import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ChevronDown, Flame } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Anchor } from '@/types';
import { ChargedGlowCanvas, OptimizedImage } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

interface AnchorHeroProps {
  anchor?: Anchor;
  onPress: () => void;
  animationsEnabled?: boolean;
  streakDays: number;
}

const HERO_SIZE = 172;
const GLOW_CANVAS_SIZE = 218;

function getName(anchor?: Anchor): string {
  if (!anchor) return 'Select an anchor';
  const value = anchor.intentionText.trim();
  if (!value) return 'Select an anchor';
  return value.length > 42 ? `${value.slice(0, 41)}...` : value;
}

export const AnchorHero: React.FC<AnchorHeroProps> = ({
  anchor,
  onPress,
  animationsEnabled = true,
  streakDays,
}) => {
  const reduceMotionEnabled = useReduceMotionEnabled();
  const glowAnim = useSharedValue(0);
  const dotOpacityAnim = useSharedValue(1);
  const sigil = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg;
  const resolvedStreakDays = Math.max(streakDays, 0);
  const streakDayLabel = resolvedStreakDays === 1 ? 'day' : 'days';

  useEffect(() => {
    if (!animationsEnabled || reduceMotionEnabled) {
      cancelAnimation(glowAnim);
      cancelAnimation(dotOpacityAnim);
      glowAnim.value = 0;
      dotOpacityAnim.value = 1;
      return;
    }

    glowAnim.value = withRepeat(
      withTiming(1, {
        duration: 2000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    dotOpacityAnim.value = withRepeat(
      withTiming(0.4, {
        duration: 1000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(glowAnim);
      cancelAnimation(dotOpacityAnim);
    };
  }, [animationsEnabled, dotOpacityAnim, glowAnim, reduceMotionEnabled]);

  const glowScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [1, 1.12]) }],
  }));

  const chargedDotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacityAnim.value,
  }));

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={anchor ? `Selected anchor: ${getName(anchor)}` : 'Select an anchor'}
        style={({ pressed }) => [styles.heroPressable, pressed && styles.pressed]}
      >
        <Animated.View style={[styles.sigilGlowWrap, glowScaleStyle]}>
          {anchor?.isCharged && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: GLOW_CANVAS_SIZE,
                height: GLOW_CANVAS_SIZE,
                top: -((GLOW_CANVAS_SIZE - (HERO_SIZE + 22)) / 2),
                left: -((GLOW_CANVAS_SIZE - (HERO_SIZE + 22)) / 2),
              }}
            >
              <ChargedGlowCanvas size={GLOW_CANVAS_SIZE} reduceMotionEnabled={reduceMotionEnabled} />
            </View>
          )}
          <View style={styles.sigilAmbient} />
          <View style={styles.ring} />
          <View style={styles.heroCircle}>
            {anchor?.enhancedImageUrl ? (
              <OptimizedImage uri={anchor.enhancedImageUrl} style={styles.image} resizeMode="cover" />
            ) : sigil ? (
              <SvgXml xml={sigil} width={HERO_SIZE * 0.86} height={HERO_SIZE * 0.86} />
            ) : (
              <Text style={styles.emptySymbol}>◈</Text>
            )}
          </View>
        </Animated.View>
      </Pressable>

      {anchor?.isCharged ? (
        <View style={styles.chargedIndicator}>
          <Animated.View style={[styles.chargedDot, chargedDotStyle]} />
          <Text style={styles.chargedLabel}>CHARGED</Text>
        </View>
      ) : null}

      <View style={styles.streakBadge}>
        <Flame size={14} color={colors.gold} />
        <Text style={styles.streakBadgeText}>
          <Text style={styles.streakBadgeCount}>{`${resolvedStreakDays} ${streakDayLabel}`}</Text>
          {' streak - keep it alive'}
        </Text>
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.switcherPill, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Change current anchor"
      >
        <Text style={styles.switcherLabel}>Current anchor</Text>
        <View style={styles.switcherValueWrap}>
          <Text style={styles.switcherValue} numberOfLines={1}>
            {getName(anchor)}
          </Text>
          <ChevronDown size={14} color={colors.text.secondary} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  heroPressable: {
    width: HERO_SIZE + 22,
    height: HERO_SIZE + 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  sigilGlowWrap: {
    width: HERO_SIZE + 22,
    height: HERO_SIZE + 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilAmbient: {
    position: 'absolute',
    width: HERO_SIZE + 72,
    height: HERO_SIZE + 72,
    borderRadius: (HERO_SIZE + 72) / 2,
    backgroundColor: colors.practice.heroGlowSoft,
    opacity: 0.9,
  },
  ring: {
    position: 'absolute',
    width: HERO_SIZE + 12,
    height: HERO_SIZE + 12,
    borderRadius: (HERO_SIZE + 12) / 2,
    borderWidth: 1,
    borderColor: colors.practice.heroRingBorder,
    backgroundColor: colors.practice.heroRingSurface,
  },
  heroCircle: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.practice.heroCircleBorder,
    backgroundColor: colors.practice.heroCircleSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
  },
  emptySymbol: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 44,
    color: colors.gold,
    opacity: 0.7,
  },
  chargedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md - 4,
  },
  chargedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  chargedLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.gold,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  streakBadgeText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: colors.practice.heroStreakBadgeText,
    fontStyle: 'italic',
  },
  streakBadgeCount: {
    color: colors.gold,
    fontFamily: typography.fontFamily.sansBold,
    fontStyle: 'normal',
  },
  switcherPill: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.practice.heroSwitcherSurface,
    borderWidth: 1,
    borderColor: colors.practice.heroSwitcherBorder,
    alignItems: 'center',
  },
  switcherLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  switcherValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  switcherValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 14,
    color: colors.text.primary,
    maxWidth: 200,
  },
});
