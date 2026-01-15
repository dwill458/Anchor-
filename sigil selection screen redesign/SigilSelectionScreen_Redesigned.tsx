import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design System Colors (Zen Architect)
const colors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  silver: '#C0C0C0',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
};

type SigilStyle = 'dense' | 'balanced' | 'minimal';

interface StyleOption {
  id: SigilStyle;
  name: string;
  description: string;
  aesthetic: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'dense',
    name: 'Dense',
    description: 'Bold and powerful, maximum visual impact',
    aesthetic: 'Geometric · Angular · Bold',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Harmonious blend of strength and clarity',
    aesthetic: 'Classic · Elegant · Traditional',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and focused, subtle elegance',
    aesthetic: 'Simplified · Abstract · Essential',
  },
];

interface SigilSelectionScreenProps {
  navigation: any;
  route: any;
}

export default function SigilSelectionScreen({
  navigation,
  route,
}: SigilSelectionScreenProps) {
  const [selectedStyle, setSelectedStyle] = useState<SigilStyle>('balanced');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Mock data - replace with actual data from route.params
  const intention = route.params?.intention || 'I excel in my career';
  const distilledLetters = ['X', 'C', 'L', 'N', 'M', 'Y', 'R'];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStyleSelect = (style: SigilStyle) => {
    setSelectedStyle(style);
    // Small scale animation on selection
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleContinue = () => {
    navigation.navigate('EnhancementChoice', {
      intention,
      selectedStyle,
      distilledLetters,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Animated Background */}
      <LinearGradient
        colors={[colors.navy, colors.deepPurple, colors.charcoal]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Orbs */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.12],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.08],
            }),
          },
        ]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Your Symbol</Text>
          <View style={styles.backButton} />
        </View>

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
            <Text style={styles.title}>Choose Your Anchor</Text>
            <Text style={styles.subtitle}>
              Each style creates a unique visual expression of your intention.
              Select the one that resonates with you.
            </Text>
          </Animated.View>

          {/* Intention Card - Compact */}
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
            <BlurView intensity={10} tint="dark" style={styles.intentionCard}>
              <View style={styles.intentionContent}>
                <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
                <Text style={styles.intentionText}>"{intention}"</Text>
              </View>
              <View style={styles.intentionBorder} />
            </BlurView>
          </Animated.View>

          {/* Distilled Letters - Flowing Pills */}
          <Animated.View
            style={[
              styles.lettersSection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 45],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>DISTILLED LETTERS</Text>
            <View style={styles.lettersContainer}>
              {distilledLetters.map((letter, index) => (
                <View key={index} style={styles.letterPill}>
                  <LinearGradient
                    colors={[
                      'rgba(212, 175, 55, 0.2)',
                      'rgba(212, 175, 55, 0.05)',
                    ]}
                    style={styles.letterGradient}
                  >
                    <Text style={styles.letterText}>{letter}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Large Sigil Preview */}
          <Animated.View
            style={[
              styles.previewSection,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 50],
                    }),
                  },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <BlurView intensity={8} tint="dark" style={styles.previewCard}>
              <View style={styles.previewContainer}>
                {/* TODO: Replace with actual SVG sigil */}
                <LinearGradient
                  colors={[colors.gold, colors.bronze]}
                  style={styles.sigilPlaceholder}
                >
                  <Text style={styles.sigilEmoji}>⚓</Text>
                </LinearGradient>
              </View>
              
              {/* Style Badge */}
              <View style={styles.styleBadge}>
                <LinearGradient
                  colors={[colors.gold, colors.bronze]}
                  style={styles.styleBadgeGradient}
                >
                  <Text style={styles.styleBadgeText}>
                    {selectedStyle.toUpperCase()}
                  </Text>
                </LinearGradient>
              </View>
            </BlurView>
          </Animated.View>

          {/* Style Options */}
          <Animated.View
            style={[
              styles.stylesSection,
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
            <Text style={styles.sectionLabel}>SELECT STYLE</Text>
            {STYLE_OPTIONS.map((style, index) => (
              <TouchableOpacity
                key={style.id}
                onPress={() => handleStyleSelect(style.id)}
                activeOpacity={0.8}
                style={styles.styleOptionWrapper}
              >
                <BlurView
                  intensity={selectedStyle === style.id ? 18 : 10}
                  tint="dark"
                  style={[
                    styles.styleCard,
                    selectedStyle === style.id && styles.styleCardSelected,
                  ]}
                >
                  {/* Mini Preview Circle */}
                  <View style={styles.miniPreview}>
                    <LinearGradient
                      colors={
                        selectedStyle === style.id
                          ? [colors.gold, colors.bronze]
                          : ['rgba(192, 192, 192, 0.3)', 'rgba(158, 158, 158, 0.2)']
                      }
                      style={styles.miniPreviewGradient}
                    >
                      {/* TODO: Replace with actual mini sigil */}
                      <Text style={styles.miniSigilEmoji}>⚓</Text>
                    </LinearGradient>
                  </View>

                  {/* Style Info */}
                  <View style={styles.styleInfo}>
                    <Text
                      style={[
                        styles.styleName,
                        selectedStyle === style.id && styles.styleNameSelected,
                      ]}
                    >
                      {style.name}
                    </Text>
                    <Text style={styles.styleDescription}>
                      {style.description}
                    </Text>
                    <View style={styles.aestheticTags}>
                      {style.aesthetic.split(' · ').map((tag, i) => (
                        <View key={i} style={styles.aestheticTag}>
                          <Text style={styles.aestheticText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Selection Indicator */}
                  <View style={styles.selectionIndicator}>
                    {selectedStyle === style.id ? (
                      <View style={styles.selectedCircle}>
                        <LinearGradient
                          colors={[colors.gold, colors.bronze]}
                          style={styles.selectedCircleGradient}
                        >
                          <Text style={styles.checkIcon}>✓</Text>
                        </LinearGradient>
                      </View>
                    ) : (
                      <View style={styles.unselectedCircle} />
                    )}
                  </View>

                  {/* Glow Effect */}
                  {selectedStyle === style.id && (
                    <View style={styles.selectedGlow} />
                  )}
                </BlurView>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Continue Button - Fixed */}
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
          >
            <LinearGradient
              colors={[colors.gold, '#B8941F']}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueText}>
                Continue with {selectedStyle}
              </Text>
              <Text style={styles.continueArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: colors.gold,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gold,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  titleSection: {
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
    position: 'relative',
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
    position: 'relative',
  },
  previewContainer: {
    aspectRatio: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sigilPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 200,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  sigilEmoji: {
    fontSize: 96,
    opacity: 0.8,
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
  stylesSection: {
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
    position: 'relative',
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
  },
  miniSigilEmoji: {
    fontSize: 32,
    opacity: 0.8,
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
    marginBottom: 8,
  },
  aestheticTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aestheticTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
  },
  aestheticText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.silver,
    opacity: 0.8,
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
  bottomSpacer: {
    height: 20,
  },
  continueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 100,
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
