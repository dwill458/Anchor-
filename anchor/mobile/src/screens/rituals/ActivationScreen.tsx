/**
 * Anchor App - Activation Screen
 *
 * Focused session for your anchor.
 * On completion, shows CompletionModal for one-word reflection,
 * then records the session in sessionStore before navigating back.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BackHandler, View, Text, StyleSheet, InteractionManager } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackNavigationProp } from '@react-navigation/stack';
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
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import {
  recordReviewSignal,
  requestReviewIfEligible,
} from '@/services/reviewPromptService';
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
import { usePrimeSessionAccess } from '@/hooks/usePrimeSessionAccess';
import { createPracticeEventId } from '@/utils/primingAnalytics';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  legacyAudioModeToSessionAudioDefaults,
  resolveSessionAudioConfiguration,
  type SessionAudioConfiguration,
  type SessionAudioDefaults,
} from '@/types/sessionAudio';
import { persistSessionAudioDefaults } from '@/services/SessionAudioPreferencesService';
import { resolveSessionAudioPlan } from '@/services/SessionAudioManifest';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { useCourseStore } from '@/stores/courseStore';
import { resolveChartFeatureFlags } from '@/types/chart';

type ActivationRouteProp = RouteProp<RootStackParamList, 'ActivationRitual'>;
type ActivationNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ActivationRitual'>;

export const ActivationScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { navigateToPractice, navigateToPaywall, navigateToChart } = useTabNavigation();
  const route = useRoute<ActivationRouteProp>();
  const {
    anchorId,
    activationType,
    durationOverride,
    audioConfiguration,
    audioModeOverride,
    returnTo,
    practiceContext,
  } = route.params;
  const activeAccountId = useAuthStore((state) => state.user?.id ?? null);
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
  const focusSessionAudioDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults?.focus ?? DEFAULT_SESSION_AUDIO_DEFAULTS.focus
  );
  const [resolvedFocusSessionAudio, setResolvedFocusSessionAudio] =
    useState<SessionAudioConfiguration>(() =>
      audioConfiguration ??
      resolveSessionAudioConfiguration(
        focusSessionAudioDefaults,
        audioModeOverride
          ? legacyAudioModeToSessionAudioDefaults(audioModeOverride)
          : undefined
      )
    );
  const traceDefaultEnabled = useSettingsStore((state) => state.traceDefaultEnabled ?? true);
  const { recordSession, bumpThreadStrength } = useSessionStore();
  const { recordShown } = useTeachingStore();
  const { handlePrimeComplete } = useNotificationController();
  const beginPostPrimeTraceFlow = usePostPrimeTraceStore((state) => state.beginFlow);
  const activeFlow = usePostPrimeTraceStore((state) => state.activeFlow);
  const primeSessionAccess = usePrimeSessionAccess();
  const anchor = getAnchorById(anchorId);
  const isPendingFirstAnchor = pendingFirstAnchorDraft?.tempAnchorId === anchorId;
  const anchorHeroUri = anchor
    ? anchor.enhancedImageUrl || anchor.reinforcedSigilSvg || anchor.baseSigilSvg || ''
    : '';
  const isFirstPrimeForAnchor = isAnchorFirstPrime(anchor);
  const shouldBackfillChargeState = needsChargeStateBackfill(anchor);
  const isAnchorMissing = !anchor;

  useMissingAnchorRedirect(!isAnchorMissing, navigation);

  useEffect(() => {
    if (isAnchorMissing || primeSessionAccess.focus.isAllowed) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      navigation.goBack();
      requestAnimationFrame(() => {
        AnalyticsService.track('free_weekly_sessions_used', {
          source: 'activation_screen_backstop',
          remaining_weekly_free_sessions: primeSessionAccess.focus.remaining,
          tier: primeSessionAccess.tier,
        });

        navigateToPaywall({
          source: 'free_weekly_sessions_used',
          preferredPlanId: 'annual',
        });
      });
    });

    return () => task.cancel();
  }, [isAnchorMissing, navigateToPaywall, navigation, primeSessionAccess.focus.isAllowed]);

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
  const completionStartedRef = React.useRef(false);
  const hasRecordedRef = React.useRef(false);
  const hasLoggedActivationRef = React.useRef(false);
  const activationSyncFailedRef = React.useRef(false);
  const completionEventIdRef = React.useRef(createPracticeEventId());
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
  const focusSessionAudioPlan = useMemo(
    () =>
      resolveSessionAudioPlan({
        sessionType: 'focus',
        durationSeconds: activationDurationSeconds,
        configuration: resolvedFocusSessionAudio,
      }),
    [activationDurationSeconds, resolvedFocusSessionAudio]
  );

  const logActivationInBackground = useCallback(async (): Promise<void> => {
    if (hasLoggedActivationRef.current) return;
    hasLoggedActivationRef.current = true;
    activationSyncFailedRef.current = false;

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

    const trackActivationCompleted = (backendSynced: boolean, queued = false) => {
      const properties = {
        anchor_id: effectiveAnchorId,
        activation_type: activationType || 'visual',
        duration_seconds: activationDurationSeconds,
        backend_synced: backendSynced,
        queued,
        is_first_prime: isFirstPrimeForAnchor,
        guidance_voice: focusSessionAudioPlan.configuration.guidanceVoice,
        requested_guidance_voice:
          focusSessionAudioPlan.requestedConfiguration.guidanceVoice,
        background_audio: focusSessionAudioPlan.configuration.backgroundAudio,
        audio_source: focusSessionAudioPlan.configuration.source,
      };
      AnalyticsService.track(AnalyticsEvents.ANCHOR_ACTIVATED, properties);
      AnalyticsService.track(AnalyticsEvents.ACTIVATION_RITUAL_COMPLETED, properties);
    };

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
          idempotencyKey: completionEventIdRef.current,
          queuedAt: localActivationTime.toISOString(),
        });
        toast.success('Prime session saved for your first anchor');
        trackActivationCompleted(false, true);
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
        activationSyncFailedRef.current = true;
        toast.error('Prime session completed but failed to sync. Will retry later.');
        trackActivationCompleted(false);
        return;
      }

      const response = await apiClient.post(`/api/anchors/${effectiveAnchorId}/activate`, {
        activationType: activationType || 'visual',
        durationSeconds: activationDurationSeconds,
        idempotencyKey: completionEventIdRef.current,
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

      toast.success('Prime session logged successfully');
      trackActivationCompleted(true);
    } catch (error) {
      if (error instanceof Error && error.message === 'Anchor not found') {
        activationSyncFailedRef.current = true;
        toast.error('This anchor is no longer available.');
        navigateToVaultDestination(navigation, 'replace');
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

      activationSyncFailedRef.current = true;
      toast.error('Prime session completed but failed to sync. Will retry later.');
      trackActivationCompleted(false);
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
    focusSessionAudioPlan,
    shouldBackfillChargeState,
    toast,
    updateAnchor,
  ]);

  const scheduleReviewRequestAfterHomeReturn = useCallback(() => {
    if (isPendingFirstAnchor || (returnTo !== 'practice' && returnTo !== 'vault')) {
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      void requestReviewIfEligible('focus_session_complete', {
        isReturningToHomeAfterFocusSession: true,
        recentSessionFailed: activationSyncFailedRef.current,
        isOnboarding: false,
        isAnchorCreation: false,
        isPaywall: false,
        isActiveFocusSession: false,
        isActiveDeepPrimeSession: false,
      });
    });
  }, [isPendingFirstAnchor, returnTo]);

  // Show completion modal instead of immediately going back
  const handleSessionCompleted = useCallback(() => {
    sessionCompletedRef.current = true;
    setShowExitWarning(false);
    recordPrimeSession();
  }, [recordPrimeSession]);

  const showReflectionModal = useCallback((options?: { keepTraceLink?: boolean }) => {
    sessionCompletedRef.current = true;
    if (!options?.keepTraceLink) {
      setShowPostPrimeTrace(false);
    }
    setShowExitWarning(false);

    completionTransitionTaskRef.current?.cancel?.();
    completionTransitionTaskRef.current = InteractionManager.runAfterInteractions(() => {
      setShowCompletion(true);
      completionTransitionTaskRef.current = null;
    });
  }, []);

  const handleComplete = useCallback(async () => {
    if (completionStartedRef.current) {
      return;
    }
    completionStartedRef.current = true;
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
      if (!traceDefaultEnabled) {
        showReflectionModal({ keepTraceLink: true });
      }
      return;
    }

    showReflectionModal();
  }, [
    handlePrimeComplete,
    isFirstPrimeForAnchor,
    logActivationInBackground,
    showReflectionModal,
    traceDefaultEnabled,
  ]);

  const handleSkipPostPrimeTrace = useCallback(() => {
    showReflectionModal();
  }, [showReflectionModal]);

  const handleBeginPostPrimeTrace = useCallback(async () => {
    await markPostPrimeTraceAttemptStarted();

    const flowId = beginPostPrimeTraceFlow(anchorId);
    setPendingPostPrimeFlowId(flowId);
    setShowPostPrimeTrace(false);
    setShowCompletion(false);

    navigation.navigate('ManualReinforcement', {
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
      FrictionAnalytics.completeFlow('activation', {
        anchor_id: anchorId,
        result: 'post_prime_trace_completed',
        session_duration_seconds: activationDurationSeconds,
      });
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
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      } else {
        navigation.goBack();
      }
      navigateToPractice();
      return;
    }

    if (returnTo === 'detail') {
      navigation.navigate('AnchorDetail', { anchorId });
      return;
    }

    if (returnTo === 'vault') {
      if (isPendingFirstAnchor && anchor) {
        navigation.replace('SaveProgress', { anchor });
      } else {
        navigateToVaultDestination(navigation, 'replace');
      }
      return;
    }

    navigation.goBack();
  }, [anchor, anchorId, isPendingFirstAnchor, navigateToPractice, navigation, returnTo]);

  const promptExitSession = useCallback(() => {
    setShowExitWarning(true);
  }, []);

  React.useEffect(() => {
    if (typeof navigation.addListener !== 'function') {
      return () => undefined;
    }
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
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

  useEffect(() => {
    const hardwareBackSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitingRef.current) {
        return false;
      }
      if (sessionCompletedRef.current) {
        handleComplete();
        return true;
      }
      promptExitSession();
      return true;
    });

    return () => {
      hardwareBackSubscription.remove();
    };
  }, [handleComplete, promptExitSession]);

  const handleCompletionDone = useCallback(async (reflectionWord?: string) => {
    if (hasRecordedRef.current) {
      return;
    }
    hasRecordedRef.current = true;

    setShowCompletion(false);
    setShowExitWarning(false);
    exitingRef.current = true;

    // Record session locally
    const completedAt = new Date().toISOString();
    const completionEventId = recordSession({
      idempotencyKey: completionEventIdRef.current,
      anchorId,
      type: 'activate',
      durationSeconds: activationDurationSeconds,
      mode:
        focusSessionAudioPlan.configuration.backgroundAudio === 'ambient' ||
        focusSessionAudioPlan.configuration.guidanceVoice !== 'none'
          ? 'ambient'
          : 'silent',
      audioConfiguration: focusSessionAudioPlan.configuration,
      reflectionWord,
      completedAt,
    });
    await PracticeCompletionService.queueLegacyCompletion({
      id: completionEventId,
      anchorId,
      anchorLocalId: anchor?.localId,
      practiceMode: 'focus',
      durationSeconds: activationDurationSeconds,
      completedAt,
      guidanceVoice: focusSessionAudioPlan.configuration.guidanceVoice,
      backgroundAudio: focusSessionAudioPlan.configuration.backgroundAudio,
      source: returnTo === 'practice' ? 'practice_screen' : 'anchor_detail',
      chartContext: practiceContext,
    });
    void recordReviewSignal('focus_session_completed');
    await queueProgressionMilestonesFromStores({ sourceEventId: completionEventId });

    if (practiceContext && activeAccountId === practiceContext.accountId) {
      const freshCourse = await useCourseStore.getState().fetchCourseDetail(practiceContext.courseId);
      const flags = resolveChartFeatureFlags(useAuthStore.getState().user?.chartFlags);
      if (useAuthStore.getState().user?.id === practiceContext.accountId && flags.chart_enabled && freshCourse) {
        const returnWaypointId = freshCourse.currentWaypointId && freshCourse.waypoints.some((item) => item.id === freshCourse.currentWaypointId)
          ? freshCourse.currentWaypointId
          : practiceContext.waypointId;
        if (freshCourse.waypoints.some((item) => item.id === returnWaypointId)) {
          if (typeof navigation.popToTop === 'function') navigation.popToTop();
          navigateToChart('WaypointDetail', { courseId: freshCourse.id, waypointId: returnWaypointId });
          if (flags.chart_reflections_enabled) {
            navigateToChart('ReflectionComposer', {
              source: 'POST_PRACTICE',
              promptType: 'HOW_DO_YOU_FEEL_NOW',
              promptVersion: 1,
              courseId: practiceContext.courseId,
              waypointId: practiceContext.waypointId,
              practiceSessionId: completionEventId,
              anchorId,
            });
          }
          return;
        }
      }
      // A removed/disabled Chart falls back to the canonical Practice landing;
      // completion was already committed and must never be retried here.
    }

    if (returnTo === 'practice') {
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      }
      navigateToPractice();
      scheduleReviewRequestAfterHomeReturn();
    } else if (returnTo === 'reinforce') {
      navigation.replace('Ritual', {
        anchorId,
        ritualType: 'ritual',
        durationSeconds: 300,
        returnTo: 'detail',
      });
    } else if (returnTo === 'detail') {
      navigation.navigate('AnchorDetail', { anchorId });
    } else if (returnTo === 'vault') {
      if (isPendingFirstAnchor && anchor) {
        navigation.replace('SaveProgress', { anchor });
      } else {
        navigateToVaultDestination(navigation, 'replace');
        scheduleReviewRequestAfterHomeReturn();
      }
    } else {
      navigation.goBack();
    }
  }, [
    anchor,
    activeAccountId,
    anchorId,
    activationDurationSeconds,
    isPendingFirstAnchor,
    logActivationInBackground,
    navigateToPractice,
    navigateToChart,
    navigation,
    recordSession,
    handlePrimeComplete,
    focusSessionAudioPlan,
    returnTo,
    practiceContext,
    scheduleReviewRequestAfterHomeReturn,
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
        audioConfiguration={resolvedFocusSessionAudio}
        onAudioConfigurationChange={(value: SessionAudioDefaults, makeDefault: boolean) => {
          setResolvedFocusSessionAudio({ ...value, source: 'session_override' });
          if (makeDefault) {
            void persistSessionAudioDefaults('focus', value).catch(() => undefined);
          }
        }}
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
        compact={!traceDefaultEnabled}
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
        primaryCtaLabel="Keep Practicing"
        secondaryCtaLabel="Exit"
        onPrimary={() => setShowExitWarning(false)}
        onSecondary={exitSession}
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
