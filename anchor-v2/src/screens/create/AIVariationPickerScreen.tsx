/**
 * Anchor App - AI Variation Picker Screen (Redesigned)
 *
 * Step 7 in anchor creation flow (after AIGenerating).
 * User selects from 4 AI-generated anchor variations.
 *
 * Redesign Features:
 * - Proper button positioning (not covered by nav bar)
 * - Zen Architect styling (gradients, blur, gold accents)
 * - Entrance and selection animations
 * - 2x2 Grid layout
 */

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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';

// Design System Colors (Zen Architect)
// Using local definition to match the redesign spec exactly
const localColors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  silver: '#C0C0C0',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - 80) / 2; // 2 columns with proper spacing (24px padding * 2 + 16px gap)

type AIVariationPickerRouteProp = RouteProp<RootStackParamList, 'AIVariationPicker'>;
type AIVariationPickerNavigationProp = StackNavigationProp<RootStackParamList, 'AIVariationPicker'>;

export const AIVariationPickerScreen: React.FC = () => {
  const navigation = useNavigation<AIVariationPickerNavigationProp>();
  const route = useRoute<AIVariationPickerRouteProp>();

  // Extract params from route
  const { intentionText, distilledLetters, sigilSvg, variations, prompt } = route.params;

  // Selected variation index (0-3)
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

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

  const handleContinue = () => {
    const selectedImageUrl = variations[selectedIndex];

    navigation.navigate('MantraCreation', {
      intentionText,
      distilledLetters,
      sigilSvg,
      finalImageUrl: selectedImageUrl,
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
        colors={[localColors.navy, localColors.deepPurple, localColors.charcoal]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Orb Effect */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.15],
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
          <Text style={styles.headerTitle}>Choose Variation</Text>
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
              The AI has created 4 unique variations. Select the one that
              resonates most powerfully with your intention.
            </Text>
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
            <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
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
            <View style={styles.grid}>
              {variations.map((imageUrl, index) => {
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
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.variationImage}
                          resizeMode="cover"
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
                            colors={[localColors.gold, localColors.bronze]}
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

          {/* AI Generation Details - Collapsible */}
          {prompt && (
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
                <Text style={styles.detailsLabel}>AI GENERATION DETAILS</Text>
                <Text style={styles.detailsText} numberOfLines={4}>
                  {prompt}
                </Text>
              </BlurView>
            </Animated.View>
          )}

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
          >
            <LinearGradient
              colors={[localColors.gold, '#B8941F']}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueText}>
                Select Variation {selectedIndex + 1}
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
    backgroundColor: localColors.navy,
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
    backgroundColor: localColors.gold,
  },
  orb1: {
    width: 280,
    height: 280,
    top: -100,
    right: -120,
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
    color: localColors.gold,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: localColors.gold,
    letterSpacing: 0.5,
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
    color: localColors.gold,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: localColors.silver,
    lineHeight: 22,
  },
  intentionSection: {
    marginBottom: 32,
  },
  intentionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: localColors.silver,
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
    backgroundColor: localColors.gold,
  },
  intentionText: {
    fontSize: 17,
    fontStyle: 'italic',
    color: localColors.bone,
    lineHeight: 26,
  },
  gridSection: {
    marginBottom: 24,
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
    backgroundColor: localColors.charcoal,
    position: 'relative',
  },
  variationCardSelected: {
    borderColor: localColors.gold,
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
    color: localColors.gold,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: localColors.gold,
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
    color: localColors.charcoal,
  },
  selectedGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    shadowColor: localColors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  variationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: localColors.silver,
    textAlign: 'center',
    marginTop: 12,
  },
  variationLabelSelected: {
    color: localColors.gold,
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
    color: localColors.silver,
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.7,
  },
  detailsText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: localColors.silver,
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
    shadowColor: localColors.gold,
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
    color: localColors.charcoal,
    letterSpacing: 0.5,
    marginRight: 8,
  },
  continueArrow: {
    fontSize: 20,
    color: localColors.charcoal,
    fontWeight: '300',
  },
});
