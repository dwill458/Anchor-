/**
 * Anchor App - Enhanced Version Picker Screen (Phase 3)
 *
 * Step 7c in anchor creation flow (after AIGenerating with ControlNet).
 * User selects from 2 ControlNet-enhanced variations that preserve
 * the structure while applying the chosen artistic style.
 *
 * Features:
 * - Displays 2 variations in a 2-column layout
 * - Shows selected style applied
 * - Structure preservation indicator
 *      Zen Architect styling with entrance animations
 */

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { ScreenHeader, ZenBackground } from '@/components/common';
import { logger } from '@/utils/logger';
import { useTempStore } from '@/stores/anchorStore';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';

const { width: screenWidth } = Dimensions.get('window');
const CIRCLE_SIZE = (screenWidth / 2) - 20;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
const MAX_VISIBLE_VARIATIONS = 2;
const ROMAN_NUMERALS = ['I', 'II'] as const;
const FORM_LABELS = ['Form I', 'Form II'] as const;
const MAX_INLINE_PREVIEW_BYTES = 700_000;

interface VariationAsset {
  id: string;
  fullUri: string;
  isHeavyInline: boolean;
  variationId?: string;
  reusedFromPool?: boolean;
}

type EnhancedVersionPickerRouteProp = RouteProp<RootStackParamList, 'EnhancedVersionPicker'>;
type EnhancedVersionPickerNavigationProp = StackNavigationProp<RootStackParamList, 'EnhancedVersionPicker'>;

/**
 * Style display names
 */
const STYLE_NAMES: Record<string, string> = {
  watercolor: 'Watercolor',
  sacred_geometry: 'Sacred Geometry',
  ink_brush: 'Ink Brush',
  gold_leaf: 'Gold Leaf',
  cosmic: 'Cosmic',
  architectural_trace: 'Architectural Trace',
  lunar_etch: 'Lunar Etch',
  aurora_glow: 'Aurora Glow',
  ember_trace: 'Ember Trace',
  resonance_rings: 'Resonance Rings',
  monolith_ink: 'Monolith Ink',
  celestial_grid: 'Celestial Grid',
  minimal_line: 'Minimal Line',
  obsidian_mono: 'Obsidian Mono',
  echo_chamber: 'Echo Chamber',
};

export const AIVariationPickerScreen: React.FC = () => {
  const navigation = useNavigation<EnhancedVersionPickerNavigationProp>();
  const route = useRoute<EnhancedVersionPickerRouteProp>();
  const insets = useSafeAreaInsets();

  // Extract params from route (Phase 3 ControlNet flow)
  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    styleChoice,
    variations,
    reinforcementMetadata,
    prompt, // Fix: Destructure prompt so it's defined in scope (optional)
    negativePrompt,
    modelUsed,
    provider,
    controlMethod,
    generationTimeMs,
    reuseRequestId,
  } = route.params;

  // Selected variation index (0-1)
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [hydratedIndexes, setHydratedIndexes] = useState<Set<number>>(new Set([0]));

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Start animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const setTempEnhancedImage = useTempStore((state) => state.setTempEnhancedImage);

  const normalizedVariations = useMemo<VariationAsset[]>(() => {
    return variations.slice(0, MAX_VISIBLE_VARIATIONS).map((variation, index) => {
      let fullUri = '';
      if (typeof variation === 'string') {
        fullUri = variation;
      } else if (variation && typeof variation === 'object' && 'imageUrl' in variation) {
        fullUri = String((variation as any).imageUrl ?? '');
      }

      if (fullUri && !fullUri.startsWith('http') && !fullUri.startsWith('data:image')) {
        fullUri = `data:image/png;base64,${fullUri}`;
      }

      const base64Length = fullUri.startsWith('data:image')
        ? fullUri.split(',')[1]?.length ?? 0
        : 0;

      return {
        id: `variation_${index}`,
        fullUri,
        isHeavyInline: base64Length > MAX_INLINE_PREVIEW_BYTES,
        variationId:
          variation && typeof variation === 'object' && 'variationId' in variation
            ? String((variation as any).variationId ?? '')
            : undefined,
        reusedFromPool:
          variation && typeof variation === 'object' && 'reusedFromPool' in variation
            ? Boolean((variation as any).reusedFromPool)
            : false,
      };
    });
  }, [variations]);

  useEffect(() => {
    const heavyInlineCount = normalizedVariations.filter((item) => item.isHeavyInline).length;
    ErrorTrackingService.addBreadcrumb('Variation picker mounted', 'ai.variation_picker', {
      variation_count: normalizedVariations.length,
      heavy_inline_count: heavyInlineCount,
    });
  }, [normalizedVariations]);

  const handleSelectVariation = useCallback((index: number) => {
    setSelectedIndex(index);
    setHydratedIndexes((prev) => {
      if (prev.has(index)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleContinue = () => {
    const trace = PerformanceMonitoring.startTrace('variation_picker_continue', {
      selected_index: selectedIndex,
    });

    try {
      const selectedVariation = normalizedVariations[selectedIndex];

      // Normalize image data (handle object vs string)
      const imageUrl = selectedVariation?.fullUri ?? '';

      if (!imageUrl) {
        trace.stop({ success: false, reason: 'missing_image_url' });
        Alert.alert('Error', 'Invalid variation selected. Please try again.');
        return;
      }

      trace.stop({ success: true });
      ErrorTrackingService.addBreadcrumb('Variation selected', 'ai.variation_picker', {
        selected_index: selectedIndex,
        heavy_inline: selectedVariation.isHeavyInline,
      });

      const enhancementMetadata = {
        styleApplied: styleChoice,
        modelUsed: modelUsed || 'unknown-model',
        provider: provider || 'unknown',
        controlMethod: controlMethod || 'lineart',
        generationTimeMs: generationTimeMs || 0,
        promptUsed: prompt || '',
        negativePrompt: negativePrompt || '',
        appliedAt: new Date(),
        variationId: selectedVariation.variationId || undefined,
        reuseRequestId: reuseRequestId || undefined,
        reusedFromPool: selectedVariation.reusedFromPool || false,
      };

      // Store heavy inline images in temp store to avoid nav param size limits
      if (selectedVariation.isHeavyInline) {
        setTempEnhancedImage(imageUrl);
      }

      navigation.navigate('AnchorReveal', {
        intentionText,
        category,
        distilledLetters,
        baseSigilSvg,
        reinforcedSigilSvg,
        structureVariant,
        reinforcementMetadata,
        enhancementMetadata,
        enhancedImageUrl: selectedVariation.isHeavyInline ? undefined : imageUrl,
      });
    } catch (err) {
      trace.stop({ success: false });
      ErrorTrackingService.captureException(err, {
        screen: 'AIVariationPickerScreen',
        action: 'continue_with_variation',
      });
      logger.error('Selection Error:', err);
      Alert.alert('Selection Failed', 'Could not process selection. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ZenBackground orbOpacity={0.15} />

      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Refine Your Anchor" />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: insets.bottom + 96,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Title Section */}
          <Animated.View
            style={[
              styles.titleSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.title}>Select Your Expression</Text>
            <Text style={styles.subtitle}>
              The structure of your intention is fixed. Choose the visual resonance that grounds your focus.
            </Text>
          </Animated.View>

          {/* Style Info Box */}
          <Animated.View
            style={[
              styles.styleInfoBox,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.styleInfoIcon}>✨</Text>
            <View style={styles.styleInfoContent}>
              <Text style={styles.styleInfoLabel}>Visual Resonance</Text>
              <Text style={styles.styleInfoValue}>{STYLE_NAMES[styleChoice] || styleChoice}</Text>
            </View>
            <View style={styles.styleInfoBadge}>
              <Text style={styles.styleInfoBadgeText}>✓ Structure Preserved</Text>
            </View>
          </Animated.View>

          {/* Intention Micro-Label */}
          <Animated.View
            style={[
              styles.intentionSection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 40],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.intentionText}>
              <Text style={styles.intentionTextEmphasis}>"{intentionText}"</Text>
            </Text>
          </Animated.View>

          {/* Variations Grid */}
          <Animated.View
            style={[
              styles.gridSection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 50],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.guidanceText}>Trust your first instinct. Choose the form that feels most visceral.</Text>
            <FlatList
              data={normalizedVariations}
              numColumns={2}
              keyExtractor={(item) => item.id}
              columnWrapperStyle={{
                justifyContent: 'space-between',
                paddingHorizontal: 0
              }}
              style={{ marginTop: 40, marginBottom: 20, marginHorizontal: -4 }}
              renderItem={({ item: variation, index }) => {
                const isSelected = selectedIndex === index;
                const shouldHydrateImage =
                  !variation.isHeavyInline || hydratedIndexes.has(index) || isSelected;
                return (
                  <TouchableOpacity
                    key={variation.id}
                    onPress={() => handleSelectVariation(index)}
                    activeOpacity={0.85}
                    style={styles.variationWrapper}
                    accessibilityRole="button"
                    accessibilityLabel={FORM_LABELS[index] ?? `Form ${ROMAN_NUMERALS[index] ?? index + 1}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Animated.View
                      style={[
                        styles.variationCard,
                        isSelected ? styles.variationCardSelected : styles.variationCardUnselected,
                      ]}
                    >
                      {/* Image Container */}
                      <View style={styles.imageContainer}>
                        {shouldHydrateImage && variation.fullUri ? (
                          <OptimizedImage
                            uri={variation.fullUri}
                            style={styles.variationImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.memoryGuardPlaceholder}>
                            <Text style={styles.memoryGuardText}>Tap to load</Text>
                          </View>
                        )}
                      </View>

                      {/* Number Badge */}
                      <View style={styles.numberBadge}>
                        <Text style={styles.numberText}>{ROMAN_NUMERALS[index] ?? index + 1}</Text>
                      </View>

                      {/* Selected Check */}
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.checkIcon}>✓</Text>
                        </View>
                      )}

                      {/* DEFERRED: Selected glow replaced by gold ring treatment. */}
                    </Animated.View>

                    {/* Label */}
                    <Text
                      style={[
                        styles.variationLabel,
                        isSelected ? styles.variationLabelSelected : styles.variationLabelUnselected,
                      ]}
                    >
                      {FORM_LABELS[index] ?? `Form ${ROMAN_NUMERALS[index] ?? index + 1}`}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              scrollEnabled={false}
            />
          </Animated.View>
          {/* DEFERRED: Move Symbolic Structure explanation to AnchorDetailScreen v1.1 */}

          {/* Bottom spacer for button */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Continue Button - Fixed at bottom */}
        <Animated.View
          style={[
            styles.continueContainer,
            {
              paddingBottom: insets.bottom + 20,
            },
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 30],
                    outputRange: [0, 50],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.9}
            style={styles.continueButton}
            accessibilityRole="button"
            accessibilityLabel="Set Anchor"
          >
            <LinearGradient
              colors={[colors.gold, '#B8941F']}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueText}>
                Set Anchor
              </Text>
              <Text style={styles.continueArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.finalityNote}>This cannot be changed once sealed</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  titleSection: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    // fontFamily: 'Cinzel-Regular', // Font might not be loaded, fallback safely
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.silver,
    lineHeight: 22,
  },
  styleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  styleInfoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  styleInfoContent: {
    flex: 1,
  },
  styleInfoLabel: {
    fontSize: 11,
    color: colors.silver,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  styleInfoValue: {
    fontSize: 16,
    color: colors.gold,
    fontWeight: '600',
  },
  styleInfoBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  styleInfoBadgeText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  intentionSection: {
    marginBottom: 8,
  },
  intentionText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.silver,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  intentionTextEmphasis: {
    color: colors.bone,
    fontStyle: 'normal',
  },
  gridSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  guidanceText: {
    fontSize: 14,
    color: colors.silver,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12,
    opacity: 0.9,
    paddingHorizontal: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginHorizontal: -2,
  },
  variationWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  variationCard: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.charcoal,
    position: 'relative',
  },
  variationCardSelected: {
    borderWidth: 2.5,
    borderColor: '#D4AF37',
  },
  variationCardUnselected: {
    borderWidth: 1,
    borderColor: 'rgba(245,245,220,0.12)',
  },
  imageContainer: {
    flex: 1,
  },
  variationImage: {
    width: '100%',
    height: '100%',
  },
  memoryGuardPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 20, 25, 0.9)',
  },
  memoryGuardText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.silver,
    letterSpacing: 0.4,
  },
  numberBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  numberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 13,
    color: '#0F1419',
  },
  selectedGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CIRCLE_RADIUS,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  variationLabel: {
    fontSize: 13,
    fontFamily: 'Cinzel-Regular',
    textAlign: 'center',
    marginTop: 10,
  },
  variationLabelSelected: {
    color: '#D4AF37',
    fontWeight: '700',
  },
  variationLabelUnselected: {
    color: 'rgba(245,245,220,0.45)',
    fontWeight: '600',
  },
  bottomSpacer: {
    flexGrow: 1,
    minHeight: 12,
  },
  continueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  continueButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
    marginRight: 8,
  },
  continueArrow: {
    fontSize: 20,
    color: colors.charcoal,
    fontWeight: '300',
  },
  finalityNote: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: 'rgba(245,245,220,0.25)',
    textAlign: 'center',
    marginTop: 8,
  },
});
