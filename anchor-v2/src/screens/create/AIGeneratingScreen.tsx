/**
 * Anchor App - AI Generating Screen
 *
 * Step 6 in anchor creation flow (after AIAnalysis).
 * Shows progress while Stable Diffusion generates 4 AI-enhanced variations.
 * Automatically navigates to AIVariationPicker when complete.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';
import { apiClient } from '@/services/ApiClient';
// import { mockGenerateVariations } from '@/services/MockAIService'; // Removed mock

type AIGeneratingRouteProp = RouteProp<RootStackParamList, 'AIGenerating'>;
type AIGeneratingNavigationProp = StackNavigationProp<RootStackParamList, 'AIGenerating'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Mystical loading messages (rotate every 8 seconds)
 */
const LOADING_MESSAGES = [
  'Consulting design patterns...',
  'Channeling creative energies...',
  'Weaving alignment patterns...',
  'Invoking archetypal forces...',
  'Crystallizing your intention...',
  'Forging symbolic power...',
  'Merging anchor and symbol...',
  'Birthing your anchor...',
];

/**
 * AIGeneratingScreen Component
 */
export const AIGeneratingScreen: React.FC = () => {
  const navigation = useNavigation<AIGeneratingNavigationProp>();
  const route = useRoute<AIGeneratingRouteProp>();

  const { intentionText, distilledLetters, sigilSvg, sigilVariant, analysis, category } = route.params;

  const [currentMessage, setCurrentMessage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /**
   * Start animations on mount
   */
  useEffect(() => {
    startAnimations();
    startGeneration();
    const cleanup = startMessageRotation();
    return () => cleanup();
  }, []);

  /**
   * Pulse animation (breathing effect)
   */
  const startAnimations = (): void => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();
  };

  /**
   * Rotate loading messages
   */
  const startMessageRotation = (): (() => void) => {
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Change message
        setCurrentMessage((prev) => (prev + 1) % LOADING_MESSAGES.length);

        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 8000);

    return () => clearInterval(interval);
  };

  /**
   * Call backend to generate AI variations
   */
  const startGeneration = async (): Promise<void> => {
    try {
      // Use real API
      // TODO: Get actual userId from auth store
      const response = await apiClient.post<any>('/api/ai/enhance', {
        sigilSvg,
        analysis,
        userId: 'temp-user-id',
        anchorId: `anchor-${Date.now()}`,
      });

      console.log('Generation response:', response.data);
      const { variations, prompt } = response.data;

      setProgress(100);

      // Wait a moment to show completion, then navigate
      setTimeout(() => {
        navigation.navigate('AIVariationPicker', {
          intentionText,
          distilledLetters,
          sigilSvg,
          sigilVariant,
          variations, // These will be real URLs now
          prompt,
          category,
        });
      }, 1000);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  /**
   * Error state
   */
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Generation Failed</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorHint}>
            This might be due to API limits or network issues. Please try creating a new anchor.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Loading state
   */
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Animated Symbol */}
        <View style={styles.symbolContainer}>
          <Animated.View
            style={[
              styles.symbolOuter,
              {
                transform: [{ rotate }],
              },
            ]}
          >
            <View style={styles.symbolOuterRing} />
          </Animated.View>

          <Animated.View
            style={[
              styles.symbolInner,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text style={styles.symbolText}>✨</Text>
          </Animated.View>
        </View>

        {/* Loading Message */}
        <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
          <Text style={styles.loadingMessage}>{LOADING_MESSAGES[currentMessage]}</Text>
        </Animated.View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {/* Intention Reminder */}
        <View style={styles.intentionContainer}>
          <Text style={styles.intentionLabel}>Manifesting</Text>
          <Text style={styles.intentionText}>"{intentionText}"</Text>
        </View>

        {/* Time Estimate */}
        <Text style={styles.timeEstimate}>
          ⏱️ This usually takes 40-80 seconds
        </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  symbolContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    position: 'relative',
  },
  symbolOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolOuterRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'dashed',
  },
  symbolInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.gold,
  },
  symbolText: {
    fontSize: 64,
  },
  messageContainer: {
    marginBottom: spacing.xl,
    minHeight: 60,
    justifyContent: 'center',
  },
  loadingMessage: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.background.card,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  intentionContainer: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  intentionLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  intentionText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
  },
  timeEstimate: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  errorHint: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
