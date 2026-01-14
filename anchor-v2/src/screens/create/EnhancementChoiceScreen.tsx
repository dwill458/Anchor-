/**
 * Anchor App - Enhancement Choice Screen
 *
 * Step 4 in anchor creation flow (after SigilSelection).
 * User chooses: AI Enhancement, Keep Traditional, or Manual Forge (Pro).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';

type EnhancementChoiceRouteProp = RouteProp<RootStackParamList, 'EnhancementChoice'>;
type EnhancementChoiceNavigationProp = StackNavigationProp<RootStackParamList, 'EnhancementChoice'>;

/**
 * Enhancement options
 */
interface EnhancementOption {
  id: 'ai' | 'traditional' | 'manual';
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  isPro?: boolean;
  recommended?: boolean;
}

const ENHANCEMENT_OPTIONS: EnhancementOption[] = [
  {
    id: 'ai',
    title: 'Let AI Decide',
    subtitle: 'Intelligent Symbol Selection',
    description:
      'AI analyzes your intention and selects archetypal elements from ancient traditions (achievement seals, resonance glyphs, alignment patterns) to create 4 stunning variations.',
    badge: '✨',
    recommended: true,
  },
  {
    id: 'traditional',
    title: 'Keep Traditional',
    subtitle: 'Classic Anchor Design',
    description:
      'Use your traditional anchor exactly as generated. Pure geometric methodology without AI enhancement.',
    badge: '📜',
  },
  {
    id: 'manual',
    title: 'Manual Forge',
    subtitle: 'Draw Your Own (Pro)',
    description:
      'Unlock the Manual Forge to draw your anchor by hand using our creative canvas. Full creative control for advanced practitioners.',
    badge: '🎨',
    isPro: false, // Unlocked for testing
  },
];

/**
 * EnhancementChoiceScreen Component
 */
export const EnhancementChoiceScreen: React.FC = () => {
  const navigation = useNavigation<EnhancementChoiceNavigationProp>();
  const route = useRoute<EnhancementChoiceRouteProp>();

  const { intentionText, distilledLetters, sigilSvg, sigilVariant, category } = route.params;

  /**
   * Handle option selection
   */
  const handleSelect = (optionId: 'ai' | 'traditional' | 'manual'): void => {
    if (optionId === 'manual') {
      // Navigate to Manual Forge screen
      navigation.navigate('ManualForge', {
        intentionText,
        distilledLetters,
        sigilSvg,
        category,
      });
      return;
    }

    if (optionId === 'ai') {
      // Navigate to AI Analysis screen
      navigation.navigate('AIAnalysis', {
        intentionText,
        distilledLetters,
        sigilSvg,
        sigilVariant,
        category,
      });
    } else if (optionId === 'traditional') {
      // Skip AI enhancement, go directly to mantra creation
      navigation.navigate('MantraCreation', {
        intentionText,
        distilledLetters,
        sigilSvg,
        finalImageUrl: undefined, // Will use SVG
        category,
      });
    }
  };

  /**
   * Render individual option card
   */
  const renderOption = (option: EnhancementOption): React.JSX.Element => {
    const isLocked = option.isPro; // TODO: Check actual subscription status

    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.optionCard,
          option.recommended && styles.optionCardRecommended,
          isLocked && styles.optionCardLocked,
        ]}
        onPress={() => handleSelect(option.id)}
        activeOpacity={0.8}
        disabled={isLocked}
      >
        {/* Badge */}
        <View style={styles.optionBadge}>
          <Text style={styles.optionBadgeText}>{option.badge}</Text>
        </View>

        {/* Recommended tag */}
        {option.recommended && (
          <View style={styles.recommendedTag}>
            <Text style={styles.recommendedTagText}>RECOMMENDED</Text>
          </View>
        )}

        {/* Pro tag */}
        {option.isPro && (
          <View style={styles.proTag}>
            <Text style={styles.proTagText}>PRO</Text>
          </View>
        )}

        {/* Lock overlay */}
        {isLocked && (
          <View style={styles.lockOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>{option.title}</Text>
          <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>

        {/* Arrow */}
        <View style={styles.optionArrow}>
          <Text style={styles.optionArrowText}>→</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Enhance Your Anchor</Text>
          <Text style={styles.subtitle}>
            You've created the foundation. Now choose how to amplify your intention's power.
          </Text>
        </View>

        {/* Intention Display */}
        <View style={styles.intentionSection}>
          <Text style={styles.intentionLabel}>Your Intention</Text>
          <Text style={styles.intentionText}>"{intentionText}"</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsSection}>
          {ENHANCEMENT_OPTIONS.map(renderOption)}
        </View>

        {/* Footer Note */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ✨ AI enhancement uses ancient mystical symbols and modern generative art to create
            powerful, personalized anchors
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 110, // Account for floating tab bar
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body1,
  },
  intentionSection: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  intentionLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  intentionText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  optionsSection: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  optionCardRecommended: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}08`,
  },
  optionCardLocked: {
    opacity: 0.6,
  },
  optionBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  optionBadgeText: {
    fontSize: 32,
  },
  recommendedTag: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  recommendedTagText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
  },
  proTag: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.deepPurple,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  proTagText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `${colors.charcoal}80`,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  lockIcon: {
    fontSize: 48,
  },
  optionContent: {
    marginBottom: spacing.md,
  },
  optionTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  optionSubtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  optionDescription: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
  optionArrow: {
    alignSelf: 'flex-end',
  },
  optionArrowText: {
    fontSize: 32,
    color: colors.gold,
  },
  footer: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.deepPurple,
  },
  footerText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
});
