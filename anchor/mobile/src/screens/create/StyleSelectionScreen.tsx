/**
 * StyleSelectionScreen - Refine Expression
 *
 * A ritual refinement moment.
 * This is choosing how a symbol will speak, not configuring settings.
 *
 * Design: 2×2 centered grid, minimal cards, ceremonial selection.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { RootStackParamList, AIStyle } from '@/types';
import { colors, spacing, typography } from '@/theme';
import {
  MinimalLineIcon,
  InkBrushIcon,
  SacredGeometryIcon,
  WatercolorIcon,
} from '@/components/icons/StyleIcons';
import { LockIcon } from '@/components/icons/LockIcon';

type StyleSelectionRouteProp = RouteProp<RootStackParamList, 'StyleSelection'>;
type StyleSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'StyleSelection'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Card size for 2×2 grid with spacing
const GAP = 16;
const GRID_PADDING = 24;
const CARD_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - GAP) / 2;

interface StyleOption {
  id: AIStyle;
  name: string;
  category: 'Geometric' | 'Organic';
  isSuggested?: boolean;
}

const STYLES: StyleOption[] = [
  { id: 'minimal_line', name: 'Minimal Line', category: 'Geometric', isSuggested: true },
  { id: 'ink_brush', name: 'Ink Brush', category: 'Organic' },
  { id: 'sacred_geometry', name: 'Sacred Geometry', category: 'Geometric' },
  { id: 'watercolor', name: 'Watercolor', category: 'Organic' },
];

export default function StyleSelectionScreen() {
  const route = useRoute<StyleSelectionRouteProp>();
  const navigation = useNavigation<StyleSelectionNavigationProp>();
  const insets = useSafeAreaInsets();

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  } = route.params;

  const [selected, setSelected] = useState<AIStyle | null>('minimal_line');

  // Scale animations for each card
  const scaleAnims = useRef<Record<string, Animated.Value>>(
    STYLES.reduce((acc, s) => {
      acc[s.id] = new Animated.Value(1);
      return acc;
    }, {} as Record<string, Animated.Value>)
  ).current;

  // Ambient background response (4-8% opacity, barely noticeable)
  const ambientOpacity = useRef(new Animated.Value(0)).current;

  // Whisper text fade (150-200ms)
  const whisperOpacity = useRef(new Animated.Value(0)).current;

  /**
   * Style whisper copy - meaning feedback
   */
  const WHISPERS: Partial<Record<AIStyle, string>> = {
    minimal_line: 'Clarity through restraint.',
    ink_brush: 'Motion carries intent.',
    sacred_geometry: 'Order reveals meaning.',
    watercolor: 'Emotion softens form.',
  };

  /**
   * Ambient background variations (subtle environmental shift)
   * Opacity: 4-8% max, transition: 300-500ms
   */
  const getAmbientStyle = (styleId: AIStyle | null): any => {
    if (!styleId) return {};

    switch (styleId) {
      case 'minimal_line':
        // Slight increase in contrast, sharp vignette
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.05)', // 5% darker for focus
        };
      case 'ink_brush':
        // Soft organic noise/blur diffusion
        return {
          backgroundColor: 'rgba(45, 55, 72, 0.06)', // 6% warm organic tint
        };
      case 'sacred_geometry':
        // Faint geometric halo
        return {
          backgroundColor: 'rgba(212, 175, 55, 0.04)', // 4% gold radial glow
        };
      case 'watercolor':
        // Gentle color bloom
        return {
          backgroundColor: 'rgba(74, 144, 226, 0.05)', // 5% soft blue bloom
        };
      default:
        return {};
    }
  };

  const getIcon = (id: string) => {
    const props = { size: 48 };
    switch (id) {
      case 'minimal_line': return <MinimalLineIcon {...props} />;
      case 'ink_brush': return <InkBrushIcon {...props} />;
      case 'sacred_geometry': return <SacredGeometryIcon {...props} />;
      case 'watercolor': return <WatercolorIcon {...props} />;
      default: return <MinimalLineIcon {...props} />;
    }
  };

  const handleSelect = (id: AIStyle) => {
    if (selected === id) return;

    Haptics.selectionAsync();

    // Selection breath animation: 1 → 1.02 → 1
    Animated.sequence([
      Animated.timing(scaleAnims[id], {
        toValue: 1.02,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[id], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out whisper and ambient
    Animated.parallel([
      Animated.timing(whisperOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(ambientOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Update selection
      setSelected(id);

      // Fade in new whisper and ambient (inevitable, not decorative)
      Animated.parallel([
        Animated.timing(whisperOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(ambientOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleContinue = () => {
    if (!selected) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    navigation.navigate('AIGenerating', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
      styleChoice: selected, // Fixed: use styleChoice not selectedStyle
    });
  };

  const hasSuggested = STYLES.some(s => s.isSuggested);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Refine Expression</Text>
        <Text style={styles.subtitle}>
          Adjust the finish. The structure remains unchanged.
        </Text>
      </View>

      {/* Lock indicator - thin divider */}
      <View style={styles.lockDivider}>
        <LockIcon size={16} color="#D4AF37" />
        <Text style={styles.lockText}>
          Structure locked · Visual refinement only
        </Text>
      </View>

      {/* 2×2 Grid - Centered vertically */}
      <View style={styles.gridContainer}>
        {/* Ambient background response - subtle environmental shift */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            getAmbientStyle(selected),
            { opacity: ambientOpacity },
          ]}
          pointerEvents="none"
        />

        <View style={styles.grid}>
          {STYLES.map((style) => {
            const isSelected = selected === style.id;
            const isSuggested = style.isSuggested;

            return (
              <Animated.View
                key={style.id}
                style={[
                  styles.cardWrapper,
                  { transform: [{ scale: scaleAnims[style.id] }] },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                    isSuggested && !isSelected && styles.cardSuggested,
                  ]}
                  onPress={() => handleSelect(style.id)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`${style.name}, ${style.category}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <BlurView intensity={10} tint="dark" style={styles.cardContent}>
                    {/* Icon - centered */}
                    <View style={styles.iconContainer}>
                      {getIcon(style.id)}
                    </View>

                    {/* Name */}
                    <Text style={styles.styleName}>{style.name}</Text>

                    {/* Category tag */}
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryText}>
                        {style.category.toUpperCase()}
                      </Text>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Style whisper - meaning feedback (appears after selection) */}
        {selected && (
          <Animated.Text
            style={[
              styles.whisperText,
              { opacity: whisperOpacity },
            ]}
          >
            {WHISPERS[selected]}
          </Animated.Text>
        )}

        {/* Suggestion microcopy - BELOW whisper */}
        {hasSuggested && (
          <Text style={styles.suggestionText}>
            Suggested for first Anchor
          </Text>
        )}
      </View>

      {/* Bottom CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.helperText}>You can change this later</Text>

        <TouchableOpacity
          style={[styles.ctaButton, !selected && styles.ctaButtonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Refine Anchor"
          accessibilityState={{ disabled: !selected }}
        >
          <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>
            Refine Anchor
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.charcoal,
  },

  // Header - simplified
  header: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 80, // Space for transparent nav
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    fontWeight: '500',
    color: colors.bone,
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Lock divider - informational, not cautionary
  lockDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GRID_PADDING,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  lockText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
    letterSpacing: 0.3,
  },

  // Grid container - vertically centered
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: GRID_PADDING,
  },

  // 2×2 Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: GAP,
  },

  cardWrapper: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },

  // Card - minimal, ceremonial
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },

  // Suggested - whisper (brighter border, softer glow)
  cardSuggested: {
    borderColor: 'rgba(212, 175, 55, 0.3)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },

  // Selected - gold ring + glow
  cardSelected: {
    borderColor: 'rgba(212, 175, 55, 0.9)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },

  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },

  iconContainer: {
    marginBottom: spacing.md,
  },

  styleName: {
    fontFamily: typography.fonts.heading,
    fontSize: 15,
    color: colors.bone,
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  categoryTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  categoryText: {
    fontFamily: typography.fonts.body,
    fontSize: 9,
    color: colors.text.tertiary,
    fontWeight: '600',
    letterSpacing: 0.8,
  },

  // Whisper text - meaning feedback (centered below grid)
  whisperText: {
    fontFamily: typography.fonts.body,
    fontSize: 13, // Slightly smaller than body
    color: colors.text.secondary, // Silver/muted bone
    textAlign: 'center',
    marginTop: spacing.md,
    letterSpacing: 0.3,
  },

  // Suggestion text - BELOW whisper
  suggestionText: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: 'rgba(212, 175, 55, 0.6)',
    textAlign: 'center',
    marginTop: spacing.md,
    fontStyle: 'italic',
  },

  // Bottom CTA - seal
  ctaContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: spacing.lg,
  },

  helperText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    opacity: 0.7,
  },

  ctaButton: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.7)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  ctaButtonDisabled: {
    borderColor: 'rgba(212, 175, 55, 0.25)',
    opacity: 0.4,
  },

  ctaText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    fontWeight: '600',
    color: colors.bone,
    letterSpacing: 0.5,
  },

  ctaTextDisabled: {
    // Opacity handled by parent
  },
});
