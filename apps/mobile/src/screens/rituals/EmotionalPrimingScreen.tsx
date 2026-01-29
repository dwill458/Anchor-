/**
 * Anchor App - Mental Alignment Screen
 *
 * 15-second preparation screen before charging ritual.
 * Builds mental alignment and prepares user for optimal priming.
 * Based on Phil Cooper's methodology - mental focus is key.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';

type EmotionalPrimingRouteProp = RouteProp<RootStackParamList, 'EmotionalPriming'>;
type EmotionalPrimingNavigationProp = StackNavigationProp<RootStackParamList, 'EmotionalPriming'>;

const DURATION_SECONDS = 15;
const PROMPT_ROTATION_INTERVAL = 4000; // ms

const EMOTIONAL_PROMPTS = [
  'Feel the desire in your body',
  'Make it real in your mind',
  'This is YOUR moment',
  'Pure intention. Pure focus.',
  'Feel it with every fiber',
  'Believe it is already true',
];

export const EmotionalPrimingScreen: React.FC = () => {
  const route = useRoute<EmotionalPrimingRouteProp>();
  const navigation = useNavigation<EmotionalPrimingNavigationProp>();

  const { anchorId, intention, chargeType } = route.params;

  const [countdown, setCountdown] = useState(DURATION_SECONDS);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /**
   * Countdown timer
   */
  useEffect(() => {
    // Start with medium haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleComplete();
          return 0;
        }

        // Haptic every 3 seconds
        if (prev % 3 === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Rotate prompts every 4 seconds
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromptIndex((prev) => (prev + 1) % EMOTIONAL_PROMPTS.length);

      // Fade animation on prompt change
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, PROMPT_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  /**
   * Intention pulse animation
   */
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  /**
   * Complete priming and navigate to charging screen
   * DEPRECATED: This screen is legacy. Use ChargeSetupScreen → RitualScreen flow instead.
   */
  const handleComplete = () => {
    // Success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Navigate to new redesigned ritual screen (Phase 2.7)
    navigation.replace('Ritual', {
      anchorId,
      ritualType: chargeType === 'quick' ? 'quick' : 'deep',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Before we begin...</Text>

        <Text style={styles.instruction}>
          Priming requires mental alignment.
          {'\n\n'}
          Take a moment to FEEL your desire.
          {'\n'}
          Not just think it — <Text style={styles.emphasis}>FEEL</Text> it.
        </Text>

        {/* Pulsing intention */}
        <Animated.View
          style={[
            styles.intentionContainer,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
          <Text style={styles.intentionText}>"{intention}"</Text>
        </Animated.View>

        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>

        {/* Rotating emotional prompt */}
        <Animated.View
          style={[
            styles.promptContainer,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.promptText}>
            {EMOTIONAL_PROMPTS[currentPromptIndex]}
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.gold,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  instruction: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
  },
  emphasis: {
    fontWeight: '700',
    color: colors.gold,
  },
  intentionContainer: {
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    minWidth: '80%',
  },
  intentionLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  intentionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.gold,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  countdownContainer: {
    marginBottom: spacing.xxl,
  },
  countdown: {
    fontFamily: typography.fonts.heading,
    fontSize: 72,
    color: colors.gold,
    textAlign: 'center',
  },
  promptContainer: {
    paddingHorizontal: spacing.lg,
  },
  promptText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.h4,
    color: colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
