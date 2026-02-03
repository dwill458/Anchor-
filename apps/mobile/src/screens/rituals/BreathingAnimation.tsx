/**
 * Breathing Animation Screen
 *
 * Premium meditation ritual entry point.
 * 3-second mandatory breathing animation with pulsing circle and instructions.
 * Auto-advances to the Ritual screen on completion.
 *
 * Features:
 * - Smooth 3-second breathing cycle (1.5s inhale, 1.5s exhale)
 * - Pulsing circle animation: scale 0.8 → 1.2 → 0.8
 * - Text instructions ("Breathe in..." / "Breathe out...")
 * - Subtle gold glow at peak expansion
 * - Light haptic feedback at start and completion
 * - Mandatory duration (no skip button)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type BreathingAnimationRouteProp = RouteProp<
  RootStackParamList,
  'BreathingAnimation'
>;
type BreathingAnimationNavigationProp = StackNavigationProp<
  RootStackParamList,
  'BreathingAnimation'
>;

const ANIMATION_DURATION = 3000; // 3 seconds total
const INHALE_DURATION = 1500; // 1.5 seconds inhale
const EXHALE_DURATION = 1500; // 1.5 seconds exhale

export const BreathingAnimation: React.FC = () => {
  const navigation = useNavigation<BreathingAnimationNavigationProp>();
  const route = useRoute<BreathingAnimationRouteProp>();
  const { source, anchorId, mode, duration } = route.params;

  const [isComplete, setIsComplete] = useState(false);
  const [instructionText, setInstructionText] = useState('Breathe in...');

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowOpacityAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);
  const inhaleInstructionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start with light haptic feedback
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

    // Inhale phase (0-1.5s)
    const inhaleSequence = Animated.timing(scaleAnim, {
      toValue: 1.2,
      duration: INHALE_DURATION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });

    // Inhale glow
    Animated.timing(glowOpacityAnim, {
      toValue: 0.4,
      duration: INHALE_DURATION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Exhale phase (1.5-3s)
    const exhaleSequence = Animated.timing(scaleAnim, {
      toValue: 0.8,
      duration: EXHALE_DURATION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });

    // Exhale glow fade
    Animated.timing(glowOpacityAnim, {
      toValue: 0,
      duration: EXHALE_DURATION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Instruction text transitions
    inhaleInstructionTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setInstructionText('Breathe out...');
    }, INHALE_DURATION);

    // Run sequence: inhale → exhale
    Animated.sequence([inhaleSequence, exhaleSequence]).start(({ finished }) => {
      if (finished) {
        setIsComplete(true);

        // Haptic feedback on completion
        void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);

        // Auto-advance to next screen after brief pause
        completionTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;

          // Navigate based on source
          if (source === 'charge' && anchorId && mode && duration) {
            navigation.navigate('Ritual', {
              anchorId,
              ritualType: mode as 'focus' | 'ritual' | 'quick' | 'deep',
              durationSeconds: duration,
            });
          } else {
            navigation.goBack();
          }
        }, 300);
      }
    });

    return () => {
      isMountedRef.current = false;
      if (inhaleInstructionTimeoutRef.current) {
        clearTimeout(inhaleInstructionTimeoutRef.current);
      }
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Background gradient */}
      <View style={styles.background}>
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
      </View>

      {/* Centered breathing circle */}
      <View style={styles.content}>
        {/* Instruction text */}
        <Animated.View
          style={[
            styles.instructionContainer,
            {
              opacity: textOpacityAnim,
            },
          ]}
        >
          <Text style={styles.instructionText}>{instructionText}</Text>
        </Animated.View>

        {/* Breathing circle container */}
        <View style={styles.circleContainer}>
          {/* Outer glow effect (subtle, fades in/out) */}
          <Animated.View
            style={[
              styles.glowCircle,
              {
                opacity: glowOpacityAnim,
              },
            ]}
          />

          {/* Main breathing circle */}
          <Animated.View
            style={[
              styles.breathingCircle,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          />

          {/* Center dot - static reference point */}
          <View style={styles.centerDot} />
        </View>

        {/* Subtitle text */}
        <Text style={styles.subtitle}>Prepare yourself for the ritual</Text>
      </View>

      {/* Progress indicator - subtle dots showing breathing progress */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressDot, styles.progressDotActive]} />
        <View style={styles.progressDot} />
      </View>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  background: {
    ...StyleSheet.absoluteFillObject,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  instructionContainer: {
    position: 'absolute',
    top: screenHeight * 0.15,
    zIndex: 10,
  },

  instructionText: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  circleContainer: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  glowCircle: {
    position: 'absolute',
    width: '140%',
    height: '140%',
    borderRadius: 999,
    backgroundColor: colors.gold,
    opacity: 0,
  },

  breathingCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: `${colors.gold}20`,
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  centerDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
    zIndex: 5,
  },

  subtitle: {
    position: 'absolute',
    bottom: screenHeight * 0.15,
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },

  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: `rgba(212, 175, 55, 0.2)`,
  },

  progressDotActive: {
    backgroundColor: colors.gold,
    opacity: 0.8,
  },
});
