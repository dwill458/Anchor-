import React, { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  AudioLines,
  Brush,
  CircleDotDashed,
  Cloud,
  Compass,
  Crown,
  Cuboid,
  DraftingCompass,
  Feather,
  Flame,
  Gem,
  Hexagon,
  Moon,
  Orbit,
  Palette,
  Repeat,
  ShieldCheck,
  Sliders,
  Sparkles,
  SunMedium,
  Target,
  Telescope,
  Waves,
  WandSparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import type { RefineStyleIconName, RefineStyleOption } from '../constants/refineStyles';

export type RefineStyleCardVariant = 'core' | 'featured' | 'recommended' | 'seasonal' | 'filtered';

interface RefineStyleCardProps {
  option: RefineStyleOption;
  index: number;
  isSelected: boolean;
  onSelect: (option: RefineStyleOption) => void;
  variant?: RefineStyleCardVariant;
  badgeLabel?: string;
  style?: StyleProp<ViewStyle>;
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
  AudioLines,
  Brush,
  CircleDotDashed,
  Cuboid,
  DraftingCompass,
  Feather,
  Gem,
  Hexagon,
  Moon,
  Orbit,
  SunMedium,
  Telescope,
  WandSparkles,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getPaletteColors = (paletteLane: string): [string, string, string] => {
  if (paletteLane.includes('aurora')) return ['rgba(112, 91, 178, 0.34)', 'rgba(108, 196, 204, 0.28)', 'rgba(212, 175, 55, 0.24)'];
  if (paletteLane.includes('ember') || paletteLane.includes('solar')) return ['rgba(212, 123, 55, 0.32)', 'rgba(212, 175, 55, 0.28)', 'rgba(93, 46, 33, 0.25)'];
  if (paletteLane.includes('moon') || paletteLane.includes('silver')) return ['rgba(192, 192, 192, 0.24)', 'rgba(142, 128, 184, 0.22)', 'rgba(245, 245, 220, 0.15)'];
  if (paletteLane.includes('obsidian') || paletteLane.includes('charcoal')) return ['rgba(255, 255, 255, 0.08)', 'rgba(20, 24, 31, 0.86)', 'rgba(192, 192, 192, 0.18)'];
  if (paletteLane.includes('violet') || paletteLane.includes('purple') || paletteLane.includes('night')) return ['rgba(92, 62, 137, 0.34)', 'rgba(28, 17, 47, 0.72)', 'rgba(212, 175, 55, 0.18)'];
  if (paletteLane.includes('gold')) return ['rgba(212, 175, 55, 0.3)', 'rgba(70, 50, 20, 0.5)', 'rgba(245, 245, 220, 0.14)'];

  return ['rgba(245, 245, 220, 0.12)', 'rgba(62, 44, 91, 0.22)', 'rgba(212, 175, 55, 0.14)'];
};

export function RefineStyleCard({
  option,
  index,
  isSelected,
  onSelect,
  variant = 'core',
  badgeLabel,
  style,
}: RefineStyleCardProps) {
  const pressScale = useSharedValue(1);
  const mountProgress = useSharedValue(0);
  const selectionProgress = useSharedValue(isSelected ? 1 : 0);
  const Icon = ICONS[option.iconName];
  const isFeatured = variant === 'featured';
  const isSeasonal = variant === 'seasonal';
  const displayBadge = badgeLabel ?? option.badgeLabel;
  const paletteColors = getPaletteColors(option.paletteLane);

  useEffect(() => {
    mountProgress.value = withDelay(Math.min(index, 8) * 40, withTiming(1, { duration: 320 }));
  }, [index, mountProgress]);

  useEffect(() => {
    selectionProgress.value = withTiming(isSelected ? 1 : 0, { duration: 240 });
  }, [isSelected, selectionProgress]);

  const animatedCard = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      selectionProgress.value,
      [0, 1],
      [
        isSeasonal ? 'rgba(156, 134, 196, 0.24)' : 'rgba(245, 245, 220, 0.1)',
        'rgba(212, 175, 55, 0.96)',
      ]
    );

    return {
      borderColor,
      opacity: mountProgress.value,
      transform: [
        { translateY: interpolate(mountProgress.value, [0, 1], [10, 0]) },
        { scale: pressScale.value },
      ],
      shadowOpacity: interpolate(selectionProgress.value, [0, 1], [0.08, 0.32]),
      shadowRadius: interpolate(selectionProgress.value, [0, 1], [8, 20]),
      elevation: interpolate(selectionProgress.value, [0, 1], [1, 8]),
    };
  });

  const selectedLayerStyle = useAnimatedStyle(() => ({
    opacity: selectionProgress.value,
  }));

  return (
    <AnimatedPressable
      onPress={() => onSelect(option)}
      onPressIn={() => {
        pressScale.value = withTiming(0.98, { duration: 90 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { stiffness: 260, damping: 18 });
      }}
      style={[
        styles.card,
        isFeatured && styles.cardFeatured,
        isSeasonal && styles.cardSeasonal,
        variant === 'recommended' && styles.cardRecommended,
        style,
        animatedCard,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${option.displayName} style`}
      accessibilityHint={option.shortDescription}
      accessibilityState={{ selected: isSelected }}
    >
      <BlurView intensity={14} tint="dark" style={styles.blurLayer}>
        <LinearGradient
          colors={[paletteColors[0], paletteColors[1], 'rgba(8, 10, 18, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.paletteWash}
          pointerEvents="none"
        />
        <Animated.View style={[styles.selectedWash, selectedLayerStyle]} pointerEvents="none" />

        <View style={[styles.preview, isFeatured && styles.previewFeatured, isSeasonal && styles.previewSeasonal]}>
          <LinearGradient
            colors={paletteColors}
            start={{ x: 0, y: 0.15 }}
            end={{ x: 1, y: 0.85 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.previewAura} />
          <Icon
            size={isFeatured ? 30 : isSeasonal ? 28 : 24}
            color="rgba(245, 245, 220, 0.9)"
            strokeWidth={1.45}
          />
        </View>

        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isFeatured && styles.titleFeatured]} numberOfLines={2}>
              {option.displayName}
            </Text>
          </View>

          <Text style={styles.category} numberOfLines={1}>
            {option.category} / {option.family}
          </Text>

          <Text style={[styles.description, isFeatured && styles.descriptionFeatured]} numberOfLines={isFeatured ? 3 : 2}>
            {option.shortDescription}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          {displayBadge ? (
            <View style={[styles.badge, isSeasonal && styles.badgeSeasonal]}>
              <View style={styles.badgeDot} />
              <Text style={[styles.badgeText, isSeasonal && styles.badgeTextSeasonal]}>{displayBadge}</Text>
            </View>
          ) : (
            <Text style={styles.materialText} numberOfLines={1}>
              {option.compositionFamily}
            </Text>
          )}
        </View>
      </BlurView>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 176,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'rgba(16, 21, 28, 0.82)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
  },
  cardFeatured: {
    minHeight: 222,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 21, 50, 0.88)',
  },
  cardRecommended: {
    backgroundColor: 'rgba(24, 24, 31, 0.9)',
  },
  cardSeasonal: {
    minHeight: 190,
    backgroundColor: 'rgba(24, 16, 40, 0.78)',
  },
  blurLayer: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  paletteWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },
  selectedWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  preview: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    marginBottom: spacing.md,
    backgroundColor: 'rgba(245, 245, 220, 0.04)',
  },
  previewFeatured: {
    width: 72,
    height: 64,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  previewSeasonal: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderColor: 'rgba(203, 184, 232, 0.34)',
  },
  previewAura: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(245, 245, 220, 0.12)',
  },
  textBlock: {
    gap: spacing.xs,
  },
  titleRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text.primary,
  },
  titleFeatured: {
    fontSize: 20,
    lineHeight: 24,
  },
  category: {
    fontFamily: typography.fonts.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: 'rgba(245, 245, 220, 0.56)',
    textTransform: 'uppercase',
  },
  description: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    lineHeight: 17,
    color: colors.text.secondary,
  },
  descriptionFeatured: {
    fontSize: 14,
    lineHeight: 19,
  },
  badgeRow: {
    marginTop: 'auto',
    paddingTop: spacing.md,
    minHeight: 30,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.13)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeSeasonal: {
    borderColor: 'rgba(203, 184, 232, 0.4)',
    backgroundColor: 'rgba(156, 134, 196, 0.14)',
  },
  badgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  badgeText: {
    fontFamily: typography.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  badgeTextSeasonal: {
    color: '#CBB8E8',
  },
  materialText: {
    fontFamily: typography.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    color: 'rgba(245, 245, 220, 0.36)',
    textTransform: 'uppercase',
  },
});
