/**
 * Anchor App - Activation Screen
 *
 * Focused session for your anchor.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAnchorStore } from '../../stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useToast } from '@/components/ToastProvider';
import { RitualScaffold } from './components/RitualScaffold';
import { FocusSession } from './components/FocusSession';

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;

export const ActivationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ActivationRouteProp>();
  const { anchorId, activationType } = route.params;
  const toast = useToast();

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const { defaultActivation } = useSettingsStore();
  const anchor = getAnchorById(anchorId);

  const activationDurationSeconds = useMemo(() => {
    if (defaultActivation.unit === 'minutes') {
      const clampedMinutes = Math.max(1, Math.min(30, Math.round(defaultActivation.value)));
      return clampedMinutes * 60;
    }

    if (defaultActivation.unit === 'seconds') {
      const clampedValue = Math.max(1, Math.min(600, Math.round(defaultActivation.value)));
      return clampedValue;
    }

    return 10;
  }, [defaultActivation]);

  const logActivationInBackground = useCallback(async (): Promise<void> => {
    const localActivationTime = new Date();
    const currentActivationCount = anchor?.activationCount ?? 0;

    updateAnchor(anchorId, {
      activationCount: currentActivationCount + 1,
      lastActivatedAt: localActivationTime,
    });

    try {
      const response = await apiClient.post(`/api/anchors/${anchorId}/activate`, {
        activationType: activationType || 'visual',
        durationSeconds: activationDurationSeconds,
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
  }, [activationDurationSeconds, activationType, anchor?.activationCount, anchorId, toast, updateAnchor]);

  const handleComplete = useCallback(() => {
    navigation.goBack();
    void logActivationInBackground();
  }, [logActivationInBackground, navigation]);

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
    <FocusSession
      intentionText={anchor.intentionText}
      anchorImageUri={anchor.enhancedImageUrl || anchor.baseSigilSvg || ''}
      durationSeconds={activationDurationSeconds}
      onComplete={handleComplete}
      onDismiss={() => navigation.goBack()}
    />
  );
};

const styles = StyleSheet.create({
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
