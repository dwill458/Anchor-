/**
 * Anchor App - Deep Charge Screen
 *
 * 5-phase guided session (~5 minutes) to deeply charge an anchor.
 * Clean, minimal language - no mystical terminology.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Svg, { SvgXml } from 'react-native-svg';
import { useAnchorStore } from '../../stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { apiClient } from '@/services/ApiClient';

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.6;

type DeepChargeRouteProp = RouteProp<RootStackParamList, 'ChargingRitual'>;

/**
 * Phase configuration with clean language
 */
interface Phase {
  number: number;
  title: string;
  instruction: string;
  durationSeconds: number;
}

const PHASES: Phase[] = [
  {
    number: 1,
    title: 'Breathe and Center',
    instruction: 'Take slow, deep breaths. Clear your mind and prepare to focus.',
    durationSeconds: 30,
  },
  {
    number: 2,
    title: 'Repeat Your Intention',
    instruction: 'Silently or aloud, repeat your intention with conviction.',
    durationSeconds: 60,
  },
  {
    number: 3,
    title: 'Visualize Success',
    instruction: 'See yourself achieving this goal. Make it vivid and real.',
    durationSeconds: 90,
  },
  {
    number: 4,
    title: 'Connect to Symbol',
    instruction: 'Touch the screen. Feel your intention flowing into the symbol.',
    durationSeconds: 30,
  },
  {
    number: 5,
    title: 'Hold Focus',
    instruction: 'Maintain your focus on the symbol. Feel the connection.',
    durationSeconds: 90,
  },
];

const TOTAL_DURATION = PHASES.reduce((sum, phase) => sum + phase.durationSeconds, 0);

export const DeepChargeScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<DeepChargeRouteProp>();
  const { anchorId } = route.params;

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(PHASES[0].durationSeconds);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentPhase = PHASES[currentPhaseIndex];
  const progress = (currentPhaseIndex / PHASES.length) * 100;

  /**
   * Start countdown timer
   */
  useEffect(() => {
    // Initial haptic feedback
    ReactNativeHapticFeedback.trigger('impactMedium');

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const newValue = prev - 1;

        // Pulse every 10 seconds
        if (newValue > 0 && newValue % 10 === 0) {
          ReactNativeHapticFeedback.trigger('impactLight');
        }

        // Move to next phase or complete
        if (newValue <= 0) {
          handlePhaseComplete();
          return 0;
        }

        return newValue;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentPhaseIndex]);

  /**
   * Handle phase completion
   */
  const handlePhaseComplete = (): void => {
    const nextPhaseIndex = currentPhaseIndex + 1;

    if (nextPhaseIndex < PHASES.length) {
      // Move to next phase
      ReactNativeHapticFeedback.trigger('impactMedium');
      setCurrentPhaseIndex(nextPhaseIndex);
      setSecondsRemaining(PHASES[nextPhaseIndex].durationSeconds);
    } else {
      // Complete entire session
      handleComplete();
    }
  };

  /**
   * Handle charge completion
   */
  const handleComplete = async (): Promise<void> => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Success haptic
    ReactNativeHapticFeedback.trigger('notificationSuccess');
    setIsComplete(true);

    // Update backend
    try {
      await apiClient.post(`/api/anchors/${anchorId}/charge`, {
        chargeType: 'initial_deep',
        durationSeconds: TOTAL_DURATION,
      });

      // Update local state
      updateAnchor(anchorId, {
        isCharged: true,
        chargedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to mark anchor as charged:', error);
    }

    // Navigate back after 2 seconds
    setTimeout(() => {
      navigation.goBack();
    }, 2000);
  };

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Anchor not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      {/* Phase Header */}
      <View style={styles.header}>
        {!isComplete ? (
          <>
            <Text style={styles.phaseNumber}>Phase {currentPhase.number} of 5</Text>
            <Text style={styles.phaseTitle}>{currentPhase.title}</Text>
          </>
        ) : (
          <Text style={styles.phaseTitle}>Charged!</Text>
        )}
      </View>

      {/* Sigil Display */}
      <View style={styles.sigilContainer}>
        <SvgXml
          xml={anchor.baseSigilSvg}
          width={SIGIL_SIZE}
          height={SIGIL_SIZE}
        />
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        {!isComplete ? (
          <>
            <Text style={styles.timerText}>{secondsRemaining}</Text>
            <Text style={styles.timerLabel}>seconds</Text>
          </>
        ) : (
          <Text style={styles.completeText}>✓</Text>
        )}
      </View>

      {/* Instructions */}
      {!isComplete && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.intentionText}>"{anchor.intentionText}"</Text>
          <Text style={styles.instructionsText}>{currentPhase.instruction}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  progressContainer: {
    height: 4,
    backgroundColor: colors.navy,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  phaseNumber: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  phaseTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
  },
  sigilContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  timerText: {
    fontSize: 56,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  timerLabel: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  completeText: {
    fontSize: 56,
    color: colors.success,
  },
  instructionsContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: typography.lineHeights.body1,
  },
  instructionsText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body2,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
