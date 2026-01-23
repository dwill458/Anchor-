/**
 * StyleSelectionScreen (FTUE Version)
 *
 * First-time user enhancement: Visual refinement step
 *
 * FTUE-focused design with 4 core styles only:
 * - Minimal Line (default, recommended)
 * - Ink Brush
 * - Sacred Geometry
 * - Watercolor
 *
 * This screen prioritizes completion over exploration.
 * Uses grounded language and pre-selects Minimal Line to reduce hesitation.
 *
 * Next: AIGeneratingScreen (enhancement with selected style)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, AIStyle } from '@/types';
import { colors, spacing, typography } from '@/theme';

type StyleSelectionRouteProp = RouteProp<RootStackParamList, 'StyleSelection'>;
type StyleSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'StyleSelection'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 64) / 2; // Two columns with padding

/**
 * Style metadata for each AI style option
 */
interface StyleOption {
  id: AIStyle;
  name: string;
  description: string;
  category: 'Organic' | 'Geometric' | 'Hybrid';
  gradient: [string, string];
  emoji: string;
}

/**
 * FTUE Style Options - Reduced to 4 core styles
 * Minimal Line is listed first and will be pre-selected
 */
const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'minimal_line',
    name: 'Minimal Line',
    description: 'Clean · precise · distraction-free',
    category: 'Geometric',
    gradient: ['#374151', '#4B5563'],
    emoji: '━',
  },
  {
    id: 'ink_brush',
    name: 'Ink Brush',
    description: 'Hand-drawn · fluid · expressive',
    category: 'Organic',
    gradient: ['#2C3E50', '#34495E'],
    emoji: '🖌️',
  },
  {
    id: 'sacred_geometry',
    name: 'Sacred Geometry',
    description: 'Structured · balanced · exact',
    category: 'Geometric',
    gradient: ['#D4AF37', '#FFD700'],
    emoji: '✨',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft · organic · atmospheric',
    category: 'Organic',
    gradient: ['#4A90E2', '#7B68EE'],
    emoji: '🎨',
  },
];

/**
 * StyleSelectionScreen Component
 */
export default function StyleSelectionScreen() {
  const route = useRoute<StyleSelectionRouteProp>();
  const navigation = useNavigation<StyleSelectionNavigationProp>();

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  } = route.params;

  // Pre-select Minimal Line for FTUE (first style in array)
  const [selectedStyle, setSelectedStyle] = useState<AIStyle | null>('minimal_line');

  /**
   * Handle style selection and navigate to AI generating screen
   */
  const handleContinue = () => {
    if (!selectedStyle) return;

    navigation.navigate('AIGenerating', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      styleChoice: selectedStyle,
      reinforcementMetadata,
    });
  };

  /**
   * Render individual style card
   */
  const renderStyleCard = (style: StyleOption, index: number) => {
    const isSelected = selectedStyle === style.id;
    const isRecommended = style.id === 'minimal_line';

    return (
      <TouchableOpacity
        key={style.id}
        style={[
          styles.card,
          isSelected && styles.cardSelected,
        ]}
        onPress={() => setSelectedStyle(style.id)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={style.gradient}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Emoji Icon */}
          <Text style={styles.emoji}>{style.emoji}</Text>

          {/* Style Name */}
          <Text style={styles.styleName}>{style.name}</Text>

          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{style.category}</Text>
          </View>
        </LinearGradient>

        {/* Description */}
        <View style={styles.cardContent}>
          <Text style={styles.description} numberOfLines={3}>
            {style.description}
          </Text>

          {/* Recommended Badge for Minimal Line */}
          {isRecommended && (
            <Text style={styles.recommendedBadge}>
              Recommended for your first Anchor
            </Text>
          )}
        </View>

        {/* Selection Indicator */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Refine the expression</Text>
          <Text style={styles.subtitle}>
            This step refines how your Anchor appears — without changing its structure.
          </Text>
          <Text style={styles.subtitleSecondary}>
            The foundation is already set.
          </Text>
        </View>

        {/* Lock Reassurance */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>🔒</Text>
          <Text style={styles.infoText}>
            Structure protected. Visual refinement only.
          </Text>
        </View>

        {/* Style Grid */}
        <View style={styles.gridContainer}>
          {STYLE_OPTIONS.map((style, index) => renderStyleCard(style, index))}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedStyle && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedStyle}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            Apply enhancement
          </Text>
        </TouchableOpacity>

        {/* Bottom Padding */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Styles
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.charcoal,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.heading.fontFamily,
    fontSize: 28,
    fontWeight: '500',
    color: '#E8E8E8',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitleSecondary: {
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    color: '#626262',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold + '20',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    fontWeight: '500',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
    marginBottom: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  cardGradient: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  emoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  styleName: {
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 8,
  },
  categoryText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    color: colors.text.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: spacing.md,
    minHeight: 70,
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
    textAlign: 'center',
  },
  recommendedBadge: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    color: colors.gold,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.gold,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: colors.background.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  continueButtonDisabled: {
    backgroundColor: colors.text.disabled,
    opacity: 0.5,
  },
  continueButtonText: {
    fontFamily: typography.heading.fontFamily,
    fontSize: 16,
    color: colors.background.primary,
    fontWeight: '600',
  },
});
