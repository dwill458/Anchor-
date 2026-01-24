import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { RootStackParamList, AnchorCategory } from '@/types';
import {
  generateAllVariants,
  SigilVariant,
  SigilGenerationResult,
  VARIANT_METADATA,
} from '@/utils/sigil/traditional-generator';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground, BottomDock, DOCK_HEIGHT } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

type StructureForgeRouteProp = RouteProp<RootStackParamList, 'StructureForge'>;
type StructureForgeNavigationProp = StackNavigationProp<RootStackParamList, 'StructureForge'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

/**
 * StructureForgeScreen
 *
 * Step 3 in the new architecture: Set the foundation for the anchor.
 *
 * This is a commitment moment, not a customization screen. First-time users
 * should feel guided and safe, with a pre-selected recommended structure.
 * Returning users can explore alternatives, but the default is always valid.
 *
 * Design philosophy: This feels like "This is how it becomes real,"
 * not "Which one do I like?"
 *
 * Next: ManualReinforcementScreen (guided tracing over the chosen structure)
 */
export default function StructureForgeScreen() {
  const route = useRoute<StructureForgeRouteProp>();
  const navigation = useNavigation<StructureForgeNavigationProp>();

  const { intentionText, category, distilledLetters } = route.params;

  const [variants, setVariants] = useState<SigilGenerationResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<SigilVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animation values for fade transitions
  const previewFadeAnim = useRef(new Animated.Value(1)).current;
  const labelFadeAnim = useRef(new Animated.Value(1)).current;
  const selectionScaleAnim = useRef(new Animated.Value(1)).current;

  // Detect if this is user's first anchor
  const { anchorCount, incrementAnchorCount } = useAuthStore();
  const isFirstAnchor = anchorCount === 0;

  useEffect(() => {
    try {
      // Generate all three variants
      const generated = generateAllVariants(distilledLetters);

      // Reorder variants: recommended (balanced) first, then others
      const orderedVariants = [
        generated.find(v => v.variant === 'balanced'),
        generated.find(v => v.variant === 'dense'),
        generated.find(v => v.variant === 'minimal'),
      ].filter(Boolean) as SigilGenerationResult[];

      setVariants(orderedVariants);

      // Pre-select 'balanced' for first-time users
      if (isFirstAnchor) {
        setSelectedVariant('balanced');
      }
    } catch (error) {
      console.error('Sigil selection generation failed:', error);
    } finally {
      setLoading(false);
    }
  }, [distilledLetters, isFirstAnchor]);

  // Handle variant selection with deliberate fade transition + haptics
  const handleVariantSelect = (variant: SigilVariant) => {
    // Prevent rapid switching during transition
    if (isTransitioning || variant === selectedVariant) return;

    // Trigger selection haptic
    Haptics.selectionAsync();

    setIsTransitioning(true);

    // Fade out current preview and label, pulse selection
    Animated.parallel([
      Animated.timing(previewFadeAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(labelFadeAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Selection scale pulse (subtle 1.02)
      Animated.sequence([
        Animated.timing(selectionScaleAnim, {
          toValue: 1.02,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(selectionScaleAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Change variant after fade out
      setSelectedVariant(variant);

      // Fade in new preview and label
      Animated.parallel([
        Animated.timing(previewFadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(labelFadeAnim, {
          toValue: 1,
          duration: 350,
          delay: 100,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  const handleContinue = () => {
    if (!selectedVariant) return;

    const selected = variants.find(v => v.variant === selectedVariant);
    if (!selected) return;

    // Subtle confirmation haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
          <Text style={styles.loadingText}>Forming your foundation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedMetadata = selectedVariant ? VARIANT_METADATA[selectedVariant] : null;
  const ctaLabel = 'Continue'; // Simple, premium
  const selectedLabel = selectedMetadata?.title;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ZenBackground />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: DOCK_HEIGHT + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose Structure</Text>
          <Text style={styles.subtitle}>
            This is the frame that will hold your intention.
          </Text>
        </View>

        {/* Large Preview of Selected Variant */}
        <View style={styles.previewSection}>
          <Animated.View
            style={[
              styles.previewContainer,
              { opacity: previewFadeAnim }
            ]}
          >
            {selectedVariant && variants.find(v => v.variant === selectedVariant) && (
              <SvgXml
                xml={variants.find(v => v.variant === selectedVariant)!.svg}
                width="90%"
                height="90%"
                color="#D4AF37" // Gold
              />
            )}
          </Animated.View>
          <Animated.Text
            style={[
              styles.previewLabel,
              { opacity: labelFadeAnim }
            ]}
          >
            {selectedMetadata?.title || 'Select a structure'}
          </Animated.Text>
        </View>

        {/* Variant Selection Cards */}
        <View style={styles.variantsSection}>
          <Text style={styles.variantsTitle}>Available Structures</Text>

          {variants.map((result, index) => {
            const metadata = VARIANT_METADATA[result.variant];
            const isSelected = result.variant === selectedVariant;
            const isRecommended = result.variant === 'balanced';
            const isFirst = index === 0;

            return (
              <Animated.View
                key={result.variant}
                style={[
                  { transform: [{ scale: isSelected ? selectionScaleAnim : 1 }] },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.variantCard,
                    isSelected && styles.variantCardSelected,
                    !isSelected && styles.variantCardDimmed,
                  ]}
                  onPress={() => handleVariantSelect(result.variant)}
                  activeOpacity={0.7}
                  disabled={isTransitioning}
                  accessibilityRole="button"
                  accessibilityLabel={`${metadata.title} structure`}
                  accessibilityState={{ selected: isSelected }}
                  accessibilityHint={metadata.description}
                >
                  {/* Recommended Badge (show on first item for first-time users) */}
                  {isFirst && isFirstAnchor && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>Recommended for first Anchor</Text>
                    </View>
                  )}

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
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Luxury Docked Bottom Bar */}
      <BottomDock
        visible={true}
        selectedLabel={selectedLabel}
        ctaLabel={ctaLabel}
        disabled={!selectedVariant}
        onPress={handleContinue}
      />
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
    paddingTop: 64,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
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
    marginBottom: spacing.xs,
  },
  subtitle2: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    marginTop: spacing.lg,
  },
  previewContainer: {
    width: SCREEN_WIDTH - 32,
    aspectRatio: 1,
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  previewLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 18,
    color: colors.bone,
  },
  variantsSection: {
    marginBottom: spacing.lg,
  },
  variantsTitle: {
    fontFamily: typography.fonts.body,
    fontSize: 14,
    color: colors.text.tertiary,
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
    position: 'relative',
  },
  variantCardSelected: {
    borderColor: 'rgba(212, 175, 55, 0.85)', // Stronger gold ring
    backgroundColor: 'rgba(212, 175, 55, 0.04)', // Very subtle gold tint
    // Subtle gold glow
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  variantCardDimmed: {
    opacity: 0.7,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    left: spacing.md,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  recommendedText: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.bone,
    letterSpacing: 0.5,
  },
  sigilContainer: {
    width: 80,
    height: 80,
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
});
