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
import * as Haptics from 'expo-haptics';
import { RootStackParamList, AnchorCategory } from '@/types';
import {
  generateAllVariants,
  SigilVariant,
  SigilGenerationResult,
  VARIANT_METADATA,
} from '@/utils/sigil/traditional-generator';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground, SigilSvg } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { safeHaptics } from '@/utils/haptics';

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
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (typeof navigation.addListener !== 'function') return;
    const unsubscribe = navigation.addListener('focus', () => {
      isSubmittingRef.current = false;
    });
    return unsubscribe;
  }, [navigation]);

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
      logger.error('Sigil selection generation failed', error);
    } finally {
      setLoading(false);
    }
  }, [distilledLetters, isFirstAnchor]);

  // Handle variant selection with deliberate fade transition + haptics
  const handleVariantSelect = (variant: SigilVariant) => {
    // Prevent rapid switching during transition
    if (isTransitioning || variant === selectedVariant) return;

    // Trigger selection haptic
    void safeHaptics.selection();

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
    if (isSubmittingRef.current) return;
    if (!selectedVariant) return;

    const selected = variants.find(v => v.variant === selectedVariant);
    if (!selected) return;

    isSubmittingRef.current = true;
    // Subtle confirmation haptic
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ZenBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Structure</Text>
        <Text style={styles.subtitle}>
          This is the frame that will hold your intention.
        </Text>
      </View>

      {/* Main Preview Area */}
      <View style={styles.previewSection}>
        <Animated.View
          style={[
            styles.previewContainer,
            { opacity: previewFadeAnim }
          ]}
        >
          {selectedVariant && variants.find(v => v.variant === selectedVariant) && (
            <SigilSvg
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

      {/* Available Structures Section */}
      <View style={styles.structuresSection}>
        <Text style={styles.sectionTitle}>Available Structures</Text>

        {/* Structure Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.structuresList}
          contentContainerStyle={styles.structuresListContent}
        >
          {variants.map((result, index) => {
            const metadata = VARIANT_METADATA[result.variant];
            const isSelected = result.variant === selectedVariant;
            const isRecommended = result.variant === 'balanced';
            const isFirst = index === 0;

            return (
              <TouchableOpacity
                key={result.variant}
                style={[
                  styles.structureCard,
                  isSelected && styles.structureCardSelected
                ]}
                onPress={() => handleVariantSelect(result.variant)}
                activeOpacity={0.7}
                disabled={isTransitioning}
                accessibilityRole="button"
                accessibilityLabel={`${metadata.title} structure`}
                accessibilityState={{ selected: isSelected }}
                accessibilityHint={metadata.description}
              >
                {/* Checkmark for selected */}
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkIcon}>✓</Text>
                  </View>
                )}

                {/* Structure Preview */}
                <View style={styles.structurePreview}>
                  <SigilSvg
                    xml={result.svg}
                    width="85%"
                    height="85%"
                    color="#D4AF37" // Gold
                  />
                </View>

                {/* Structure Info */}
                <Text style={styles.structureName}>{metadata.title}</Text>
                <Text style={styles.structureDesc}>{metadata.description}</Text>

                {/* Badge (only for recommended) */}
                {isRecommended && isFirstAnchor && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Fixed CTA Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedVariant && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedVariant}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue to Forge"
          accessibilityState={{ disabled: !selectedVariant }}
          testID="continue-forge-button"
        >
          <Text style={[
            styles.continueText,
            !selectedVariant && styles.continueTextDisabled
          ]}>
            Continue to Forge
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
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
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Preview Section (flex: 1)
  previewSection: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    width: SCREEN_WIDTH - 80,
    aspectRatio: 1,
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
    padding: spacing.lg,
  },
  previewLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    color: colors.gold,
    marginTop: spacing.md,
  },

  // Structures Section
  structuresSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.charcoal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sectionTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  structuresList: {
    paddingHorizontal: spacing.lg,
  },
  structuresListContent: {
    paddingRight: spacing.lg,
  },

  // Structure Cards
  structureCard: {
    width: 140,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  structureCardSelected: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}08`, // 8% opacity
  },

  // Checkmark
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  checkmarkIcon: {
    fontSize: 14,
    color: colors.charcoal,
    fontWeight: 'bold',
  },

  // Structure Preview
  structurePreview: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.navy,
    borderRadius: 8,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Structure Info
  structureName: {
    fontFamily: typography.fonts.heading,
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  structureDesc: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Recommended Badge
  recommendedBadge: {
    marginTop: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.gold,
    borderRadius: 6,
    alignSelf: 'center',
  },
  recommendedText: {
    fontSize: 10,
    color: colors.charcoal,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Fixed CTA Footer
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl, // Extra padding for safe area
    backgroundColor: colors.charcoal,
    borderTopWidth: 1,
    borderTopColor: colors.navy,
  },
  continueButton: {
    height: 56,
    backgroundColor: colors.gold,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: `${colors.gold}40`, // 40% opacity
    opacity: 0.5,
  },
  continueText: {
    fontFamily: typography.fonts.body,
    fontSize: 16,
    color: colors.charcoal,
    fontWeight: '600',
  },
  continueTextDisabled: {
    opacity: 0.6,
  },
});
