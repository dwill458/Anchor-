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
import { useForgeMomentStore } from '@/stores/forgeMomentStore';
import { useSettingsStore, type DefaultActivationSetting } from '@/stores/settingsStore';
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
import { ConfirmModal } from './components/ConfirmModal';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { TEACHINGS } from '@/constants/teaching';
import { getCurrentRank } from '@/utils/practiceRank';
import { useNotificationController } from '@/hooks/useNotificationController';

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;

const FALLBACK_DEFAULT_ACTIVATION: DefaultActivationSetting = {
  type: 'visual',
  value: 30,
  unit: 'seconds',
  mode: 'silent',
};

function resolveDefaultActivation(
  setting?: Partial<DefaultActivationSetting> | null
): DefaultActivationSetting {
  const candidate = setting ?? {};
  const unit =
    candidate.unit === 'minutes' ||
    candidate.unit === 'seconds' ||
    candidate.unit === 'reps' ||
    candidate.unit === 'breaths'
      ? candidate.unit
      : FALLBACK_DEFAULT_ACTIVATION.unit;
  const value =
    typeof candidate.value === 'number' && Number.isFinite(candidate.value)
      ? candidate.value
      : FALLBACK_DEFAULT_ACTIVATION.value;

  return {
    type: candidate.type ?? FALLBACK_DEFAULT_ACTIVATION.type,
    unit,
    value,
    mode: candidate.mode ?? FALLBACK_DEFAULT_ACTIVATION.mode,
  };
}

export const ActivationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { navigateToPractice } = useTabNavigation();
  const route = useRoute<ActivationRouteProp>();
  const { anchorId, activationType, durationOverride, returnTo } = route.params;
  const toast = useToast();

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const updateAnchor = useAnchorStore((state) => state.updateAnchor);
  const incrementTotalPrimes = useAnchorStore((state) => state.incrementTotalPrimes);
  const recordPrimeSession = useAnchorStore((state) => state.recordPrimeSession);
  const computeStreak = useAuthStore((state) => state.computeStreak);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const enqueuePendingFirstAnchorMutation = useAuthStore(
    (state) => state.enqueuePendingFirstAnchorMutation
  );
  const queueMilestone = useForgeMomentStore((state) => state.queueMilestone);
  const { defaultActivation } = useSettingsStore();
  const resolvedDefaultActivation = useMemo(
    () => resolveDefaultActivation(defaultActivation),
    [defaultActivation]
  );
  const { recordSession } = useSessionStore();
  const { recordShown } = useTeachingStore();
  const { handlePrimeComplete } = useNotificationController();
  const anchor = getAnchorById(anchorId);
  const isPendingFirstAnchor = pendingFirstAnchorDraft?.tempAnchorId === anchorId;
  const anchorHeroUri = anchor
    ? anchor.enhancedImageUrl || anchor.reinforcedSigilSvg || anchor.baseSigilSvg || ''
    : '';

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
  const [showExitWarning, setShowExitWarning] = useState(false);
  const exitingRef = React.useRef(false);
  const sessionCompletedRef = React.useRef(false);

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

    if (resolvedDefaultActivation.unit === 'minutes') {
      const clampedMinutes = Math.max(1, Math.min(30, Math.round(resolvedDefaultActivation.value)));
      return clampedMinutes * 60;
    }

    if (resolvedDefaultActivation.unit === 'seconds') {
      const clampedValue = Math.max(1, Math.min(600, Math.round(resolvedDefaultActivation.value)));
      return clampedValue;
    }

    return 30;
  }, [durationOverride, resolvedDefaultActivation.unit, resolvedDefaultActivation.value]);

  const logActivationInBackground = useCallback(async (): Promise<void> => {
    const localActivationTime = new Date();
    const currentActivationCount = anchor?.activationCount ?? 0;
    const authStateBefore = useAuthStore.getState().user;
    const previousLongestStreak = authStateBefore?.longestStreak ?? 0;
    const previousTotalPrimes = Math.max(
      useAnchorStore.getState().totalPrimes,
      useAnchorStore
        .getState()
        .anchors.reduce((sum, currentAnchor) => sum + (currentAnchor.activationCount ?? 0), 0)
    );
    const previousRank = getCurrentRank(previousTotalPrimes);

    updateAnchor(anchorId, {
      activationCount: currentActivationCount + 1,
      lastActivatedAt: localActivationTime,
    });

    incrementTotalPrimes();
    computeStreak();

    const nextTotalPrimes = previousTotalPrimes + 1;
    const nextRank = getCurrentRank(nextTotalPrimes);
    const nextLongestStreak = useAuthStore.getState().user?.longestStreak ?? previousLongestStreak;

    if (nextRank.name !== previousRank.name && nextRank.name !== 'Initiate') {
      void queueMilestone({
        type: 'rank',
        name: nextRank.name,
        primeCount: nextTotalPrimes,
      });
    }

    if (previousLongestStreak < 100 && nextLongestStreak >= 100) {
      void queueMilestone({
        type: 'constancy',
        name: '100 Days',
      });
    }

    try {
      if (isPendingFirstAnchor) {
        enqueuePendingFirstAnchorMutation({
          type: 'activate_anchor',
          tempAnchorId: anchorId,
          activationType: activationType || 'visual',
          durationSeconds: activationDurationSeconds,
          queuedAt: localActivationTime.toISOString(),
        });
        toast.success('Activation saved for your first anchor');
        return;
      }

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
  }, [
    activationDurationSeconds,
    activationType,
    anchor?.activationCount,
    anchorId,
    computeStreak,
    enqueuePendingFirstAnchorMutation,
    incrementTotalPrimes,
    isPendingFirstAnchor,
    queueMilestone,
    toast,
    updateAnchor,
  ]);

  // Show completion modal instead of immediately going back
  const handleSessionCompleted = useCallback(() => {
    sessionCompletedRef.current = true;
    setShowExitWarning(false);
    recordPrimeSession();
  }, [recordPrimeSession]);

  const handleComplete = useCallback(() => {
    sessionCompletedRef.current = true;
    setShowExitWarning(false);
    setShowCompletion(true);
  }, []);

  const exitSession = useCallback(() => {
    exitingRef.current = true;
    setShowExitWarning(false);

    if (returnTo === 'practice') {
      const nav = navigation as any;
      if (typeof nav.popToTop === 'function') {
        nav.popToTop();
      } else {
        navigation.goBack();
      }
      navigateToPractice();
      return;
    }

    if (returnTo === 'detail') {
      (navigation as any).navigate('AnchorDetail', { anchorId });
      return;
    }

    navigation.goBack();
  }, [anchorId, navigateToPractice, navigation, returnTo]);

  const promptExitSession = useCallback(() => {
    setShowExitWarning(true);
  }, []);

  React.useEffect(() => {
    const nav = navigation as any;
    if (typeof nav.addListener !== 'function') {
      return () => undefined;
    }

    const unsubscribe = nav.addListener('beforeRemove', (event: any) => {
      if (exitingRef.current) return;
      if (sessionCompletedRef.current) {
        event.preventDefault();
        handleComplete();
        return;
      }
      event.preventDefault();
      promptExitSession();
    });

    return unsubscribe;
  }, [handleComplete, navigation, promptExitSession]);

  const handleCompletionDone = useCallback(async (reflectionWord?: string) => {
    setShowCompletion(false);
    setShowExitWarning(false);
    exitingRef.current = true;

    // Record session locally
    recordSession({
      anchorId,
      type: 'activate',
      durationSeconds: activationDurationSeconds,
      mode: resolvedDefaultActivation.mode,
      reflectionWord,
      completedAt: new Date().toISOString(),
    });

    await handlePrimeComplete();

    // Log to backend (non-blocking)
    void logActivationInBackground();

    if (returnTo === 'practice') {
      const nav = navigation as any;
      if (typeof nav.popToTop === 'function') {
        nav.popToTop();
      }
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
    logActivationInBackground,
    navigateToPractice,
    navigation,
    recordSession,
    handlePrimeComplete,
    resolvedDefaultActivation.mode,
    returnTo,
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
        anchorImageUri={anchorHeroUri}
        durationSeconds={activationDurationSeconds}
        onComplete={handleComplete}
        onSessionCompleted={handleSessionCompleted}
        groundNoteText={groundNoteTeaching?.copy}
        groundNoteSecondary={groundNoteTeaching?.copySecondary}
        onDismiss={() => {
          if (sessionCompletedRef.current) {
            handleComplete();
            return;
          }
          promptExitSession();
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
      <ConfirmModal
        visible={showExitWarning}
        title="Exit Focus Session?"
        body="You will need to start over if you leave now."
        primaryCtaLabel="Exit"
        secondaryCtaLabel="Stay"
        onPrimary={exitSession}
        onSecondary={() => setShowExitWarning(false)}
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
