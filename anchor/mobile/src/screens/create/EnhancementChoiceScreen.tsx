import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Circle, Path } from 'react-native-svg';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { ZenBackground } from '@/components/common';
import { MicroTeachCard } from '@/components/teaching';
import { useTeachingGate } from '@/utils/useTeachingGate';
import * as Haptics from 'expo-haptics';
import { typography } from '@/theme';
import { isCompactPhoneViewport } from '@/utils/layout';

const IS_ANDROID = Platform.OS === 'android';
const OPTION_NAVIGATION_DELAY_MS = 300;

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
  const { width, height } = useWindowDimensions();
  const isCompactLayout = isCompactPhoneViewport(width, height);

  const enhancementTeaching = useTeachingGate({
    screenId: 'enhancement_choice',
    candidateIds: ['enhancement_choice_first_time_v1'],
  });

  const ENHANCEMENT_OPTIONS: EnhancementOption[] = [
    {
      id: 'enhance',
      name: 'Refine Expression',
      subtitle: 'Add visual resonance while preserving structure.',
      description: 'Choose from watercolor, line art, or geometric interpretations.',
      emoji: '✨',
      estimatedTime: 'AI-REFINED',
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
  const refinePulseAnim = useRef(new Animated.Value(1)).current;
  const optionNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedOption, setSelectedOption] = useState<EnhancementOption['id'] | null>(null);

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  } = route.params;

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('LockStructure', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
    });
  }, [
    navigation,
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });

      return () => {
        subscription.remove();
      };
    }, [handleBack])
  );

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

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(refinePulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(refinePulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      if (optionNavigationTimerRef.current) {
        clearTimeout(optionNavigationTimerRef.current);
        optionNavigationTimerRef.current = null;
      }
    };
  }, [fadeAnim, refinePulseAnim, slideAnim]);

  const createAnchorAndNavigateToCharge = () => {
    navigation.navigate('AnchorReveal', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
    });
  };

  const handleOptionSelect = (optionId: EnhancementOption['id']) => {
    if (optionNavigationTimerRef.current) {
      clearTimeout(optionNavigationTimerRef.current);
    }

    setSelectedOption(optionId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    optionNavigationTimerRef.current = setTimeout(() => {
      optionNavigationTimerRef.current = null;
      setSelectedOption(null);

      if (optionId === 'pure') {
        createAnchorAndNavigateToCharge();
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
    }, OPTION_NAVIGATION_DELAY_MS);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ZenBackground />

      <SafeAreaView style={styles.safeArea}>
        {/* Back arrow */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isCompactLayout && styles.scrollContentCompact,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <Animated.View
            style={[
              styles.titleSection,
              isCompactLayout && styles.titleSectionCompact,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.title, isCompactLayout && styles.titleCompact]}>Choose Expression</Text>
            <Text style={[styles.subtitle, isCompactLayout && styles.subtitleCompact]}>
              “Your structure is set. Choose how it speaks.”
            </Text>
          </Animated.View>

          <MicroTeachCard
            teaching={enhancementTeaching}
            screenId="enhancement_choice"
            style={{ marginHorizontal: 24, marginBottom: 16 }}
          />


          {/* Intention Card */}
          <Animated.View
            style={[
              styles.intentionSection,
              isCompactLayout && styles.intentionSectionCompact,
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
                <View style={[styles.intentionContent, isCompactLayout && styles.intentionContentCompact]}>
                  <Text style={styles.intentionLabel}>ROOTED INTENTION</Text>
                  <Text style={[styles.intentionText, isCompactLayout && styles.intentionTextCompact]}>“{intentionText}”</Text>
                  <RootedLetters letters={distilledLetters} />
                </View>
                <View style={styles.intentionBorder} />
              </View>
            ) : (
              <BlurView intensity={15} tint="dark" style={styles.intentionCard}>
                <View style={[styles.intentionContent, isCompactLayout && styles.intentionContentCompact]}>
                  <Text style={styles.intentionLabel}>ROOTED INTENTION</Text>
                  <Text style={[styles.intentionText, isCompactLayout && styles.intentionTextCompact]}>“{intentionText}”</Text>
                  <RootedLetters letters={distilledLetters} />
                </View>
                <View style={styles.intentionBorder} />
              </BlurView>
            )}
          </Animated.View>

          {/* Enhancement Options */}
          <Animated.View
            style={[
              styles.optionsSection,
              isCompactLayout && styles.optionsSectionCompact,
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
                  isCompactLayout && styles.optionCardWrapperCompact,
                ]}
                accessibilityRole="button"
                accessibilityLabel={option.name}
              >
                {option.id === 'enhance' ? (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>RECOMMENDED</Text>
                  </View>
                ) : null}
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
                    <View
                      pointerEvents="none"
                      testID={`expression-option-overlay-${option.id}`}
                      style={[
                        styles.optionInteractionOverlay,
                        selectedOption === option.id && styles.optionInteractionOverlayVisible,
                      ]}
                    />
                    <OptionCardContent
                      option={option}
                      isSelected={selectedOption === option.id}
                      refinePulseAnim={refinePulseAnim}
                      compact={isCompactLayout}
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
                    <View
                      pointerEvents="none"
                      testID={`expression-option-overlay-${option.id}`}
                      style={[
                        styles.optionInteractionOverlay,
                        selectedOption === option.id && styles.optionInteractionOverlayVisible,
                      ]}
                    />
                    <OptionCardContent
                      option={option}
                      isSelected={selectedOption === option.id}
                      refinePulseAnim={refinePulseAnim}
                      compact={isCompactLayout}
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
            <Text style={styles.footerText}>
              Styling shapes appearance only — your foundation and intention are permanent.
            </Text>
          </Animated.View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

function RootedLetters({ letters }: { letters: string[] }) {
  return (
    <ScrollView
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator={false}
      style={styles.lettersScroll}
      contentContainerStyle={styles.lettersRow}
      testID="rooted-letters-scroll"
    >
      {letters.map((letter, index) => (
        <React.Fragment key={`${letter}-${index}`}>
          <View style={styles.letterChip}>
            <Text style={styles.letterChipText}>{letter}</Text>
          </View>
          {index < letters.length - 1 ? (
            <View style={styles.letterDivider} />
          ) : null}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

function OptionCardContent({
  option,
  isSelected,
  refinePulseAnim,
  compact,
}: {
  option: EnhancementOption;
  isSelected: boolean;
  refinePulseAnim: Animated.Value;
  compact: boolean;
}) {
  const isEnhance = option.id === 'enhance';
  const isPure = option.id === 'pure';

  return (
    <View style={[
      styles.cardContent,
      compact && styles.cardContentCompact,
      isEnhance && styles.cardContentGlow
    ]}>
      {/* Header */}
      <View style={styles.optionHeader}>
        <View style={[styles.emojiContainer, compact && styles.emojiContainerCompact]}>
          <LinearGradient
            colors={
              isEnhance
                ? ['rgba(212, 175, 55, 0.3)', 'rgba(212, 175, 55, 0.1)']
                : ['rgba(192, 192, 192, 0.2)', 'rgba(192, 192, 192, 0.05)']
            }
            style={styles.emojiGradient}
          >
            {isPure ? (
              <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
                <Path
                  d="M11 3 L11 19 M6 7 L11 3 L16 7 M7 19 L15 19"
                  stroke="rgba(192,192,192,0.5)"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={11} cy={10} r={2} stroke="rgba(192,192,192,0.5)" strokeWidth={1.1} />
              </Svg>
            ) : (
              <Text style={styles.emoji}>{option.emoji}</Text>
            )}
          </LinearGradient>
        </View>

        <View style={styles.titleContainer}>
          <Text style={[
            styles.optionName,
            compact && styles.optionNameCompact,
            isPure && styles.optionNamePure,
          ]}>{option.name}</Text>
          <Text style={[styles.optionSubtitle, compact && styles.optionSubtitleCompact]}>{option.subtitle}</Text>
        </View>
      </View>

      {/* Description */}
      <Text style={[styles.optionDescriptionCompact, compact && styles.optionDescriptionCompactTight]}>{option.description}</Text>

      {/* Footer: Time + Arrow */}
      <View style={[styles.optionFooter, compact && styles.optionFooterCompact]}>
        <View style={[
          styles.timeContainerCompact,
          compact && styles.timeContainerCompactTight,
          isPure && styles.timeContainerPure,
        ]}>
          {isEnhance ? (
            <Animated.View style={[styles.timeDot, { opacity: refinePulseAnim }]} />
          ) : (
            <View style={[styles.timeDot, styles.timeDotPure]} />
          )}
          <Text style={[
            styles.timeText,
            compact && styles.timeTextCompact,
            isPure && styles.timeTextPure,
          ]}>{option.estimatedTime}</Text>
        </View>

        <View style={styles.ctaContainer}>
          <Text style={[
            styles.ctaText,
            compact && styles.ctaTextCompact,
            isEnhance && styles.ctaTextGold,
            isPure && styles.ctaTextPure,
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
  scrollContentCompact: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backArrow: {
    fontSize: 24,
    color: colors.gold,
  },
  titleSection: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  titleSectionCompact: {
    paddingTop: 0,
    paddingBottom: 18,
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
  titleCompact: {
    fontSize: 28,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    lineHeight: 24,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  subtitleCompact: {
    fontSize: 15,
    lineHeight: 21,
  },
  intentionSection: {
    marginBottom: 32,
  },
  intentionSectionCompact: {
    marginBottom: 22,
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
  intentionContentCompact: {
    padding: 18,
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
  intentionTextCompact: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 12,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  lettersScroll: {
    maxWidth: '100%',
  },
  letterChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterChipText: {
    fontSize: 12,
    fontFamily: 'Cinzel-Regular',
    fontWeight: '600',
    color: '#D4AF37',
  },
  letterDivider: {
    width: 16,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.20)',
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
  optionsSectionCompact: {
    marginBottom: 18,
  },
  optionCardWrapper: {
    marginBottom: 20,
    position: 'relative',
  },
  optionCardWrapperCompact: {
    marginBottom: 16,
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
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.55)',
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  optionCardPure: {
    borderWidth: 1,
    borderColor: 'rgba(192,192,192,0.18)',
  },
  optionCardSelected: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  optionInteractionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0,
  },
  optionInteractionOverlayVisible: {
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    opacity: 1,
  },
  cardContent: {
    padding: 24,
    position: 'relative',
    zIndex: 1,
  },
  cardContentCompact: {
    padding: 18,
  },
  cardContentGlow: {
  },
  recommendedBadge: {
    position: 'absolute',
    top: -11,
    left: 20,
    zIndex: 2,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 3,
  },
  recommendedText: {
    fontSize: 9,
    fontFamily: 'Cinzel-Regular',
    fontWeight: '700',
    letterSpacing: 2,
    color: '#0F1419',
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
  emojiContainerCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
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
  optionNameCompact: {
    fontSize: 16,
    marginBottom: 2,
  },
  optionNamePure: {
    color: 'rgba(245,245,220,0.55)',
  },
  optionSubtitle: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    lineHeight: 20,
    opacity: 0.8,
  },
  optionSubtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionDescriptionCompact: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    lineHeight: 22,
    marginBottom: 20,
    opacity: 0.7,
  },
  optionDescriptionCompactTight: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  optionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  optionFooterCompact: {
    marginTop: 4,
  },
  timeContainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timeContainerCompactTight: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeContainerPure: {
    backgroundColor: 'rgba(192,192,192,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(192,192,192,0.12)',
  },
  timeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
    backgroundColor: '#D4AF37',
  },
  timeDotPure: {
    backgroundColor: 'rgba(192,192,192,0.50)',
  },
  timeText: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: colors.silver,
    opacity: 0.8,
  },
  timeTextCompact: {
    fontSize: 11,
  },
  timeTextPure: {
    color: 'rgba(192,192,192,0.50)',
    opacity: 1,
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
  ctaTextCompact: {
    fontSize: 13,
    marginRight: 0,
  },
  ctaTextGold: {
    color: colors.gold,
  },
  ctaTextPure: {
    color: 'rgba(245,245,220,0.45)',
  },
  infoSection: {
    marginTop: 10,
    marginBottom: 30,
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'CormorantGaramond-Italic',
    color: 'rgba(245,245,220,0.30)',
    textAlign: 'center',
    paddingHorizontal: 16,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 40,
  },
});
