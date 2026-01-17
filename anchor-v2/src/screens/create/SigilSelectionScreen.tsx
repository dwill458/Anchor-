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

type SigilSelectionRouteProp = RouteProp<RootStackParamList, 'SigilSelection'>;
type SigilSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'SigilSelection'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

/**
 * SigilSelectionScreen
 * 
 * Displays three organic sigil variants (Dense, Balanced, Minimal)
 * for user selection. Uses the new organic traditional generator
 * with flowing, hand-drawn aesthetic.
 */
export default function SigilSelectionScreen() {
  const route = useRoute<SigilSelectionRouteProp>();
  const navigation = useNavigation<SigilSelectionNavigationProp>();

  const { intentionText, category, distilledLetters } = route.params;

  const [variants, setVariants] = useState<SigilGenerationResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<SigilVariant>('balanced');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate all three variants
    const generated = generateAllVariants(distilledLetters);
    setVariants(generated);
    setLoading(false);
  }, [distilledLetters]);

  const handleContinue = () => {
    const selected = variants.find(v => v.variant === selectedVariant);
    if (!selected) return;

    navigation.navigate('MantraCreation', {
      intentionText,
      category,
      distilledLetters,
      sigilSvg: selected.svg,
      sigilVariant: selectedVariant,
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
          <Text style={styles.title}>Choose Your Anchor</Text>
          <Text style={styles.subtitle}>
            Each style channels your intention in a unique way
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
    fontFamily: typography.fontFamily.serif,
    fontSize: typography.fontSize.lg,
    color: colors.gold,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.fontFamily.serif,
    fontSize: typography.fontSize.xxl,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.md,
    color: colors.smoke,
    textAlign: 'center',
    lineHeight: 24,
  },
  lettersSection: {
    marginBottom: spacing.xl,
  },
  lettersLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.mist,
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
    fontFamily: typography.fontFamily.serif,
    fontSize: typography.fontSize.lg,
    color: colors.gold,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  previewContainer: {
    width: CARD_WIDTH,
    aspectRatio: 1,
    backgroundColor: colors.slate,
    borderRadius: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: typography.fontSize.lg,
    color: colors.gold,
  },
  variantsSection: {
    marginBottom: spacing.lg,
  },
  variantsTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: typography.fontSize.xl,
    color: colors.bone,
    marginBottom: spacing.md,
  },
  variantCard: {
    backgroundColor: colors.slate,
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
    fontFamily: typography.fontFamily.serif,
    fontSize: typography.fontSize.lg,
    color: colors.bone,
    marginBottom: 4,
  },
  variantTitleSelected: {
    color: colors.gold,
  },
  variantDescription: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.smoke,
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
    fontSize: typography.fontSize.lg,
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
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: colors.charcoal,
  },
});
