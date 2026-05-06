/**
 * Anchor App - Activation Screen
 *
 * Focused session for your anchor.
 * On completion, shows CompletionModal for one-word reflection,
 * then records the session in sessionStore before navigating back.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAnchorStore } from '../../stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useForgeMomentStore } from '@/stores/forgeMomentStore';
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
import { ConfirmModal } from './components/ConfirmModal';
import { PostPrimeTraceModal } from './components/PostPrimeTraceModal';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { TEACHINGS } from '@/constants/teaching';
import { getCurrentRank } from '@/utils/practiceRank';
import { useNotificationController } from '@/hooks/useNotificationController';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import {
  isPostPrimeTraceEligible,
  markPostPrimeTraceAttemptStarted,
} from '@/utils/postPrimeTraceEligibility';

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
  const queueMilestone = useForgeMomentStore((state) => state.queueMilestone);
  const focusSessionDuration = useSettingsStore((state) => state.focusSessionDuration ?? 30);
  const focusSessionAudio = useSettingsStore((state) => state.focusSessionAudio ?? 'silent');
  const { recordSession, bumpThreadStrength } = useSessionStore();
  const { recordShown } = useTeachingStore();
  const { handlePrimeComplete } = useNotificationController();
  const beginPostPrimeTraceFlow = usePostPrimeTraceStore((state) => state.beginFlow);
  const anchor = getAnchorById(anchorId);
  const isPendingFirstAnchor = pendingFirstAnchorDraft?.tempAnchorId === anchorId;
  const anchorHeroUri = anchor
    ? anchor.enhancedImageUrl || anchor.reinforcedSigilSvg || anchor.baseSigilSvg || ''
    : '';
  const isFirstPrimeForAnchor =
    !anchor?.isCharged &&
    !anchor?.firstChargedAt &&
    (anchor?.chargeCount ?? 0) === 0 &&
    (anchor?.activationCount ?? 0) === 0;

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
    const chargedAt = isFirstPrimeForAnchor ? localActivationTime : anchor?.chargedAt;
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
      ...(isFirstPrimeForAnchor
        ? {
            isCharged: true,
            chargedAt,
            firstChargedAt: anchor?.firstChargedAt ?? chargedAt,
            chargeCount: (anchor?.chargeCount ?? 0) + 1,
          }
        : {}),
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
    isFirstPrimeForAnchor,
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

  const showReflectionModal = useCallback(() => {
    sessionCompletedRef.current = true;
    setShowPostPrimeTrace(false);
    setShowExitWarning(false);
    setShowCompletion(true);
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

  useFocusEffect(
    useCallback(() => {
      if (!pendingPostPrimeFlowId) {
        return () => undefined;
      }

      // Read synchronously — avoids waiting for a Zustand subscription re-render
      const { activeFlow, clearFlow } = usePostPrimeTraceStore.getState();

      if (
        !activeFlow ||
        activeFlow.flowId !== pendingPostPrimeFlowId ||
        activeFlow.result === 'pending'
      ) {
        return () => undefined;
      }

      const completedPostPrimeTrace = activeFlow.result === 'completed';

      clearFlow(pendingPostPrimeFlowId);
      setPendingPostPrimeFlowId(null);

      if (completedPostPrimeTrace) {
        bumpThreadStrength(2);
        AnalyticsService.track('post_prime_trace_completed', {
          anchor_id: anchorId,
          session_duration_seconds: activationDurationSeconds,
        });
      }

      showReflectionModal();

      return () => undefined;
    }, [
      activationDurationSeconds,
      anchorId,
      bumpThreadStrength,
      pendingPostPrimeFlowId,
      showReflectionModal,
    ])
  );

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

    if (returnTo === 'vault') {
      navigateToVaultDestination(navigation as any, 'replace');
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
      mode: focusSessionAudio,
      reflectionWord,
      completedAt: new Date().toISOString(),
    });

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
      navigateToVaultDestination(navigation as any, 'replace');
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
    focusSessionAudio,
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
