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
import * as Haptics from 'expo-haptics';
import { typography } from '@/theme';

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
      name: 'Refine Expression',
      subtitle: 'Add visual resonance while preserving structure.',
      description: 'Choose from watercolor, line art, or geometric interpretations.',
      emoji: '✨',
      estimatedTime: '~30–60 seconds',
      features: [],
      badge: 'Refine Anchor →',
    },
    {
      id: 'pure',
      name: 'Keep as Forged',
      subtitle: 'The clean, minimal form you created.',
      description: 'Focus-first option. Pure geometry.',
      emoji: '🔷',
      estimatedTime: 'Instant',
      features: [],
      badge: 'Set Anchor →',
    },
  ];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

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
  }, []);

  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Add slight delay for visual feedback
    setTimeout(() => {
      if (optionId === 'pure') {
        navigation.navigate('MantraCreation', {
          intentionText,
          category,
          distilledLetters,
          baseSigilSvg,
          reinforcedSigilSvg,
          structureVariant,
          reinforcementMetadata,
        });
      } else if (optionId === 'enhance') {
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
    }, 300);
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
          {/* Header Section */}
          <Animated.View
            style={[
              styles.titleSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.title}>Choose Expression</Text>
            <Text style={styles.subtitle}>
              “Your structure is set. Choose how it speaks.”
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
                  <Text style={styles.intentionLabel}>ROOTED INTENTION</Text>
                  <Text style={styles.intentionText}>“{intentionText}”</Text>
                  <View style={styles.lettersRow}>
                    <Text style={styles.lettersText}>
                      {distilledLetters.join('  ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.intentionBorder} />
              </View>
            ) : (
              <BlurView intensity={15} tint="dark" style={styles.intentionCard}>
                <View style={styles.intentionContent}>
                  <Text style={styles.intentionLabel}>ROOTED INTENTION</Text>
                  <Text style={styles.intentionText}>“{intentionText}”</Text>
                  <View style={styles.lettersRow}>
                    <Text style={styles.lettersText}>
                      {distilledLetters.join('  ')}
                    </Text>
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
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>🔒</Text>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Structure locked</Text>
                <Text style={styles.infoText}>
                  “Styling affects appearance only. Your foundation and intention remain unchanged.”
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

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
    <View style={[
      styles.cardContent,
      option.id === 'enhance' && styles.cardContentGlow
    ]}>
      {/* Header */}
      <View style={styles.optionHeader}>
        <View style={styles.emojiContainer}>
          <LinearGradient
            colors={
              option.id === 'enhance'
                ? ['rgba(212, 175, 55, 0.3)', 'rgba(212, 175, 55, 0.1)']
                : ['rgba(192, 192, 192, 0.2)', 'rgba(192, 192, 192, 0.05)']
            }
            style={styles.emojiGradient}
          >
            <Text style={styles.emoji}>{option.emoji}</Text>
          </LinearGradient>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.optionName}>{option.name}</Text>
          <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.optionDescriptionCompact}>{option.description}</Text>

      {/* Footer: Time + Arrow */}
      <View style={styles.optionFooter}>
        <View style={styles.timeContainerCompact}>
          <Text style={styles.timeIcon}>⏱</Text>
          <Text style={styles.timeText}>{option.estimatedTime}</Text>
        </View>

        <View style={styles.ctaContainer}>
          <Text style={[
            styles.ctaText,
            option.id === 'enhance' && styles.ctaTextGold
          ]}>
            {option.badge}
          </Text>
        </View>
      </View>
    </View>
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
    paddingBottom: 40,
  },
  titleSection: {
    paddingTop: 50,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontFamily: typography.fonts.heading,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    lineHeight: 24,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  intentionSection: {
    marginBottom: 32,
  },
  intentionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
    position: 'relative',
  },
  intentionCardAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  intentionContent: {
    padding: 24,
  },
  intentionLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: typography.fonts.body,
    color: colors.silver,
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.5,
  },
  intentionText: {
    fontSize: 22,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    lineHeight: 32,
    marginBottom: 16,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lettersText: {
    fontSize: 13,
    fontFamily: typography.fonts.mono,
    color: colors.gold,
    letterSpacing: 4,
    opacity: 0.5,
  },
  intentionBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
    opacity: 0.6,
  },
  optionsSection: {
    marginBottom: 24,
  },
  optionCardWrapper: {
    marginBottom: 20,
  },
  firstCard: {
    marginBottom: 20,
  },
  optionCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  optionCardAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.95)',
  },
  optionCardEnhance: {
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  optionCardPure: {
    borderColor: 'rgba(192, 192, 192, 0.1)',
  },
  optionCardSelected: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  cardContent: {
    padding: 24,
  },
  cardContentGlow: {
    backgroundColor: 'rgba(212, 175, 55, 0.02)',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emojiContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 16,
    overflow: 'hidden',
  },
  emojiGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  titleContainer: {
    flex: 1,
  },
  optionName: {
    fontSize: 20,
    fontFamily: typography.fonts.heading,
    fontWeight: '700',
    color: colors.bone,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  optionSubtitle: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    lineHeight: 20,
    opacity: 0.8,
  },
  optionDescriptionCompact: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    lineHeight: 22,
    marginBottom: 20,
    opacity: 0.7,
  },
  optionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timeContainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timeIcon: {
    fontSize: 14,
    marginRight: 6,
    opacity: 0.8,
  },
  timeText: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    opacity: 0.8,
  },
  ctaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: colors.silver,
    marginRight: 8,
    opacity: 0.9,
  },
  ctaTextGold: {
    color: colors.gold,
  },
  infoSection: {
    marginTop: 10,
    marginBottom: 30,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 16,
    opacity: 0.6,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: colors.bone,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoText: {
    fontSize: 13,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    lineHeight: 18,
    fontStyle: 'italic',
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 40,
  },
});
