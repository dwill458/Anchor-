/**
 * Anchor App - Activation Screen
 *
 * 10-second focused session for your anchor.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { SvgXml } from 'react-native-svg';
import { useAnchorStore } from '../../stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useToast } from '@/components/ToastProvider';
import { RitualScaffold } from './components/RitualScaffold';
import { InstructionGlassCard } from './components/InstructionGlassCard';

const { width } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.62;
const DURATION_SECONDS = 10;
const HAPTIC_INTERVAL = 2;

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;

export const ActivationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ActivationRouteProp>();
  const { anchorId, activationType } = route.params;
  const toast = useToast();

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  const [secondsRemaining, setSecondsRemaining] = useState(DURATION_SECONDS);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const newValue = prev - 1;

        if (newValue > 0 && newValue % HAPTIC_INTERVAL === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

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

  const handleComplete = async (): Promise<void> => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsComplete(true);

    try {
      const response = await apiClient.post(`/api/anchors/${anchorId}/activate`, {
        activationType: activationType || 'visual',
        durationSeconds: DURATION_SECONDS,
      });

      if (response.data.data) {
        updateAnchor(anchorId, {
          activationCount: response.data.data.activationCount,
          lastActivatedAt: new Date(response.data.data.lastActivatedAt),
        });
      }

      toast.success('Activation logged successfully');
    } catch (error) {
      ErrorTrackingService.captureException(
        error instanceof Error ? error : new Error('Unknown error during anchor activation'),
        {
          screen: 'ActivationScreen',
          action: 'activate_anchor',
          anchor_id: anchorId,
        }
      );

      toast.error('Activation completed but failed to sync. Will retry later.');
    }

    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  };

  if (!anchor) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Anchor not found</Text>
        </View>
      </RitualScaffold>
    );
  }

  return (
    <RitualScaffold>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{isComplete ? 'Session Complete!' : 'Focus Session'}</Text>
          <InstructionGlassCard text={`"${anchor.intentionText}"`} containerStyle={styles.intentionCard} />
        </View>

        <View style={styles.sigilContainer}>
          <View style={styles.sigilHalo} />
          <SvgXml xml={anchor.baseSigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
        </View>

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

        {!isComplete && (
          <View style={styles.instructionsContainer}>
            <InstructionGlassCard text="Focus on your intention. Feel it empowering you." />
          </View>
        )}
      </View>
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  intentionCard: {
    width: '100%',
    maxWidth: 460,
  },
  sigilContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sigilHalo: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.18,
    height: SIGIL_SIZE * 1.18,
    borderRadius: (SIGIL_SIZE * 1.18) / 2,
    backgroundColor: colors.ritual.softGlow,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 7,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  timerText: {
    fontSize: 68,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    lineHeight: 74,
  },
  timerLabel: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  completeText: {
    fontSize: 72,
    color: colors.success,
    lineHeight: 74,
  },
  instructionsContainer: {
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    textAlign: 'center',
  },
});
