/**
 * Anchor App - Activation Screen
 *
 * Focused session for your anchor.
 * On completion, shows CompletionModal for one-word reflection,
 * then records the session in sessionStore before navigating back.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAnchorStore } from '../../stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useToast } from '@/components/ToastProvider';
import { RitualScaffold } from './components/RitualScaffold';
import { FocusSession } from './components/FocusSession';
import { CompletionModal } from './components/CompletionModal';

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;

export const ActivationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ActivationRouteProp>();
  const { anchorId, activationType, durationOverride, returnTo } = route.params;
  const toast = useToast();

  const { getAnchorById, updateAnchor } = useAnchorStore();
  const computeStreak = useAuthStore((state) => state.computeStreak);
  const { defaultActivation } = useSettingsStore();
  const { recordSession } = useSessionStore();
  const anchor = getAnchorById(anchorId);

  const [showCompletion, setShowCompletion] = useState(false);

  const activationDurationSeconds = useMemo(() => {
    // durationOverride (from "Continue" flow) takes precedence
    if (durationOverride != null && durationOverride > 0) return durationOverride;

    if (defaultActivation.unit === 'minutes') {
      const clampedMinutes = Math.max(1, Math.min(30, Math.round(defaultActivation.value)));
      return clampedMinutes * 60;
    }

    if (defaultActivation.unit === 'seconds') {
      const clampedValue = Math.max(1, Math.min(600, Math.round(defaultActivation.value)));
      return clampedValue;
    }

    return 30;
  }, [defaultActivation, durationOverride]);

  const logActivationInBackground = useCallback(async (): Promise<void> => {
    const localActivationTime = new Date();
    const currentActivationCount = anchor?.activationCount ?? 0;

    updateAnchor(anchorId, {
      activationCount: currentActivationCount + 1,
      lastActivatedAt: localActivationTime,
    });

    computeStreak();

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
  }, [activationDurationSeconds, activationType, anchor?.activationCount, anchorId, computeStreak, toast, updateAnchor]);

  // Show completion modal instead of immediately going back
  const handleComplete = useCallback(() => {
    setShowCompletion(true);
  }, []);

  const handleCompletionDone = useCallback((reflectionWord?: string) => {
    setShowCompletion(false);

    // Record session locally
    recordSession({
      anchorId,
      type: 'activate',
      durationSeconds: activationDurationSeconds,
      mode: defaultActivation.mode ?? 'silent',
      reflectionWord,
      completedAt: new Date().toISOString(),
    });

    // Log to backend (non-blocking)
    void logActivationInBackground();

    if (returnTo === 'practice') {
      const tabNav = navigation.getParent?.() as any;
      tabNav?.navigate('Practice');
    } else if (returnTo === 'detail') {
      navigation.navigate('AnchorDetail' as any, { anchorId });
    } else {
      navigation.goBack();
    }
  }, [
    anchorId,
    activationDurationSeconds,
    defaultActivation.mode,
    logActivationInBackground,
    navigation,
    recordSession,
  ]);

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
    <>
      <FocusSession
        intentionText={anchor.intentionText}
        anchorImageUri={anchor.enhancedImageUrl || anchor.baseSigilSvg || ''}
        durationSeconds={activationDurationSeconds}
        onComplete={handleComplete}
        onDismiss={() => {
          if (returnTo === 'practice') {
            const tabNav = (navigation as any).getParent?.();
            tabNav?.navigate('Practice');
          } else if (returnTo === 'detail') {
            (navigation as any).navigate('AnchorDetail', { anchorId });
          } else {
            navigation.goBack();
          }
        }}
      />
      <CompletionModal
        visible={showCompletion}
        sessionType="activate"
        anchor={anchor}
        onDone={handleCompletionDone}
      />
    </>
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
