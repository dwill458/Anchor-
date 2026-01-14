/**
 * Anchor App - Post-Forge Choice Screen
 *
 * After manual sigil creation, user chooses whether to:
 * 1. Keep the manual sigil as-is
 * 2. Enhance it with AI
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';

type PostForgeChoiceRouteProp = RouteProp<RootStackParamList, 'PostForgeChoice'>;
type PostForgeChoiceNavigationProp = StackNavigationProp<RootStackParamList, 'PostForgeChoice'>;

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.6;

interface ChoiceOption {
  id: 'keep' | 'ai';
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  recommended?: boolean;
}

const CHOICE_OPTIONS: ChoiceOption[] = [
  {
    id: 'ai',
    title: 'Enhance with AI',
    subtitle: 'Add Archetypal Elements',
    description:
      'AI will analyze your manual sigil and intention, then select archetypal elements to create 4 enhanced variations combining your artwork with symbolic depth.',
    badge: '✨',
    recommended: true,
  },
  {
    id: 'keep',
    title: 'Keep As-Is',
    subtitle: 'Pure Manual Creation',
    description:
      'Use your hand-drawn sigil exactly as you created it. Pure personal expression without AI modification.',
    badge: '🎨',
  },
];

export const PostForgeChoiceScreen: React.FC = () => {
  const navigation = useNavigation<PostForgeChoiceNavigationProp>();
  const route = useRoute<PostForgeChoiceRouteProp>();

  const { intentionText, distilledLetters, sigilSvg, category } = route.params;

  const handleSelect = (optionId: 'keep' | 'ai'): void => {
    if (optionId === 'ai') {
      // Navigate to AI Analysis with manual sigil
      navigation.navigate('AIAnalysis', {
        intentionText,
        distilledLetters,
        sigilSvg,
        sigilVariant: 'manual' as any, // Mark as manual for tracking
        category,
      });
    } else {
      // Keep manual sigil, go directly to mantra creation
      navigation.navigate('MantraCreation', {
        intentionText,
        distilledLetters,
        sigilSvg,
        finalImageUrl: undefined, // Will use SVG
        category,
      });
    }
  };

  const renderOption = (option: ChoiceOption): React.JSX.Element => {
    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.optionCard,
          option.recommended && styles.optionCardRecommended,
        ]}
        onPress={() => handleSelect(option.id)}
        activeOpacity={0.8}
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
          <Text style={styles.title}>Enhance Your Creation?</Text>
          <Text style={styles.subtitle}>
            Your manual sigil is complete. You can keep it as-is or enhance it with AI-selected archetypal elements.
          </Text>
        </View>

        {/* Sigil Preview */}
        <View style={styles.sigilPreview}>
          <Text style={styles.previewLabel}>Your Manual Sigil</Text>
          <View style={styles.sigilContainer}>
            <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
          </View>
          <Text style={styles.intentionText}>"{intentionText}"</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsSection}>
          {CHOICE_OPTIONS.map(renderOption)}
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
    paddingBottom: spacing.xxxl,
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
  sigilPreview: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  previewLabel: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sigilContainer: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: spacing.md,
  },
  intentionText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  optionsSection: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  optionCardRecommended: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}10`,
  },
  optionBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionBadgeText: {
    fontSize: 24,
  },
  recommendedTag: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  recommendedTagText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  optionContent: {
    marginLeft: 60, // Space for badge
    marginTop: spacing.xs,
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
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  optionArrowText: {
    fontSize: 24,
    color: colors.gold,
  },
});
