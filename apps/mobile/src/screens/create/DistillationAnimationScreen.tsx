import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme';

type DistillationAnimationRouteProp = RouteProp<RootStackParamList, 'DistillationAnimation'>;
type DistillationAnimationNavigationProp = StackNavigationProp<RootStackParamList, 'DistillationAnimation'>;

/**
 * DistillationAnimationScreen
 *
 * A calm, ritualistic visualization of intention distillation.
 * Transforms written intention into symbolic letters through gentle,
 * inevitable motion—never mechanical or forced.
 *
 * Phase 0: Rest - Full intention appears with gentle breath (2s)
 * Phase 1: Vowel Fade - Vowels dissolve individually (3s)
 * Phase 2: Consonant Merge - Duplicates drift together magnetically (3.5s)
 * Phase 3: Drift Inward - Letters converge toward center (3s)
 * Phase 4: Settle & Resolve - Final glyph settles into stillness (3.5s)
 *
 * Total duration: ~15 seconds
 * Design tone: Zen, ritualistic, minimal, premium
 */
interface LetterState {
  char: string;
  index: number;
  isVowel: boolean;
  isDuplicate: boolean;
  opacity: Animated.Value;
  translateX: Animated.Value;
  translateY: Animated.Value;
  scale: Animated.Value;
}

export default function DistillationAnimationScreen() {
  const route = useRoute<DistillationAnimationRouteProp>();
  const navigation = useNavigation<DistillationAnimationNavigationProp>();

  const { intentionText, category, distilledLetters } = route.params;

  const [currentPhase, setCurrentPhase] = useState(0);
  const [letters, setLetters] = useState<LetterState[]>([]);

  // Global animation values
  const breathAnim = useRef(new Animated.Value(1)).current;
  const phaseLabelScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const letterSpacing = useRef(new Animated.Value(12)).current;
  const finalScale = useRef(new Animated.Value(1)).current;
  const finalColor = useRef(new Animated.Value(0)).current;

  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']);

  // Initialize letter states
  useEffect(() => {
    const chars = intentionText.split('');
    const seen = new Set<string>();

    const letterStates: LetterState[] = chars.map((char, index) => {
      const isVowel = VOWELS.has(char);
      const upper = char.toUpperCase();
      const isDuplicate = /[a-zA-Z]/.test(char) && seen.has(upper) && !isVowel;

      if (/[a-zA-Z]/.test(char) && !isVowel) {
        seen.add(upper);
      }

      return {
        char,
        index,
        isVowel,
        isDuplicate,
        opacity: new Animated.Value(1),
        translateX: new Animated.Value(0),
        translateY: new Animated.Value(0),
        scale: new Animated.Value(1),
      };
    });

    setLetters(letterStates);
  }, [intentionText]);

  // Gentle breath animation for initial text
  const animateBreath = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.015,
          duration: 1000,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Pulse animation for phase labels
  const pulsePhaseLabel = () => {
    Animated.sequence([
      Animated.timing(phaseLabelScale, {
        toValue: 1.05,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(phaseLabelScale, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Phase 1: Fade out vowels individually
  const fadeVowels = () => {
    const vowelAnimations = letters
      .filter(letter => letter.isVowel)
      .map((letter, idx) =>
        Animated.sequence([
          Animated.delay(idx * 100), // Stagger
          Animated.timing(letter.opacity, {
            toValue: 0,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      );

    Animated.parallel(vowelAnimations).start();
  };

  // Phase 2: Merge duplicate consonants
  const mergeDuplicates = () => {
    const duplicates = letters.filter(l => l.isDuplicate);

    const mergeAnimations = duplicates.map((duplicate, idx) => {
      // Find first occurrence of this letter
      const firstOccurrence = letters.find(
        l => !l.isVowel && !l.isDuplicate &&
        l.char.toUpperCase() === duplicate.char.toUpperCase()
      );

      if (!firstOccurrence) return null;

      // Calculate drift direction (simplified - move left/right based on position)
      const driftX = (firstOccurrence.index - duplicate.index) * 20;

      return Animated.sequence([
        Animated.delay(idx * 150), // Stagger
        Animated.parallel([
          Animated.timing(duplicate.translateX, {
            toValue: driftX,
            duration: 1200,
            easing: Easing.inOut(Easing.sine),
            useNativeDriver: true,
          }),
          Animated.timing(duplicate.opacity, {
            toValue: 0,
            duration: 300,
            delay: 900, // Fade out in final 300ms
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]);
    }).filter(Boolean);

    Animated.parallel(mergeAnimations as Animated.CompositeAnimation[]).start();
  };

  // Phase 3: Drift letters inward
  const driftInward = () => {
    const visibleLetters = letters.filter(l => !l.isVowel && !l.isDuplicate);

    const driftAnimations = visibleLetters.map((letter, idx) => {
      // Drift toward center with slight variation
      const driftAmount = (idx - visibleLetters.length / 2) * -8;

      return Animated.parallel([
        Animated.timing(letter.translateX, {
          toValue: driftAmount,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(letter.scale, {
          toValue: 0.95,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
    });

    // Also reduce letter spacing
    Animated.parallel([
      ...driftAnimations,
      Animated.timing(letterSpacing, {
        toValue: 4,
        duration: 1500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Phase 4: Settle into final glyph
  const settleFinal = () => {
    Animated.parallel([
      // Merge letter spacing to 0
      Animated.timing(letterSpacing, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      // Scale up to final size
      Animated.timing(finalScale, {
        toValue: 1.15,
        duration: 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Transition to gold color
      Animated.timing(finalColor, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Start gentle glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sine),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.sine),
            useNativeDriver: false,
          }),
        ])
      ).start();
    });
  };

  // Phase orchestration
  useEffect(() => {
    if (letters.length === 0) return;

    const phases = [
      // Phase 0: Rest with gentle breath (2s)
      {
        duration: 2000,
        haptic: Haptics.ImpactFeedbackStyle.Light,
        action: () => {
          animateBreath();
          pulsePhaseLabel();
        },
      },
      // Phase 1: Vowel Fade (3s)
      {
        duration: 3000,
        haptic: Haptics.ImpactFeedbackStyle.Light,
        action: () => {
          fadeVowels();
          pulsePhaseLabel();
        },
      },
      // Phase 2: Consonant Merge (3.5s)
      {
        duration: 3500,
        haptic: Haptics.ImpactFeedbackStyle.Medium,
        action: () => {
          mergeDuplicates();
          pulsePhaseLabel();
        },
      },
      // Phase 3: Drift Inward (3s)
      {
        duration: 3000,
        haptic: Haptics.ImpactFeedbackStyle.Medium,
        action: () => {
          driftInward();
          pulsePhaseLabel();
        },
      },
      // Phase 4: Settle & Resolve (3.5s)
      {
        duration: 3500,
        haptic: Haptics.ImpactFeedbackStyle.Heavy,
        action: () => {
          settleFinal();
          pulsePhaseLabel();
        },
      },
    ];

    let phaseIndex = 0;
    let timeout: NodeJS.Timeout;

    const runPhase = () => {
      if (phaseIndex >= phases.length) {
        // All phases complete - navigate to StructureForge
        setTimeout(() => {
          navigation.navigate('StructureForge', {
            intentionText,
            category,
            distilledLetters,
          });
        }, 500);
        return;
      }

      const phase = phases[phaseIndex];
      setCurrentPhase(phaseIndex);

      // Trigger haptic feedback
      Haptics.impactAsync(phase.haptic);

      // Run phase action
      phase.action();

      // Schedule next phase
      timeout = setTimeout(() => {
        phaseIndex++;
        runPhase();
      }, phase.duration);
    };

    // Start the sequence
    runPhase();

    return () => {
      clearTimeout(timeout);
      breathAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, [letters, intentionText, category, distilledLetters, navigation]);

  const phaseLabels = [
    'Your Intention',
    'Removing the Inessential',
    'Unifying Essence',
    'Converging Symbol',
    'Your Anchor',
  ];

  // Interpolations for final phase
  const textColor = finalColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text.primary, colors.gold],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.5],
  });

  const glowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 20],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, '#1A1625', colors.background.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Phase Label */}
          <Animated.View
            style={[
              styles.phaseLabelContainer,
              { transform: [{ scale: phaseLabelScale }] },
            ]}
          >
            <Text style={styles.phaseLabel}>{phaseLabels[currentPhase]}</Text>
          </Animated.View>

          {/* Animated Letter Display */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                transform: [
                  { scale: currentPhase <= 1 ? breathAnim : finalScale },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.textGlow,
                currentPhase >= 4 && {
                  shadowColor: colors.gold,
                  shadowOpacity: glowOpacity,
                  shadowRadius: glowRadius,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              <View style={styles.letterRow}>
                {currentPhase <= 2 ? (
                  // Phase 0-2: Render full text with individual letter animations
                  letters.map((letter, idx) => (
                    <Animated.Text
                      key={idx}
                      style={[
                        currentPhase <= 1 ? styles.displayTextSentence : styles.displayTextLetters,
                        {
                          opacity: letter.opacity,
                          transform: [
                            { translateX: letter.translateX },
                            { translateY: letter.translateY },
                            { scale: letter.scale },
                          ],
                        },
                      ]}
                    >
                      {letter.char}
                    </Animated.Text>
                  ))
                ) : (
                  // Phase 3-4: Render only visible letters (distilled)
                  <Animated.Text
                    style={[
                      currentPhase === 3 ? styles.displayTextLetters : styles.displayTextMerged,
                      currentPhase >= 4 && { color: textColor },
                      { letterSpacing },
                    ]}
                  >
                    {distilledLetters.join('')}
                  </Animated.Text>
                )}
              </View>
            </Animated.View>
          </Animated.View>

          {/* Progress Dots */}
          <View style={styles.progressContainer}>
            {phaseLabels.map((_, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentPhase && styles.progressDotActive,
                  index < currentPhase && styles.progressDotComplete,
                ]}
              />
            ))}
          </View>

          {/* Mystical Subtitle */}
          <Text style={styles.subtitle}>The Technology of Forgetting</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  phaseLabelContainer: {
    marginBottom: 64,
  },
  phaseLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    color: colors.gold,
    textAlign: 'center',
    letterSpacing: 1,
  },
  textContainer: {
    width: '100%',
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  textGlow: {
    elevation: 20,
  },
  letterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '90%',
  },
  displayTextSentence: {
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    lineHeight: 40,
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  displayTextLetters: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 36,
    color: colors.text.primary,
    letterSpacing: 12,
    textAlign: 'center',
  },
  displayTextMerged: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 48,
    color: colors.gold,
    letterSpacing: 0,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 64,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.deepPurple,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: colors.gold,
  },
  progressDotComplete: {
    backgroundColor: colors.silver,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 32,
    fontStyle: 'italic',
  },
});
