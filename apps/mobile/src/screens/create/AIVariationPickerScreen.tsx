/**
 * Anchor App - Enhanced Version Picker Screen (Phase 3)
 *
 * Step 7c in anchor creation flow (after AIGenerating with ControlNet).
 * User selects from 4 ControlNet-enhanced variations that preserve
 * the structure while applying the chosen artistic style.
 *
 * Features:
 * - Displays 4 variations in 2x2 grid
 * - Shows selected style applied
 * - Structure preservation indicator
 * - Zen Architect styling with entrance animations
 */

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { ScreenHeader, ZenBackground, OptimizedImage } from '@/components/common';
import { prefetchImages } from '@/utils/image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - 80) / 2; // 2 columns with proper spacing (24px padding * 2 + 16px gap)

type EnhancedVersionPickerRouteProp = RouteProp<RootStackParamList, 'EnhancedVersionPicker'>;
type EnhancedVersionPickerNavigationProp = StackNavigationProp<RootStackParamList, 'EnhancedVersionPicker'>;

type VariationRouteParams =
  | RootStackParamList['EnhancedVersionPicker']
  | RootStackParamList['AIVariationPicker'];

type VariationItem = string | { imageUrl?: string; url?: string };

const getVariationUrl = (item: VariationItem): string | null => {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.imageUrl ?? item.url ?? null;
};

/**
 * Style display names
 */
const STYLE_NAMES: Record<string, string> = {
  watercolor: 'Watercolor',
  sacred_geometry: 'Sacred Geometry',
  ink_brush: 'Ink Brush',
  gold_leaf: 'Gold Leaf',
  cosmic: 'Cosmic',
  minimal_line: 'Minimal Line',
};

export const AIVariationPickerScreen: React.FC = () => {
  const navigation = useNavigation<EnhancedVersionPickerNavigationProp>();
  const route = useRoute<EnhancedVersionPickerRouteProp>();

  const rawParams = route.params as VariationRouteParams | undefined;

  const {
    intentionText,
    category,
    distilledLetters,
    reinforcedSigilSvg,
    reinforcementMetadata,
  } = rawParams ?? ({} as RootStackParamList['EnhancedVersionPicker']);

  const baseSigilSvg =
    rawParams && 'baseSigilSvg' in rawParams ? rawParams.baseSigilSvg : rawParams?.sigilSvg;

  const structureVariant =
    rawParams && 'structureVariant' in rawParams
      ? rawParams.structureVariant
      : (rawParams?.sigilVariant as RootStackParamList['EnhancedVersionPicker']['structureVariant']);
  const resolvedStructureVariant = structureVariant ?? 'balanced';

  const styleChoice =
    rawParams && 'styleChoice' in rawParams ? rawParams.styleChoice : undefined;

  const prompt = rawParams && 'prompt' in rawParams ? rawParams.prompt : undefined;

  const normalizedVariations = useMemo(
    () =>
      (rawParams?.variations ?? [])
        .map((item) => getVariationUrl(item as VariationItem))
        .filter((item): item is string => Boolean(item)),
    [rawParams]
  );

  // Selected variation index (0-3)
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  useEffect(() => {
    if (selectedIndex >= normalizedVariations.length) {
      setSelectedIndex(0);
    }
  }, [normalizedVariations.length, selectedIndex]);

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

  useEffect(() => {
    prefetchImages(normalizedVariations, 4);
  }, [normalizedVariations]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const isNavigatingRef = useRef(false);
  useEffect(() => {
    if (typeof navigation.addListener !== 'function') return;
    const unsubscribe = navigation.addListener('focus', () => {
      isNavigatingRef.current = false;
    });

    return unsubscribe;
  }, [navigation]);

  const handleContinue = () => {
    if (isNavigatingRef.current) return;
    if (normalizedVariations.length === 0) return;
    if (selectedIndex < 0 || selectedIndex >= normalizedVariations.length) return;
    if (!baseSigilSvg || !intentionText || !category || !distilledLetters) return;

    isNavigatingRef.current = true;
    const selectedImageUrl = normalizedVariations[selectedIndex];

    // Navigate to MantraCreation with full context including enhancement metadata
    navigation.navigate('AnchorReveal', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant: resolvedStructureVariant,
      reinforcementMetadata,
      enhancedImageUrl: selectedImageUrl,
      enhancementMetadata: {
        styleApplied: styleChoice || 'minimal_line',
        modelUsed: 'sdxl-controlnet',
        controlMethod: 'canny',
        generationTimeMs: 0,
        promptUsed: prompt || '',
        negativePrompt: '',
        appliedAt: new Date(),
      },
    });
  };

  if (!rawParams || normalizedVariations.length === 0 || !intentionText) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>No variations found</Text>
          <Text style={styles.subtitle}>Please go back and try again.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.continueButton}>
            <LinearGradient
              colors={[colors.gold, '#B8941F']}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ZenBackground orbOpacity={0.15} />

      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Refine Your Anchor" />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
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
              <Text style={styles.styleInfoValue}>
                {styleChoice ? (STYLE_NAMES[styleChoice] || styleChoice) : 'Custom'}
              </Text>
            </View>
            <View style={styles.styleInfoBadge}>
              <Text style={styles.styleInfoBadgeText}>✓ Structure Preserved</Text>
            </View>
          </Animated.View>

          {/* Intention Card */}
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
            <Text style={styles.intentionLabel}>ROOTED IN YOUR INTENTION</Text>
            <BlurView intensity={20} tint="dark" style={styles.intentionCard}>
              <View style={styles.intentionBorder} />
              <Text style={styles.intentionText}>"{intentionText}"</Text>
            </BlurView>
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
            <View style={styles.grid}>
              {normalizedVariations.map((imageUrl, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedIndex(index)}
                    activeOpacity={0.85}
                    style={styles.variationWrapper}
                  >
                    <Animated.View
                      style={[
                        styles.variationCard,
                        isSelected && styles.variationCardSelected,
                      ]}
                    >
                      {/* Image Container */}
                      <View style={styles.imageContainer}>
                        <OptimizedImage
                          source={{ uri: imageUrl }}
                          style={styles.variationImage}
                          contentFit="cover"
                          recyclingKey={`${index}-${imageUrl}`}
                          priority={isSelected ? 'high' : 'normal'}
                          trackLoad
                          perfLabel={`variation_${index + 1}`}
                        />
                      </View>

                      {/* Number Badge */}
                      <View style={styles.numberBadge}>
                        <Text style={styles.numberText}>{index + 1}</Text>
                      </View>

                      {/* Selected Check */}
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <LinearGradient
                            colors={[colors.gold, colors.bronze]}
                            style={styles.selectedBadgeGradient}
                          >
                            <Text style={styles.checkIcon}>✓</Text>
                          </LinearGradient>
                        </View>
                      )}

                      {/* Glow effect when selected */}
                      {isSelected && (
                        <View style={styles.selectedGlow} />
                      )}
                    </Animated.View>

                    {/* Label */}
                    <Text
                      style={[
                        styles.variationLabel,
                        isSelected && styles.variationLabelSelected,
                      ]}
                    >
                      Variation {index + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Symbolic Structure Details */}
          <Animated.View
            style={[
              styles.detailsSection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 60],
                    }),
                  },
                ],
              },
            ]}
          >
            <BlurView intensity={15} tint="dark" style={styles.detailsCard}>
              <Text style={styles.detailsLabel}>SYMBOLIC STRUCTURE</Text>
              <Text style={styles.detailsText}>
                This Anchor preserves the geometry of your intention: "{intentionText}". The unique structure holds your focus, while the aesthetic amplifies its resonance.
              </Text>
            </BlurView>
          </Animated.View>

          {/* Bottom spacer for button */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Continue Button - Fixed at bottom */}
        <Animated.View
          style={[
            styles.continueContainer,
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
            disabled={normalizedVariations.length === 0}
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
    paddingBottom: 140, // Space for fixed button + nav bar
  },
  titleSection: {
    paddingTop: 8,
    paddingBottom: 24,
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
    padding: 16,
    marginBottom: 24,
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
    marginBottom: 32,
  },
  intentionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.7,
  },
  intentionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
    position: 'relative',
    overflow: 'hidden',
  },
  intentionBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  intentionText: {
    fontSize: 17,
    fontStyle: 'italic',
    color: colors.bone,
    lineHeight: 26,
  },
  gridSection: {
    marginBottom: 24,
  },
  guidanceText: {
    fontSize: 14,
    color: colors.silver,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
    paddingHorizontal: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  variationWrapper: {
    width: IMAGE_SIZE,
  },
  variationCard: {
    width: IMAGE_SIZE,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor: colors.charcoal,
    position: 'relative',
  },
  variationCardSelected: {
    borderColor: colors.gold,
    borderWidth: 3,
  },
  imageContainer: {
    flex: 1,
  },
  variationImage: {
    width: '100%',
    height: '100%',
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
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  selectedBadgeGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.charcoal,
  },
  selectedGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  variationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.silver,
    textAlign: 'center',
    marginTop: 12,
  },
  variationLabelSelected: {
    color: colors.gold,
    fontWeight: '700',
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  detailsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.7,
  },
  detailsText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.silver,
    lineHeight: 20,
    opacity: 0.8,
  },
  bottomSpacer: {
    height: 20,
  },
  continueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 100, // Space above nav bar (80px nav + 20px padding)
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
});
