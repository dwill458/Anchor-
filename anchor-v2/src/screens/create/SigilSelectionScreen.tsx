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

    navigation.navigate('PostForgeChoice', {
      intentionText,
      category,
      distilledLetters,
      sigilSvg: selected.svg,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Crafting your sigils...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
    backgroundColor: '#0F1419', // Navy
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    color: '#D4AF37', // Gold
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 28,
    color: '#D4AF37', // Gold
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#C0C0C0', // Secondary text
    textAlign: 'center',
    lineHeight: 24,
  },
  lettersSection: {
    marginBottom: 32,
  },
  lettersLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9E9E9E', // Tertiary text
    marginBottom: 8,
  },
  lettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  letterBox: {
    backgroundColor: '#3E2C5B', // Deep purple
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  letterText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    color: '#D4AF37', // Gold
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  previewContainer: {
    width: CARD_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#252529', // Card background
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4AF37', // Gold
    padding: 16,
    marginBottom: 16,
  },
  previewLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    color: '#D4AF37', // Gold
  },
  variantsSection: {
    marginBottom: 24,
  },
  variantsTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 20,
    color: '#F5F5DC', // Bone
    marginBottom: 16,
  },
  variantCard: {
    backgroundColor: '#252529', // Card background
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  variantCardSelected: {
    borderColor: '#D4AF37', // Gold
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  sigilContainer: {
    width: 120,
    height: 120,
    marginRight: 16,
  },
  variantInfo: {
    flex: 1,
  },
  variantTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    color: '#F5F5DC', // Bone
    marginBottom: 4,
  },
  variantTitleSelected: {
    color: '#D4AF37', // Gold
  },
  variantDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#C0C0C0', // Secondary text
    lineHeight: 20,
  },
  selectedIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D4AF37', // Gold
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 18,
    color: '#1A1A1D', // Charcoal
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: '#1A1A1D', // Charcoal
    borderTopWidth: 1,
    borderTopColor: '#0F1419', // Navy
  },
  continueButton: {
    backgroundColor: '#D4AF37', // Gold
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1D', // Charcoal
  },
});
