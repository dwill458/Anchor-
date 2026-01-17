import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '@/types';

type DistillationAnimationRouteProp = RouteProp<RootStackParamList, 'DistillationAnimation'>;
type DistillationAnimationNavigationProp = StackNavigationProp<RootStackParamList, 'DistillationAnimation'>;

/**
 * DistillationAnimationScreen
 * 
 * Visualizes the Austin Osman Spare letter distillation process:
 * Phase 1: Remove vowels (2s)
 * Phase 2: Remove duplicates (2s)
 * Phase 3: Rotate/overlap letters (2s)
 * Phase 4: Merge into abstract glyph (2s)
 * 
 * Total duration: ~8 seconds with haptic feedback at each phase
 */
export default function DistillationAnimationScreen() {
  const route = useRoute<DistillationAnimationRouteProp>();
  const navigation = useNavigation<DistillationAnimationNavigationProp>();

  const { intentionText, category, distilledLetters } = route.params;

  const [currentPhase, setCurrentPhase] = useState(0);
  const [displayText, setDisplayText] = useState(intentionText);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']);

  // Helper to remove vowels
  const removeVowels = (text: string): string => {
    return text.split('').filter(char => !VOWELS.has(char)).join('');
  };

  // Helper to remove duplicates
  const removeDuplicates = (text: string): string => {
    const seen = new Set<string>();
    return text.split('').filter(char => {
      if (char === ' ') return false;
      const upper = char.toUpperCase();
      if (seen.has(upper)) return false;
      if (/[a-zA-Z]/.test(char)) {
        seen.add(upper);
        return true;
      }
      return false;
    }).join('');
  };

  // Phase transition animation
  const animatePhaseTransition = (callback: () => void) => {
    Animated.sequence([
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Fade in with new content
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  // Pulse animation for phase labels
  const pulsePhaseLabel = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Rotation animation for Phase 3
  const animateRotation = () => {
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  // Glow animation for Phase 4
  const animateGlow = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    const phases = [
      // Phase 0: Show original (2s)
      {
        duration: 2000,
        haptic: Haptics.ImpactFeedbackStyle.Light,
        action: () => {
          pulsePhaseLabel();
        },
      },
      // Phase 1: Remove vowels (2s)
      {
        duration: 2000,
        haptic: Haptics.ImpactFeedbackStyle.Light,
        action: () => {
          animatePhaseTransition(() => {
            setDisplayText(removeVowels(intentionText));
            pulsePhaseLabel();
          });
        },
      },
      // Phase 2: Remove duplicates (2s)
      {
        duration: 2000,
        haptic: Haptics.ImpactFeedbackStyle.Medium,
        action: () => {
          animatePhaseTransition(() => {
            const withoutVowels = removeVowels(intentionText);
            setDisplayText(removeDuplicates(withoutVowels));
            pulsePhaseLabel();
          });
        },
      },
      // Phase 3: Rotate/overlap (2s)
      {
        duration: 2000,
        haptic: Haptics.ImpactFeedbackStyle.Medium,
        action: () => {
          const letters = distilledLetters.join(' ');
          setDisplayText(letters);
          animateRotation();
          pulsePhaseLabel();
        },
      },
      // Phase 4: Merge into glyph (2s)
      {
        duration: 2000,
        haptic: Haptics.ImpactFeedbackStyle.Heavy,
        action: () => {
          setDisplayText(distilledLetters.join(''));
          animateGlow();
          pulsePhaseLabel();
        },
      },
    ];

    let phaseIndex = 0;
    let timeout: NodeJS.Timeout;

    const runPhase = () => {
      if (phaseIndex >= phases.length) {
        // All phases complete - navigate to SigilSelection
        setTimeout(() => {
          navigation.navigate('EnhancementChoice', {
            intentionText,
            category,
            distilledLetters,
          });
        }, 500);
        return;
      }

      const phase = phases[phaseIndex];
      setCurrentPhase(phaseIndex);

      // Trigger haptic
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

    return () => clearTimeout(timeout);
  }, [intentionText, category, distilledLetters, navigation]);

  const phaseLabels = [
    'Your Intention',
    'Removing Vowels...',
    'Removing Duplicates...',
    'Overlapping Letters...',
    'Merging into Symbol...',
  ];

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(212, 175, 55, 0)', 'rgba(212, 175, 55, 0.4)'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Phase Label */}
        <Animated.View style={[styles.phaseLabelContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.phaseLabel}>{phaseLabels[currentPhase]}</Text>
        </Animated.View>

        {/* Animated Text Display */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [
                { rotate: currentPhase >= 3 ? spin : '0deg' },
                { scale: currentPhase >= 4 ? 1.2 : 1 },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.textGlow,
              {
                shadowColor: glowColor,
                shadowRadius: currentPhase >= 4 ? 20 : 0,
              },
            ]}
          >
            <Text
              style={[
                styles.displayText,
                currentPhase <= 1 && styles.displayTextSentence,
                currentPhase >= 2 && styles.displayTextLetters,
                currentPhase >= 4 && styles.displayTextMerged,
              ]}
              numberOfLines={currentPhase <= 1 ? 3 : undefined}
            >
              {displayText}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          {phaseLabels.map((_, index) => (
            <View
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1419', // Navy
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  phaseLabelContainer: {
    marginBottom: 48,
  },
  phaseLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 18,
    color: '#D4AF37', // Gold
    textAlign: 'center',
    letterSpacing: 1,
  },
  textContainer: {
    width: '100%',
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  textGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    elevation: 20,
  },
  displayText: {
    fontFamily: 'Inter-Regular',
    fontSize: 32,
    color: '#F5F5DC', // Bone
    textAlign: 'center',
    letterSpacing: 2,
  },
  displayTextSentence: {
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: 0.5,
  },
  displayTextLetters: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 36,
    letterSpacing: 12,
  },
  displayTextMerged: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 48,
    letterSpacing: 0,
    color: '#D4AF37', // Gold
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 48,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3E2C5B', // Deep purple
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#D4AF37', // Gold
  },
  progressDotComplete: {
    backgroundColor: '#C0C0C0', // Silver
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9E9E9E', // Tertiary text
    textAlign: 'center',
    marginTop: 32,
    fontStyle: 'italic',
  },
});
