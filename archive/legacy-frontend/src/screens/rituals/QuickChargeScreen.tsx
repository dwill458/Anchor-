/**
 * Anchor App - Quick Charge Screen
 *
 * 30-second focused session to charge an anchor with intention.
 * Simple countdown with haptic feedback.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Svg, { SvgXml } from 'react-native-svg';
import { useAnchorStore } from '../../stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { apiClient } from '@/services/ApiClient';

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.7;
const DURATION_SECONDS = 30;
const HAPTIC_INTERVAL = 5; // Haptic pulse every 5 seconds

type QuickChargeRouteProp = RouteProp<RootStackParamList, 'ChargingRitual'>;

export const QuickChargeScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<QuickChargeRouteProp>();
  const { anchorId } = route.params;

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const newValue = prev - 1;

        // Haptic pulse every 5 seconds
        if (newValue > 0 && newValue % HAPTIC_INTERVAL === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
   * Handle charge completion
   */
  const handleComplete = async (): Promise<void> => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsComplete(true);

    // Update backend
    try {
      await apiClient.post(`/api/anchors/${anchorId}/charge`, {
        chargeType: 'initial_quick',
        durationSeconds: DURATION_SECONDS,
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isComplete ? 'Charged!' : 'Focus on Your Intention'}
        </Text>
        <Text style={styles.intentionText}>{anchor.intentionText}</Text>
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
            Hold your focus on the symbol and your intention
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
