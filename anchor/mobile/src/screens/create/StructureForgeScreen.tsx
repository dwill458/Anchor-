import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { ZenBackground } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { ProPaywallModal } from '@/components/modals/ProPaywallModal';

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
  const [showProPaywall, setShowProPaywall] = useState(false);

  // Subscription hook for Pro feature gating
  const { features } = useSubscription();

  // Animation values for fade + draw-in transitions
  const previewFadeAnim = useRef(new Animated.Value(1)).current;
  const labelFadeAnim = useRef(new Animated.Value(1)).current;
  const selectionScaleAnim = useRef(new Animated.Value(1)).current;
  // Draw-in: scale materialise + gold glow pulse
  const previewScaleAnim = useRef(new Animated.Value(1)).current;
  const previewGlowAnim = useRef(new Animated.Value(0)).current;
  // Ref to cancel any in-progress animation when user taps quickly
  const currentAnimation = useRef<Animated.CompositeAnimation | null>(null);

  // Detect if this is user's first anchor
  const { anchorCount, incrementAnchorCount } = useAuthStore();
  const isFirstAnchor = anchorCount === 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

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

  // Handle variant selection with draw-in animation + haptics
  const handleVariantSelect = (variant: SigilVariant) => {
    if (variant === selectedVariant) return;

    // Cancel any in-progress animation so rapid taps never get stuck
    currentAnimation.current?.stop();
    setIsTransitioning(true);

    Haptics.selectionAsync();

    // Phase 1: quick fade-out (120ms) + card scale pulse
    const fadeOut = Animated.parallel([
      Animated.timing(previewFadeAnim, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(labelFadeAnim, {
        toValue: 0,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(selectionScaleAnim, {
          toValue: 1.02,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(selectionScaleAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    currentAnimation.current = fadeOut;
    fadeOut.start(({ finished }) => {
      if (!finished) return; // aborted by a later tap

      // Swap variant + reset scale to 0.82 for draw-in
      setSelectedVariant(variant);
      previewScaleAnim.setValue(0.82);
      previewGlowAnim.setValue(0);

      // Phase 2: draw-in — scale materialises from 0.82→1.0 while opacity pops
      const drawIn = Animated.parallel([
        Animated.timing(previewFadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(previewScaleAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(labelFadeAnim, {
          toValue: 1,
          duration: 300,
          delay: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      currentAnimation.current = drawIn;
      drawIn.start(({ finished: drawFinished }) => {
        if (!drawFinished) return;

        // Phase 3: brief gold glow pulse (0→0.55→0, 350ms)
        const glowPulse = Animated.sequence([
          Animated.timing(previewGlowAnim, {
            toValue: 0.55,
            duration: 175,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(previewGlowAnim, {
            toValue: 0,
            duration: 175,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]);
        currentAnimation.current = glowPulse;
        glowPulse.start(() => {
          setIsTransitioning(false);
        });
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

  const handleForgeFromScratch = () => {
    // Check if user has access to Forge feature
    if (!features.canForgeAnchor) {
      setShowProPaywall(true);
      return;
    }

    // Pro user - navigate directly to ManualForge with blank canvas
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ManualForge', {
      intentionText,
      category,
      distilledLetters,
      isFromScratch: true, // No base sigil - blank canvas
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
        {/* Back row */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Choose Structure</Text>
            <Text style={styles.subtitle}>
              Choose a frame to guide your draw.
            </Text>
          </View>

          {/* Forge Button - Top Right */}
          <TouchableOpacity
            style={styles.forgeButton}
            onPress={handleForgeFromScratch}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Forge from scratch"
          >
            <Text style={styles.forgeIcon}>🔥</Text>
            <Text style={styles.forgeText}>Forge</Text>
            <View style={styles.proMicroBadge}>
              <Text style={styles.proMicroBadgeText}>PRO</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Anchor name context chip — reminds user which anchor they are building */}
        <View
          style={styles.anchorChip}
          accessibilityLabel={`Anchor: ${intentionText || 'Untitled'}`}
        >
          <Text style={styles.anchorChipLabel}>Anchor  </Text>
          <Text style={styles.anchorChipValue} numberOfLines={1}>
            {(intentionText || 'Untitled').length > 22
              ? (intentionText || 'Untitled').slice(0, 22) + '…'
              : (intentionText || 'Untitled')}
          </Text>
        </View>
      </View>

      {/* Main Preview Area */}
      <View style={styles.previewSection}>
        <Animated.View
          style={[
            styles.previewContainer,
            {
              opacity: previewFadeAnim,
              transform: [{ scale: previewScaleAnim }],
            }
          ]}
        >
          {/* Gold glow overlay — pulses briefly after draw-in completes */}
          <Animated.View
            style={[styles.previewGlow, { opacity: previewGlowAnim }]}
            pointerEvents="none"
          />
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
                  <SvgXml
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
        >
          <Text style={[
            styles.continueText,
            !selectedVariant && styles.continueTextDisabled
          ]}>
            Continue to Forge
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pro Paywall Modal */}
      <ProPaywallModal
        visible={showProPaywall}
        feature="manual_forge"
        onClose={() => setShowProPaywall(false)}
        onUpgrade={() => {
          setShowProPaywall(false);
          // Navigate to Settings (future: subscription screen)
          navigation.navigate('Settings');
        }}
      />
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
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
    padding: 4,
  },
  backIcon: {
    fontSize: 24,
    color: colors.gold,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'left',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'left',
    lineHeight: 24,
    flexShrink: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },

  // Anchor name context chip
  anchorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.ritual.glass,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  anchorChipLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.text.secondary,
  },
  anchorChipValue: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.gold,
    fontWeight: '600',
    flexShrink: 1,
  },

  // Preview Section (flex: 1)
  previewSection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  previewContainer: {
    width: SCREEN_WIDTH - 80,
    aspectRatio: 1,
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    marginTop: 0,
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
  // Gold glow overlay that pulses briefly after the draw-in animation completes
  previewGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: spacing.md + 4,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.ritual.softGlow,
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
    borderWidth: 2.5,
    backgroundColor: `${colors.gold}08`, // 8% opacity
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
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

  // Header with Forge Button
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  forgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold + '60',
    gap: 4,
  },
  forgeIcon: {
    fontSize: 16,
  },
  forgeText: {
    fontSize: 13,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    fontWeight: '600',
  },
  proMicroBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 2,
  },
  proMicroBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
});
