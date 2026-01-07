/**
 * Anchor App - Activation Screen
 *
 * 10-second focused session to activate a charged anchor.
 * Simple countdown with haptic feedback.
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
const SIGIL_SIZE = width * 0.7;
const DURATION_SECONDS = 10;
const HAPTIC_INTERVAL = 2; // Haptic pulse every 2 seconds (faster than charging)

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;

export const ActivationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ActivationRouteProp>();
  const { anchorId, activationType } = route.params;

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  const [secondsRemaining, setSecondsRemaining] = useState(DURATION_SECONDS);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Start countdown timer
   */
  useEffect(() => {
    // Initial haptic feedback
    ReactNativeHapticFeedback.trigger('impactMedium');

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const newValue = prev - 1;

        // Haptic pulse every 2 seconds
        if (newValue > 0 && newValue % HAPTIC_INTERVAL === 0) {
          ReactNativeHapticFeedback.trigger('impactLight');
        }

        // Complete at 0
        if (newValue <= 0) {
          handleComplete();
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
  }, []);

  /**
   * Handle activation completion
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
      const response = await apiClient.post(`/api/anchors/${anchorId}/activate`, {
        activationType: activationType || 'visual',
        durationSeconds: DURATION_SECONDS,
      });

      // Update local state with new counts from backend
      if (response.data.data) {
        updateAnchor(anchorId, {
          activationCount: response.data.data.activationCount,
          lastActivatedAt: new Date(response.data.data.lastActivatedAt),
        });
      }
    } catch (error) {
      console.error('Failed to log activation:', error);
    }

    // Navigate back after 1.5 seconds (shorter than charging)
    setTimeout(() => {
      navigation.goBack();
    }, 1500);
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isComplete ? 'Activated!' : 'Activate Your Anchor'}
        </Text>
        <Text style={styles.intentionText}>"{anchor.intentionText}"</Text>
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
          <Text style={styles.instructionsText}>
            Focus on your intention. Feel it activating.
          </Text>
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
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
  },
  sigilContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  timerText: {
    fontSize: 72,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  timerLabel: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  completeText: {
    fontSize: 72,
    color: colors.success,
  },
  instructionsContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
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
