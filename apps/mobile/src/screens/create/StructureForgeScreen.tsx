import React, { useEffect, useState } from 'react';
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
import { SvgXml } from 'react-native-svg';
import { RootStackParamList, AnchorCategory } from '@/types';
import {
  generateAllVariants,
  SigilVariant,
  SigilGenerationResult,
  VARIANT_METADATA,
} from '@/utils/sigil/traditional-generator';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';

type StructureForgeRouteProp = RouteProp<RootStackParamList, 'StructureForge'>;
type StructureForgeNavigationProp = StackNavigationProp<RootStackParamList, 'StructureForge'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

/**
 * StructureForgeScreen
 *
 * Step 3 in the new architecture: Choose deterministic structure variant.
 *
 * Displays three sigil structure variants (Dense, Balanced, Minimal) generated
 * deterministically from the distilled letters. User selects the "bones" of their
 * anchor, which will serve as the source of truth for manual reinforcement and
 * optional AI enhancement.
 *
 * Next: ManualReinforcementScreen (guided tracing over the chosen structure)
 */
export default function StructureForgeScreen() {
  const route = useRoute<StructureForgeRouteProp>();
  const navigation = useNavigation<StructureForgeNavigationProp>();

  const { intentionText, category, distilledLetters } = route.params;

  const [variants, setVariants] = useState<SigilGenerationResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<SigilVariant>('balanced');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Generate all three variants
      const generated = generateAllVariants(distilledLetters);
      setVariants(generated);
    } catch (error) {
      console.error('Sigil selection generation failed:', error);
    } finally {
      setLoading(false);
    }
  }, [distilledLetters]);

  const handleContinue = () => {
    const selected = variants.find(v => v.variant === selectedVariant);
    if (!selected) return;

    navigation.navigate('ManualReinforcement', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg: selected.svg,
      structureVariant: selectedVariant,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ZenBackground />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Crafting your sigils...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ZenBackground />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Structure</Text>
          <Text style={styles.subtitle}>
            Each structure forms the bones of your anchor—the foundation that will hold your intention
          </Text>
        </View>

        {/* Distilled Letters Display */}
        <View style={styles.lettersSection}>
          <Text style={styles.lettersLabel}>Distilled Letters</Text>
          <View style={styles.lettersContainer}>
            {distilledLetters.map((letter, index) => (
              <View key={index} style={styles.letterBox}>
                <Text style={styles.letterText}>{letter}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Large Preview of Selected Variant */}
        <View style={styles.previewSection}>
          <View style={styles.previewContainer}>
            {variants.find(v => v.variant === selectedVariant) && (
              <SvgXml
                xml={variants.find(v => v.variant === selectedVariant)!.svg}
                width="90%"
                height="90%"
                color="#D4AF37" // Gold
              />
            )}
          </View>
          <Text style={styles.previewLabel}>
            {VARIANT_METADATA[selectedVariant].title} Style
          </Text>
        </View>

        {/* Variant Selection Cards */}
        <View style={styles.variantsSection}>
          <Text style={styles.variantsTitle}>Select a Style</Text>

          {variants.map((result) => {
            const metadata = VARIANT_METADATA[result.variant];
            const isSelected = result.variant === selectedVariant;

            return (
              <TouchableOpacity
                key={result.variant}
                style={[styles.variantCard, isSelected && styles.variantCardSelected]}
                onPress={() => setSelectedVariant(result.variant)}
                activeOpacity={0.7}
              >
                {/* Sigil Thumbnail */}
                <View style={styles.sigilContainer}>
                  <SvgXml
                    xml={result.svg}
                    width="100%"
                    height="100%"
                    color="#D4AF37" // Gold
                  />
                </View>

                {/* Variant Info */}
                <View style={styles.variantInfo}>
                  <Text style={[styles.variantTitle, isSelected && styles.variantTitleSelected]}>
                    {metadata.title}
                  </Text>
                  <Text style={styles.variantDescription}>{metadata.description}</Text>
                </View>

                {/* Selection Indicator */}
                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 32,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
  lettersSection: {
    marginBottom: spacing.xl,
  },
  lettersLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  lettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  letterBox: {
    backgroundColor: colors.deepPurple,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xs,
  },
  letterText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  previewContainer: {
    width: CARD_WIDTH,
    aspectRatio: 1,
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
  },
  variantsSection: {
    marginBottom: spacing.lg,
  },
  variantsTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.bone,
    marginBottom: spacing.md,
  },
  variantCard: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.sm,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  variantCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  sigilContainer: {
    width: 120,
    height: 120,
    marginRight: spacing.md,
  },
  variantInfo: {
    flex: 1,
  },
  variantTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.bone,
    marginBottom: 4,
  },
  variantTitleSelected: {
    color: colors.gold,
  },
  variantDescription: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
    lineHeight: 20,
  },
  selectedIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: typography.sizes.h3,
    color: colors.charcoal,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.charcoal,
    borderTopWidth: 1,
    borderTopColor: colors.navy,
  },
  continueButton: {
    backgroundColor: colors.gold,
    height: 56,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    fontWeight: '600',
    color: colors.charcoal,
  },
});
