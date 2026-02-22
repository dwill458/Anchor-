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
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAnchorStore } from '../../stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTeachingStore } from '@/stores/teachingStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { apiClient } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useToast } from '@/components/ToastProvider';
import { RitualScaffold } from './components/RitualScaffold';
import { FocusSession } from './components/FocusSession';
import { CompletionModal } from './components/CompletionModal';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { TEACHINGS } from '@/constants/teaching';

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;

export const ActivationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { navigateToPractice } = useTabNavigation();
  const route = useRoute<ActivationRouteProp>();
  const { anchorId, activationType, durationOverride, returnTo } = route.params;
  const toast = useToast();

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const updateAnchor = useAnchorStore((state) => state.updateAnchor);
  const computeStreak = useAuthStore((state) => state.computeStreak);
  const { defaultActivation } = useSettingsStore();
  const { recordSession } = useSessionStore();
  const { recordShown } = useTeachingStore();
  const anchor = getAnchorById(anchorId);

  // Ground Note (Pattern 2): shown on first charge session, guide ON
  const groundNoteTeaching = useTeachingGate({
    screenId: 'activation',
    candidateIds: ['activation_ground_note_v1'],
  });

  // Seal Whisper (Pattern 5): passed to CompletionModal on first charge, guide ON
  const sealWhisperTeaching = useTeachingGate({
    screenId: 'completion_modal',
    candidateIds: ['completion_seal_whisper_v1'],
  });

  const [showCompletion, setShowCompletion] = useState(false);

  // Record ground note shown (once, on render — gate already enforces lifetime limit)
  React.useEffect(() => {
    if (groundNoteTeaching) {
      const content = TEACHINGS[groundNoteTeaching.teachingId];
      recordShown(groundNoteTeaching.teachingId, groundNoteTeaching.pattern, content?.maxShows ?? 1);
      AnalyticsService.track('teaching_shown', {
        teaching_id: groundNoteTeaching.teachingId,
        pattern: groundNoteTeaching.pattern,
        screen: 'activation',
        trigger: groundNoteTeaching.trigger,
        guide_mode: true,
      });
    }
  }, [groundNoteTeaching?.teachingId]);

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
      navigateToPractice();
    } else if (returnTo === 'reinforce') {
      (navigation as any).replace('Ritual', {
        anchorId,
        ritualType: 'ritual',
        durationSeconds: 300,
        returnTo: 'detail',
      });
    } else if (returnTo === 'detail') {
      (navigation as any).navigate('AnchorDetail', { anchorId });
    } else {
      navigation.goBack();
    }
  }, [
    anchorId,
    activationDurationSeconds,
    defaultActivation.mode,
    logActivationInBackground,
    navigateToPractice,
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
        groundNoteText={groundNoteTeaching?.copy}
        groundNoteSecondary={groundNoteTeaching?.copySecondary}
        onDismiss={() => {
          if (returnTo === 'practice') {
            navigateToPractice();
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
        teachingLine={sealWhisperTeaching?.copy}
        teachingId={sealWhisperTeaching?.teachingId}
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
