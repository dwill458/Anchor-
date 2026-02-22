import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ChevronDown } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Anchor } from '@/types';
import { OptimizedImage } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

interface AnchorHeroProps {
  anchor?: Anchor;
  onPress: () => void;
  animationsEnabled?: boolean;
}

const HERO_SIZE = 172;

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
}) => {
  const reduceMotionEnabled = useReduceMotionEnabled();
  const breath = useSharedValue(0);
  const sigil = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg;

  useEffect(() => {
    if (!animationsEnabled || reduceMotionEnabled || !anchor?.isCharged) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }

    breath.value = withRepeat(
      withTiming(1, {
        duration: 5000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(breath);
    };
  }, [anchor?.isCharged, animationsEnabled, breath, reduceMotionEnabled]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: anchor?.isCharged ? 0.2 + breath.value * 0.2 : 0.05,
    transform: [{ scale: 1 + breath.value * 0.04 }],
  }));

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={anchor ? `Selected anchor: ${getName(anchor)}` : 'Select an anchor'}
        style={({ pressed }) => [styles.heroPressable, pressed && styles.pressed]}
      >
        <Animated.View style={[styles.halo, haloStyle]} />
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
        {anchor?.isCharged ? (
          <View style={styles.chargedStamp}>
            <Text style={styles.chargedText}>Charged</Text>
          </View>
        ) : null}
      </Pressable>

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
  halo: {
    position: 'absolute',
    width: HERO_SIZE + 34,
    height: HERO_SIZE + 34,
    borderRadius: (HERO_SIZE + 34) / 2,
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  ring: {
    position: 'absolute',
    width: HERO_SIZE + 12,
    height: HERO_SIZE + 12,
    borderRadius: (HERO_SIZE + 12) / 2,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(62,44,91,0.18)',
  },
  heroCircle: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(12,16,24,0.82)',
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
  chargedStamp: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.34)',
    backgroundColor: 'rgba(11,14,20,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chargedText: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 0.2,
  },
  switcherPill: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
