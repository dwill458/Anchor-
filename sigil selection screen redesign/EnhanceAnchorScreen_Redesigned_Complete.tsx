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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';

// Design System Colors (Zen Architect)
const colors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  silver: '#C0C0C0',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
  success: '#4CAF50',
};

interface EnhancementOption {
  id: 'ai' | 'traditional' | 'manual';
  name: string;
  subtitle: string;
  description: string;
  emoji: string;
  badge?: string;
  features: string[];
  isPro?: boolean;
  estimatedTime?: string;
}

const ENHANCEMENT_OPTIONS: EnhancementOption[] = [
  {
    id: 'ai',
    name: 'AI Enhancement',
    subtitle: 'Intelligent Symbol Selection',
    description:
      'AI analyzes your intention and selects mystical symbols from ancient traditions to create 4 stunning variations.',
    emoji: '✨',
    badge: 'RECOMMENDED',
    estimatedTime: '40-80 seconds',
    features: [
      'Intelligent symbol analysis',
      '4 unique AI variations',
      'Mystical symbol integration',
      'Professional artwork quality',
    ],
  },
  {
    id: 'traditional',
    name: 'Keep Traditional',
    subtitle: 'Classic Sigil Magick',
    description:
      'Use the traditional geometric sigil created from your distilled letters. Pure, simple, powerful.',
    emoji: '📜',
    estimatedTime: 'Instant',
    features: [
      'Austin Osman Spare method',
      'Letter-based sacred geometry',
      'Instantly available',
      'Time-tested methodology',
    ],
  },
  {
    id: 'manual',
    name: 'Manual Forge',
    subtitle: 'Draw Your Own Symbol',
    description:
      'Create a completely custom anchor by hand. Full creative control with professional drawing tools.',
    emoji: '✍️',
    badge: 'PRO ONLY',
    isPro: true,
    estimatedTime: '5-15 minutes',
    features: [
      'Interactive drawing canvas',
      'Professional tools & effects',
      'Complete creative freedom',
      'Export & share options',
    ],
  },
];

interface EnhanceAnchorScreenProps {
  navigation: any;
  route: any;
}

export default function EnhanceAnchorScreen({
  navigation,
  route,
}: EnhanceAnchorScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Mock data - replace with actual data from route.params
  const intention = route.params?.intention || 'Attract abundance';
  const distilledLetters = route.params?.distilledLetters || ['T', 'R', 'C', 'T', 'B', 'N', 'D', 'N', 'C'];

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
    ]).start();
  }, []);

  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId);

    // Add slight delay for visual feedback
    setTimeout(() => {
      if (optionId === 'ai') {
        navigation.navigate('AIAnalysis', {
          intention,
          distilledLetters,
          ...route.params,
        });
      } else if (optionId === 'traditional') {
        navigation.navigate('MantraCreation', {
          intention,
          distilledLetters,
          skipAI: true,
          ...route.params,
        });
      } else if (optionId === 'manual') {
        // Check if user has Pro access
        const hasPro = false; // TODO: Check from user store
        if (!hasPro) {
          // Show Pro upgrade modal
          alert('Manual Forge requires Anchor Pro subscription');
        } else {
          navigation.navigate('ManualForge', {
            intention,
            distilledLetters,
            ...route.params,
          });
        }
      }
      setSelectedOption(null);
    }, 150);
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

      {/* Floating Orbs (iOS only for performance) */}
      {!IS_ANDROID && (
        <>
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
        </>
      )}

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
          <Text style={styles.headerTitle}>Enhance Your Anchor</Text>
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
            <Text style={styles.title}>Choose Your Path</Text>
            <Text style={styles.subtitle}>
              You've created the foundation. Now choose how to amplify your
              intention's power.
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
            {IS_ANDROID ? (
              <View style={[styles.intentionCard, styles.intentionCardAndroid]}>
                <View style={styles.intentionContent}>
                  <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
                  <Text style={styles.intentionText}>"{intention}"</Text>
                  <View style={styles.lettersRow}>
                    <Text style={styles.lettersLabel}>Letters: </Text>
                    <Text style={styles.lettersText}>{distilledLetters.join(' ')}</Text>
                  </View>
                </View>
                <View style={styles.intentionBorder} />
              </View>
            ) : (
              <BlurView intensity={10} tint="dark" style={styles.intentionCard}>
                <View style={styles.intentionContent}>
                  <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
                  <Text style={styles.intentionText}>"{intention}"</Text>
                  <View style={styles.lettersRow}>
                    <Text style={styles.lettersLabel}>Letters: </Text>
                    <Text style={styles.lettersText}>{distilledLetters.join(' ')}</Text>
                  </View>
                </View>
                <View style={styles.intentionBorder} />
              </BlurView>
            )}
          </Animated.View>

          {/* Enhancement Options */}
          <Animated.View
            style={[
              styles.optionsSection,
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
            {ENHANCEMENT_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleOptionSelect(option.id)}
                activeOpacity={0.85}
                style={[
                  styles.optionCardWrapper,
                  index === 0 && styles.firstCard,
                ]}
              >
                {IS_ANDROID ? (
                  <View
                    style={[
                      styles.optionCard,
                      styles.optionCardAndroid,
                      index === 0 && styles.optionCardRecommended,
                      selectedOption === option.id && styles.optionCardSelected,
                    ]}
                  >
                    <OptionCardContent 
                      option={option} 
                      index={index}
                      isSelected={selectedOption === option.id}
                    />
                  </View>
                ) : (
                  <BlurView
                    intensity={index === 0 ? 18 : 12}
                    tint="dark"
                    style={[
                      styles.optionCard,
                      index === 0 && styles.optionCardRecommended,
                      selectedOption === option.id && styles.optionCardSelected,
                    ]}
                  >
                    <OptionCardContent 
                      option={option} 
                      index={index}
                      isSelected={selectedOption === option.id}
                    />
                  </BlurView>
                )}
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Bottom Info */}
          <Animated.View
            style={[
              styles.infoSection,
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
            {IS_ANDROID ? (
              <View style={[styles.infoCard, styles.infoCardAndroid]}>
                <Text style={styles.infoIcon}>💡</Text>
                <Text style={styles.infoText}>
                  You can always regenerate or try different approaches later.
                  Each path creates a unique expression of your intention.
                </Text>
              </View>
            ) : (
              <BlurView intensity={8} tint="dark" style={styles.infoCard}>
                <Text style={styles.infoIcon}>💡</Text>
                <Text style={styles.infoText}>
                  You can always regenerate or try different approaches later.
                  Each path creates a unique expression of your intention.
                </Text>
              </BlurView>
            )}
          </Animated.View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// Extracted component for option card content
function OptionCardContent({ 
  option, 
  index,
  isSelected 
}: { 
  option: EnhancementOption; 
  index: number;
  isSelected: boolean;
}) {
  return (
    <>
      {/* Badge */}
      {option.badge && (
        <View
          style={[
            styles.badge,
            option.isPro ? styles.badgePro : styles.badgeRecommended,
          ]}
        >
          <Text style={styles.badgeText}>{option.badge}</Text>
        </View>
      )}

      {/* Glow effect for recommended */}
      {index === 0 && <View style={styles.recommendedGlow} />}

      {/* Header */}
      <View style={styles.optionHeader}>
        <View style={styles.emojiContainer}>
          <LinearGradient
            colors={
              index === 0
                ? [colors.gold, colors.bronze]
                : index === 1
                ? ['rgba(192, 192, 192, 0.3)', 'rgba(158, 158, 158, 0.2)']
                : [colors.deepPurple, 'rgba(62, 44, 91, 0.5)']
            }
            style={styles.emojiGradient}
          >
            <Text style={styles.emoji}>{option.emoji}</Text>
          </LinearGradient>
        </View>

        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.optionName,
              index === 0 && styles.optionNameRecommended,
            ]}
          >
            {option.name}
          </Text>
          <Text style={styles.optionSubtitle}>
            {option.subtitle}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.optionDescription}>
        {option.description}
      </Text>

      {/* Features */}
      <View style={styles.featuresContainer}>
        {option.features.map((feature, idx) => (
          <View key={idx} style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Time estimate */}
      {option.estimatedTime && (
        <View style={styles.timeContainer}>
          <Text style={styles.timeIcon}>⏱</Text>
          <Text style={styles.timeText}>{option.estimatedTime}</Text>
        </View>
      )}

      {/* Arrow */}
      <View style={styles.arrowContainer}>
        <View
          style={[
            styles.arrowCircle,
            index === 0 && styles.arrowCircleGold,
            isSelected && styles.arrowCircleSelected,
          ]}
        >
          <Text
            style={[
              styles.arrowIcon,
              index === 0 && styles.arrowIconGold,
            ]}
          >
            →
          </Text>
        </View>
      </View>
    </>
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
    paddingBottom: 100,
  },
  titleSection: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
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
    marginBottom: 32,
  },
  intentionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
    position: 'relative',
  },
  intentionCardAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  intentionContent: {
    padding: 20,
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
    fontSize: 18,
    fontStyle: 'italic',
    color: colors.bone,
    lineHeight: 26,
    marginBottom: 12,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lettersLabel: {
    fontSize: 12,
    color: colors.silver,
    opacity: 0.7,
  },
  lettersText: {
    fontSize: 12,
    fontFamily: 'Cinzel-Regular',
    color: colors.gold,
    letterSpacing: 2,
  },
  intentionBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  optionsSection: {
    marginBottom: 24,
  },
  optionCardWrapper: {
    marginBottom: 20,
  },
  firstCard: {
    marginBottom: 24,
  },
  optionCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
    position: 'relative',
  },
  optionCardAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.85)',
  },
  optionCardRecommended: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  optionCardSelected: {
    borderColor: colors.gold,
    transform: [{ scale: 0.98 }],
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
  },
  badgeRecommended: {
    backgroundColor: colors.gold,
  },
  badgePro: {
    backgroundColor: colors.deepPurple,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emojiContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emojiGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  titleContainer: {
    flex: 1,
  },
  optionName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.bone,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  optionNameRecommended: {
    color: colors.gold,
  },
  optionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.silver,
    opacity: 0.8,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.silver,
    lineHeight: 21,
    marginBottom: 16,
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureBullet: {
    fontSize: 16,
    color: colors.gold,
    marginRight: 12,
    marginTop: -2,
  },
  featureText: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 19,
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 4,
  },
  timeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  timeText: {
    fontSize: 13,
    color: colors.silver,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  arrowContainer: {
    alignItems: 'flex-end',
  },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  arrowCircleGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderColor: colors.gold,
  },
  arrowCircleSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  arrowIcon: {
    fontSize: 20,
    color: colors.silver,
  },
  arrowIconGold: {
    color: colors.gold,
  },
  recommendedGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.1)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
    alignItems: 'flex-start',
  },
  infoCardAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.85)',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: -2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.silver,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 20,
  },
});
