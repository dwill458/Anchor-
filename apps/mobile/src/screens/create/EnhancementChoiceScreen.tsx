import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { ScreenHeader, ZenBackground } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';

interface EnhancementOption {
  id: 'pure' | 'enhance';
  name: string;
  subtitle: string;
  description: string;
  emoji: string;
  badge?: string;
  features: string[];
  isPro?: boolean;
  estimatedTime?: string;
}



type EnhancementChoiceRouteProp = RouteProp<RootStackParamList, 'EnhancementChoice'>;
type EnhancementChoiceNavigationProp = StackNavigationProp<RootStackParamList, 'EnhancementChoice'>;

export const EnhancementChoiceScreen: React.FC = () => {
  const navigation = useNavigation<EnhancementChoiceNavigationProp>();
  const route = useRoute<EnhancementChoiceRouteProp>();
  const { anchorCount } = useAuthStore();
  const isFirstAnchor = anchorCount === 0;
  const styleCount = isFirstAnchor ? 4 : 6;

  const ENHANCEMENT_OPTIONS: EnhancementOption[] = [
    {
      id: 'enhance',
      name: 'Add Styling',
      subtitle: '',
      description: `Apply visual style to your structure. Choose from ${styleCount} artistic interpretations—watercolor, line art, geometric, and more.`,
      emoji: '✨',
      estimatedTime: '30-60 seconds',
      features: [
        `${styleCount} visual styles to choose from`,
        'Adds depth and character',
        'Takes 30-60 seconds',
      ],
    },
    {
      id: 'pure',
      name: 'Keep as Forged',
      subtitle: '',
      description: 'Keep the geometric form you traced. Clean, direct, unmodified.',
      emoji: '🔷',
      estimatedTime: 'Instant',
      features: [
        'The form you created',
        'No additional processing',
        'Ready immediately',
      ],
    },
  ];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const isNavigatingRef = useRef(false);
  const navTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  } = route.params;

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

    return () => {
      isMountedRef.current = false;
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof navigation.addListener !== 'function') return;
    const unsubscribe = navigation.addListener('focus', () => {
      isNavigatingRef.current = false;
    });

    return unsubscribe;
  }, [navigation]);

  const handleOptionSelect = (optionId: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setSelectedOption(optionId);

    // Add slight delay for visual feedback
    navTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (optionId === 'pure') {
        // Keep pure - go straight to MantraCreation with locked structure
        navigation.navigate('MantraCreation', {
          intentionText,
          category,
          distilledLetters,
          baseSigilSvg,
          reinforcedSigilSvg,
          structureVariant,
          reinforcementMetadata,
          // No enhancedImageUrl or enhancementMetadata - keeping it pure
        });
      } else if (optionId === 'enhance') {
        // Enhance appearance - navigate to AI style selection
        navigation.navigate('StyleSelection', {
          intentionText,
          category,
          distilledLetters,
          baseSigilSvg,
          reinforcedSigilSvg,
          structureVariant,
          reinforcementMetadata,
        });
      }
      setSelectedOption(null);
      isNavigatingRef.current = false;
    }, 150);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ZenBackground />

      <SafeAreaView style={styles.safeArea}>
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
            <Text style={styles.title}>Choose Appearance</Text>
            <Text style={styles.subtitle}>
              Your structure is set. Choose how it appears.
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
                  <Text style={styles.intentionText}>"{intentionText}"</Text>
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
                  <Text style={styles.intentionText}>"{intentionText}"</Text>
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
                disabled={selectedOption !== null}
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
                      option.id === 'enhance' && styles.optionCardEnhance,
                      option.id === 'pure' && styles.optionCardPure,
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
                    intensity={12}
                    tint="dark"
                    style={[
                      styles.optionCard,
                      option.id === 'enhance' && styles.optionCardEnhance,
                      option.id === 'pure' && styles.optionCardPure,
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
                <Text style={styles.infoIcon}>🔒</Text>
                <Text style={styles.infoText}>
                  Your structure is complete. Any styling you add is visual only—your foundation stays intact.
                </Text>
              </View>
            ) : (
              <BlurView intensity={8} tint="dark" style={styles.infoCard}>
                <Text style={styles.infoIcon}>🔒</Text>
                <Text style={styles.infoText}>
                  Your structure is complete. Any styling you add is visual only—your foundation stays intact.
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
};

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
      {/* Header */}
      <View style={styles.optionHeader}>
        <View style={styles.emojiContainer}>
          <LinearGradient
            colors={
              option.id === 'enhance'
                ? ['rgba(140, 100, 200, 0.4)', 'rgba(120, 80, 180, 0.3)']
                : ['rgba(80, 200, 220, 0.4)', 'rgba(60, 180, 200, 0.3)']
            }
            style={styles.emojiGradient}
          >
            <Text style={styles.emoji}>{option.emoji}</Text>
          </LinearGradient>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.optionName}>
            {option.name}
          </Text>
          {option.subtitle && (
            <Text style={styles.optionSubtitle}>
              {option.subtitle}
            </Text>
          )}
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
            isSelected && styles.arrowCircleSelected,
          ]}
        >
          <Text style={styles.arrowIcon}>
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
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  titleSection: {
    paddingTop: 64,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    // fontFamily: 'Cinzel-Regular',
    fontWeight: 'bold',
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
    // fontFamily: 'Cinzel-Regular',
    fontWeight: 'bold',
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
  optionCardEnhance: {
    borderColor: 'rgba(180, 120, 220, 0.6)',
    backgroundColor: 'rgba(80, 60, 120, 0.15)',
  },
  optionCardPure: {
    borderColor: 'rgba(80, 200, 220, 0.6)',
    backgroundColor: 'rgba(40, 80, 100, 0.15)',
  },
  optionCardSelected: {
    borderColor: colors.gold,
    transform: [{ scale: 0.98 }],
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
  arrowCircleSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  arrowIcon: {
    fontSize: 20,
    color: colors.silver,
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
