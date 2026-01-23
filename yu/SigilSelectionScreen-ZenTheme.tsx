import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { RootStackParamList, AnchorCategory } from '@/types';
import {
  generateAllVariants,
  SigilVariant,
  SigilGenerationResult,
  VARIANT_METADATA,
} from '@/utils/sigil/abstract-symbol-generator';

type SigilSelectionRouteProp = RouteProp<RootStackParamList, 'SigilSelection'>;
type SigilSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'SigilSelection'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Zen Architect Colors
const colors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
};

/**
 * SigilSelectionScreen - Zen Architect Theme
 * 
 * Displays three abstract symbol variants with premium glassmorphic UI
 */
export default function SigilSelectionScreen() {
  const route = useRoute<SigilSelectionRouteProp>();
  const navigation = useNavigation<SigilSelectionNavigationProp>();

  const { intentionText, category, distilledLetters } = route.params;

  const [variants, setVariants] = useState<SigilGenerationResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<SigilVariant>('balanced');
  const [loading, setLoading] = useState(true);

  // Animations
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.9);

  useEffect(() => {
    // Generate variants
    const generated = generateAllVariants(distilledLetters);
    setVariants(generated);
    setLoading(false);

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [distilledLetters]);

  const handleContinue = () => {
    const selected = variants.find(v => v.variant === selectedVariant);
    if (!selected) return;

    // TODO: Navigate to next screen
    console.log('Selected variant:', selectedVariant);
    console.log('SVG:', selected.svg);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.navy, colors.deepPurple, colors.charcoal]}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <SafeAreaView style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Crafting your symbols...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <LinearGradient
        colors={[colors.navy, colors.deepPurple, colors.charcoal]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Orbs */}
      <Animated.View style={[styles.orb, styles.orb1, { opacity: 0.12 }]} />
      <Animated.View style={[styles.orb, styles.orb2, { opacity: 0.08 }]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <Text style={styles.title}>Choose Your Anchor</Text>
            <Text style={styles.subtitle}>
              Each symbol is a unique expression of your intention
            </Text>
          </Animated.View>

          {/* Intention Card - Compact */}
          <Animated.View style={[styles.intentionSection, { opacity: fadeAnim }]}>
            <BlurView intensity={10} tint="dark" style={styles.intentionCard}>
              <View style={styles.intentionContent}>
                <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
                <Text style={styles.intentionText}>"{intentionText}"</Text>
              </View>
              <View style={styles.intentionBorder} />
            </BlurView>
          </Animated.View>

          {/* Distilled Letters */}
          <Animated.View style={[styles.lettersSection, { opacity: fadeAnim }]}>
            <Text style={styles.sectionLabel}>DISTILLED LETTERS</Text>
            <View style={styles.lettersContainer}>
              {distilledLetters.map((letter, index) => (
                <View key={index} style={styles.letterPill}>
                  <LinearGradient
                    colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']}
                    style={styles.letterGradient}
                  >
                    <Text style={styles.letterText}>{letter}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Large Preview */}
          <Animated.View
            style={[
              styles.previewSection,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <BlurView intensity={8} tint="dark" style={styles.previewCard}>
              <View style={styles.previewContainer}>
                {variants.find(v => v.variant === selectedVariant) && (
                  <SvgXml
                    xml={variants.find(v => v.variant === selectedVariant)!.svg}
                    width="85%"
                    height="85%"
                    color={colors.gold}
                  />
                )}
              </View>

              {/* Style Badge */}
              <View style={styles.styleBadge}>
                <LinearGradient colors={[colors.gold, colors.bronze]} style={styles.styleBadgeGradient}>
                  <Text style={styles.styleBadgeText}>{selectedVariant.toUpperCase()}</Text>
                </LinearGradient>
              </View>
            </BlurView>
          </Animated.View>

          {/* Variant Selection Cards */}
          <Animated.View style={[styles.variantsSection, { opacity: fadeAnim }]}>
            <Text style={styles.sectionLabel}>SELECT STYLE</Text>

            {variants.map(result => {
              const metadata = VARIANT_METADATA[result.variant];
              const isSelected = result.variant === selectedVariant;

              return (
                <TouchableOpacity
                  key={result.variant}
                  onPress={() => setSelectedVariant(result.variant)}
                  activeOpacity={0.8}
                  style={styles.styleOptionWrapper}
                >
                  <BlurView
                    intensity={isSelected ? 18 : 10}
                    tint="dark"
                    style={[styles.styleCard, isSelected && styles.styleCardSelected]}
                  >
                    {/* Mini Preview */}
                    <View style={styles.miniPreview}>
                      <LinearGradient colors={[colors.gold, colors.bronze]} style={styles.miniPreviewGradient}>
                        <SvgXml xml={result.svg} width="100%" height="100%" color={colors.charcoal} />
                      </LinearGradient>
                    </View>

                    {/* Style Info */}
                    <View style={styles.styleInfo}>
                      <Text style={[styles.styleName, isSelected && styles.styleNameSelected]}>
                        {metadata.title}
                      </Text>
                      <Text style={styles.styleDescription}>{metadata.description}</Text>
                    </View>

                    {/* Selection Indicator */}
                    <View style={styles.selectionIndicator}>
                      {isSelected ? (
                        <View style={styles.selectedCircle}>
                          <LinearGradient colors={[colors.gold, colors.bronze]} style={styles.selectedCircleGradient}>
                            <Text style={styles.checkIcon}>✓</Text>
                          </LinearGradient>
                        </View>
                      ) : (
                        <View style={styles.unselectedCircle} />
                      )}
                    </View>

                    {/* Glow effect when selected */}
                    {isSelected && <View style={styles.selectedGlow} />}
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.continueContainer}>
          <TouchableOpacity onPress={handleContinue} activeOpacity={0.9} style={styles.continueButton}>
            <LinearGradient colors={[colors.gold, colors.bronze]} style={styles.continueGradient}>
              <Text style={styles.continueText}>Continue</Text>
              <Text style={styles.continueArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: 300,
    backgroundColor: colors.gold,
  },
  orb1: {
    width: 280,
    height: 280,
    top: -80,
    right: -100,
  },
  orb2: {
    width: 220,
    height: 220,
    bottom: 200,
    left: -60,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    color: colors.gold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Cinzel-Regular',
    color: colors.gold,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.silver,
    lineHeight: 22,
  },
  intentionSection: {
    marginBottom: 24,
  },
  intentionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
  },
  intentionContent: {
    padding: 16,
  },
  intentionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1.2,
    marginBottom: 8,
    opacity: 0.6,
  },
  intentionText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.bone,
    lineHeight: 22,
  },
  intentionBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  lettersSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1.5,
    marginBottom: 16,
    opacity: 0.7,
  },
  lettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  letterPill: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  letterGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
  },
  letterText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1,
  },
  previewSection: {
    marginBottom: 32,
  },
  previewCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  previewContainer: {
    aspectRatio: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  styleBadge: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  styleBadgeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  styleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 1.5,
  },
  variantsSection: {
    marginBottom: 24,
  },
  styleOptionWrapper: {
    marginBottom: 16,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  styleCardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  miniPreview: {
    width: 64,
    height: 64,
    marginRight: 16,
    borderRadius: 32,
    overflow: 'hidden',
  },
  miniPreviewGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  styleInfo: {
    flex: 1,
  },
  styleName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.bone,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  styleNameSelected: {
    color: colors.gold,
  },
  styleDescription: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 18,
  },
  selectionIndicator: {
    marginLeft: 12,
  },
  selectedCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectedCircleGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal,
  },
  unselectedCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.3)',
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
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  continueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
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
    fontSize: 17,
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
