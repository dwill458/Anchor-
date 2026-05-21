/**
 * Anchor App - Activation Screen
 *
 * Focused session for your anchor.
 * On completion, shows CompletionModal for one-word reflection,
 * then records the session in sessionStore before navigating back.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, InteractionManager } from 'react-native';
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
import BackendAnchorService, { isBackendAnchorId } from '@/services/BackendAnchorService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useToast } from '@/components/ToastProvider';
import { logger } from '@/utils/logger';
import { RitualScaffold } from './components/RitualScaffold';
import { FocusSession } from './components/FocusSession';
import { CompletionModal } from './components/CompletionModal';
import { ConfirmModal } from './components/ConfirmModal';
import { PostPrimeTraceModal } from './components/PostPrimeTraceModal';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { TEACHINGS } from '@/constants/teaching';
import { useNotificationController } from '@/hooks/useNotificationController';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import {
  isPostPrimeTraceEligible,
  markPostPrimeTraceAttemptStarted,
} from '@/utils/postPrimeTraceEligibility';
import { useMissingAnchorRedirect } from './utils/useMissingAnchorRedirect';
import { queueProgressionMilestonesFromStores } from '@/utils/progressionMilestones';
import {
  buildRecoveredChargeState,
  isFirstPrimeForAnchor as isAnchorFirstPrime,
  needsChargeStateBackfill,
} from '@/utils/anchorPriming';

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;

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
  const focusSessionDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const focusSessionAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'silent');
  const { recordSession, bumpThreadStrength } = useSessionStore();
  const { recordShown } = useTeachingStore();
  const { handlePrimeComplete } = useNotificationController();
  const beginPostPrimeTraceFlow = usePostPrimeTraceStore((state) => state.beginFlow);
  const activeFlow = usePostPrimeTraceStore((state) => state.activeFlow);
  const anchor = getAnchorById(anchorId);
  const isPendingFirstAnchor = pendingFirstAnchorDraft?.tempAnchorId === anchorId;
  const anchorHeroUri = anchor
    ? anchor.enhancedImageUrl || anchor.reinforcedSigilSvg || anchor.baseSigilSvg || ''
    : '';
  const isFirstPrimeForAnchor = isAnchorFirstPrime(anchor);
  const shouldBackfillChargeState = needsChargeStateBackfill(anchor);
  const isAnchorMissing = !anchor;

  useMissingAnchorRedirect(!isAnchorMissing, navigation);

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
  const [showPostPrimeTrace, setShowPostPrimeTrace] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [pendingPostPrimeFlowId, setPendingPostPrimeFlowId] = useState<string | null>(null);
  const exitingRef = React.useRef(false);
  const sessionCompletedRef = React.useRef(false);
  const focusSessionExitAudioHandlerRef = React.useRef<(() => Promise<void>) | null>(null);
  const completionTransitionTaskRef = React.useRef<{ cancel?: () => void } | null>(null);

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

    return Math.max(10, Math.min(120, Math.round(focusSessionDuration)));
  }, [durationOverride, focusSessionDuration]);

  const logActivationInBackground = useCallback(async (): Promise<void> => {
    const localActivationTime = new Date();
    const currentActivationCount = anchor?.activationCount ?? 0;
    const recoveredChargeState =
      isFirstPrimeForAnchor
        ? buildRecoveredChargeState(anchor, localActivationTime, { incrementChargeCount: true })
        : shouldBackfillChargeState
          ? buildRecoveredChargeState(anchor, localActivationTime)
          : null;
    let effectiveAnchorId = anchorId;
    let backendSyncFailed = false;

    updateAnchor(anchorId, {
      activationCount: currentActivationCount + 1,
      lastActivatedAt: localActivationTime,
      ...(recoveredChargeState ?? {}),
    });

    incrementTotalPrimes();
    computeStreak();

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

      try {
        const persistedAnchor = await BackendAnchorService.ensureServerAnchor(anchorId);
        effectiveAnchorId = persistedAnchor?.id ?? anchorId;
      } catch (syncError) {
        backendSyncFailed = true;
        logger.warn('Anchor create sync failed before activation, saving locally only', syncError);
      }

      if (!backendSyncFailed && !isBackendAnchorId(effectiveAnchorId)) {
        backendSyncFailed = true;
      }

      if (backendSyncFailed) {
        toast.error('Activation completed but failed to sync. Will retry later.');
        return;
      }

      const response = await apiClient.post(`/api/anchors/${effectiveAnchorId}/activate`, {
        activationType: activationType || 'visual',
        durationSeconds: activationDurationSeconds,
      });

      if (response.data.data) {
        const data = response.data.data;
        const serverChargeState: Partial<typeof recoveredChargeState> = {};

        if (data.isCharged != null) {
          serverChargeState.isCharged = data.isCharged;
        }

        if (data.chargedAt) {
          serverChargeState.chargedAt = new Date(data.chargedAt);
        }

        if (data.firstChargedAt) {
          serverChargeState.firstChargedAt = new Date(data.firstChargedAt);
        }

        if (data.chargeCount != null) {
          serverChargeState.chargeCount = data.chargeCount;
        }

        updateAnchor(anchorId, {
          activationCount: data.activationCount,
          lastActivatedAt: data.lastActivatedAt ? new Date(data.lastActivatedAt) : undefined,
          ...(recoveredChargeState ?? {}),
          ...serverChargeState,
        });
      }

      toast.success('Activation logged successfully');
    } catch (error) {
      if (error instanceof Error && error.message === 'Anchor not found') {
        toast.error('This anchor is no longer available.');
        navigateToVaultDestination(navigation as any, 'replace');
        return;
      }

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
    isFirstPrimeForAnchor,
    shouldBackfillChargeState,
    toast,
    updateAnchor,
  ]);

  // Show completion modal instead of immediately going back
  const handleSessionCompleted = useCallback(() => {
    sessionCompletedRef.current = true;
    setShowExitWarning(false);
    recordPrimeSession();
  }, [recordPrimeSession]);

  const showReflectionModal = useCallback(() => {
    sessionCompletedRef.current = true;
    setShowPostPrimeTrace(false);
    setShowExitWarning(false);

    completionTransitionTaskRef.current?.cancel?.();
    completionTransitionTaskRef.current = InteractionManager.runAfterInteractions(() => {
      setShowCompletion(true);
      completionTransitionTaskRef.current = null;
    });
  }, []);

  const handleComplete = useCallback(async () => {
    sessionCompletedRef.current = true;
    setShowExitWarning(false);

    // Log the activation immediately when the seal completes — not gated on modal "Done"
    void logActivationInBackground();
    await handlePrimeComplete();

    if (isFirstPrimeForAnchor) {
      showReflectionModal();
      return;
    }

    const shouldOfferPostPrimeTrace = await isPostPrimeTraceEligible();

    if (shouldOfferPostPrimeTrace) {
      setShowPostPrimeTrace(true);
      return;
    }

    showReflectionModal();
  }, [handlePrimeComplete, isFirstPrimeForAnchor, logActivationInBackground, showReflectionModal]);

  const handleSkipPostPrimeTrace = useCallback(() => {
    showReflectionModal();
  }, [showReflectionModal]);

  const handleBeginPostPrimeTrace = useCallback(async () => {
    await markPostPrimeTraceAttemptStarted();

    const flowId = beginPostPrimeTraceFlow(anchorId);
    setPendingPostPrimeFlowId(flowId);
    setShowPostPrimeTrace(false);

    (navigation as any).navigate('ManualReinforcement', {
      source: 'post_prime_trace',
      anchorId,
    });
  }, [anchorId, beginPostPrimeTraceFlow, navigation]);

  useEffect(() => {
    return () => {
      completionTransitionTaskRef.current?.cancel?.();
    };
  }, []);

  useEffect(() => {
    if (!pendingPostPrimeFlowId) {
      return;
    }

    if (
      !activeFlow ||
      activeFlow.flowId !== pendingPostPrimeFlowId ||
      activeFlow.result === 'pending'
    ) {
      return;
    }

    const completedPostPrimeTrace = activeFlow.result === 'completed';

    usePostPrimeTraceStore.getState().clearFlow(pendingPostPrimeFlowId);
    setPendingPostPrimeFlowId(null);

    if (completedPostPrimeTrace) {
      bumpThreadStrength(2);
      AnalyticsService.track('post_prime_trace_completed', {
        anchor_id: anchorId,
        session_duration_seconds: activationDurationSeconds,
      });
    }

    showReflectionModal();
  }, [
    activeFlow,
    activationDurationSeconds,
    anchorId,
    bumpThreadStrength,
    pendingPostPrimeFlowId,
    showReflectionModal,
  ]);

  const exitSession = useCallback(async () => {
    exitingRef.current = true;
    setShowExitWarning(false);
    await focusSessionExitAudioHandlerRef.current?.();

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

    if (returnTo === 'vault') {
      if (isPendingFirstAnchor) {
        (navigation as any).replace('SaveProgress', { anchorId });
      } else {
        navigateToVaultDestination(navigation as any, 'replace');
      }
      return;
    }

    navigation.goBack();
  }, [anchorId, isPendingFirstAnchor, navigateToPractice, navigation, returnTo]);

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
      mode: focusSessionAudio,
      reflectionWord,
      completedAt: new Date().toISOString(),
    });
    await queueProgressionMilestonesFromStores();

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
    } else if (returnTo === 'vault') {
      if (isPendingFirstAnchor) {
        (navigation as any).replace('SaveProgress', { anchorId });
      } else {
        navigateToVaultDestination(navigation as any, 'replace');
      }
    } else {
      navigation.goBack();
    }
  }, [
    anchorId,
    activationDurationSeconds,
    isPendingFirstAnchor,
    logActivationInBackground,
    navigateToPractice,
    navigation,
    recordSession,
    handlePrimeComplete,
    focusSessionAudio,
    returnTo,
  ]);

  if (isAnchorMissing) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Anchor not found. Returning to vault...</Text>
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
        registerExitAudioHandler={(handler) => {
          focusSessionExitAudioHandlerRef.current = handler;
        }}
        onDismiss={() => {
          if (sessionCompletedRef.current) {
            handleComplete();
            return;
          }
          promptExitSession();
        }}
      />
      <PostPrimeTraceModal
        visible={showPostPrimeTrace}
        anchor={anchor}
        onTrace={handleBeginPostPrimeTrace}
        onSkip={handleSkipPostPrimeTrace}
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
