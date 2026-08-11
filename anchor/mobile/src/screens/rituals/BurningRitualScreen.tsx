import React, { useCallback, useEffect, useRef } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { BurnAnimationOverlay } from './components/BurnAnimationOverlay';
import { RootStackParamList } from '@/types';
import { post } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useTeachingStore } from '@/stores/teachingStore';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { TEACHINGS } from '@/constants/teaching';
import { useToast } from '@/components/ToastProvider';
import { resolveBurnArtworkUri } from './utils/resolveBurnArtworkUri';
import { AuthService } from '@/services/AuthService';
import { useNotificationController } from '../../hooks/useNotificationController';
import { queueProgressionMilestonesFromStores } from '@/utils/progressionMilestones';
import {
  JOURNEY_MILESTONE_IDS,
  JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE,
} from '@/constants/milestones';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { createPracticeEventId } from '@/utils/primingAnalytics';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
  const { navigateToSanctuary: canonicalNavigateToSanctuary, navigateToVault } = useTabNavigation();
  const navigateToSanctuary = canonicalNavigateToSanctuary ?? (() => navigateToVault());
  const releaseAnchor = useAnchorStore((state) => state.releaseAnchor);
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const { setUserFlag, queueMilestone, recordShown, userFlags } = useTeachingStore();
  const toast = useToast();
  const { handleBurnFlowEntered, handleSigilVaulted } = useNotificationController();

  const { anchorId, sigilSvg, enhancedImageUrl, returnTo } = route.params;
  const anchor = getAnchorById(anchorId);
  const releaseAnchorSnapshotRef = useRef(anchor);
  const releaseEventIdRef = useRef(createPracticeEventId());
  const releaseStartedAtRef = useRef(new Date().toISOString());
  if (anchor) releaseAnchorSnapshotRef.current = anchor;
  const resolvedSigilSvg = sigilSvg || anchor?.reinforcedSigilSvg || anchor?.baseSigilSvg || '';
  const resolvedEnhancedImageUrl = enhancedImageUrl || resolveBurnArtworkUri(anchor);

  // Ash Line (Pattern 8): shown in Phase 4 success, guide ON, first burn only
  const ashLineTeaching = useTeachingGate({
    screenId: 'burning_ritual',
    candidateIds: ['burn_ash_line_v1'],
  });

  useEffect(() => {
    void handleBurnFlowEntered();
  }, [handleBurnFlowEntered]);

  const handleCommitBurn = useCallback(async () => {
    const token = await AuthService.getIdToken();

    // Only attempt backend sync if we have a session
    if (isAuthenticated) {
      if (!token) {
        throw new Error('Auth session stale');
      }

      const releaseAnchorSnapshot = releaseAnchorSnapshotRef.current;
      if (!accountId || !releaseAnchorSnapshot) {
        throw new Error('Release history could not be tied to this account and anchor.');
      }

      // Captured up front (via the ref) so the completion record has full
      // anchor context even once the server deletes the anchor relation, but
      // only actually committed — durably persisted, and counted toward
      // Thread Strength — once the burn is confirmed. Retrying this callback
      // reuses the same event ID.
      const commitRelease = () => {
        const elapsedSeconds = Math.max(
          1,
          Math.round(
            (Date.now() - new Date(releaseStartedAtRef.current).getTime()) / 1000,
          ),
        );
        return PracticeCompletionService.commitReleaseCompletion({
          id: releaseEventIdRef.current,
          accountId,
          anchor: releaseAnchorSnapshot,
          startedAt: releaseStartedAtRef.current,
          durationSeconds: elapsedSeconds,
          source: 'anchor_detail',
        });
      };

      try {
        await post(`/api/anchors/${anchorId}/burn`, {});
        // The burn is already confirmed by the server. Keep ledger persistence
        // best-effort so a local storage problem cannot make a released sigil
        // look like a failed ritual.
        void commitRelease().catch((error) => {
          ErrorTrackingService.captureException(
            error instanceof Error ? error : new Error('Failed to record release completion'),
            { screen: 'BurningRitualScreen', action: 'record_release_completion' }
          );
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : '';
        // 404 = anchor already deleted (e.g. previous attempt succeeded but response was lost)
        // "already archived" = anchor archived via another path — either way it's gone
        const isAlreadyGone =
          msg === 'Anchor not found' || msg === 'Anchor is already archived';

        if (!isAlreadyGone) {
          AnalyticsService.track(AnalyticsEvents.BURN_FAILED, { anchor_id: anchorId });
          FrictionAnalytics.flowError('burn_release', 'burning_ritual', 'backend_burn_failed', {
            anchor_id: anchorId,
            message: msg,
          });
          ErrorTrackingService.captureException(
            error instanceof Error ? error : new Error('Unknown error during anchor burn'),
            { screen: 'BurningRitualScreen' }
          );
          throw error;
        }
        // Anchor is confirmed gone from server. Record the completion without
        // allowing storage latency to block the already-completed ritual.
        void commitRelease().catch((commitError) => {
          ErrorTrackingService.captureException(
            commitError instanceof Error
              ? commitError
              : new Error('Failed to record already-released completion'),
            { screen: 'BurningRitualScreen', action: 'record_release_completion' }
          );
        });
      }
    }

    // Local update happens for everyone
    releaseAnchor(anchorId);
    if (accountId) void PracticeCompletionService.flush(accountId);

    // These side effects are retryable bookkeeping. They must not keep the
    // success screen behind a slow storage or notification sync operation.
    void queueProgressionMilestonesFromStores({
      sourceEventId: releaseEventIdRef.current,
    }).catch((error) => {
      ErrorTrackingService.captureException(
        error instanceof Error ? error : new Error('Failed to queue release milestones'),
        { screen: 'BurningRitualScreen', action: 'queue_release_milestones' }
      );
    });
    void handleSigilVaulted().catch((error) => {
      ErrorTrackingService.captureException(
        error instanceof Error ? error : new Error('Failed to update release notifications'),
        { screen: 'BurningRitualScreen', action: 'update_release_notifications' }
      );
    });
    AnalyticsService.track(AnalyticsEvents.BURN_COMPLETED, { anchor_id: anchorId });
    FrictionAnalytics.completeFlow('burn_release', {
      anchor_id: anchorId,
      result: 'burn_completed',
    });

    // Set first-burn flag (once)
    if (!userFlags.hasCompletedFirstBurn) {
      setUserFlag('hasCompletedFirstBurn', true);
      queueMilestone(
        JOURNEY_TEACHING_CONTENT_ID_BY_MILESTONE[JOURNEY_MILESTONE_IDS.firstRelease]
      );
    }

    // Post-burn Signal Pulse — fires for ALL users on every burn ([both])
    const postBurnContent = TEACHINGS['post_burn_toast_v1'];
    if (postBurnContent) {
      toast.info(postBurnContent.copy);
    }

    // Record ash line shown (if it will show)
    if (ashLineTeaching) {
      const content = TEACHINGS[ashLineTeaching.teachingId];
      recordShown(ashLineTeaching.teachingId, ashLineTeaching.pattern, content?.maxShows ?? 1);
      AnalyticsService.track('teaching_shown', {
        teaching_id: ashLineTeaching.teachingId,
        pattern: ashLineTeaching.pattern,
        screen: 'burning_ritual',
        trigger: ashLineTeaching.trigger,
        guide_mode: true,
      });
    }
  }, [
    anchorId,
    accountId,
    isAuthenticated,
    releaseAnchor,
    handleSigilVaulted,
    userFlags.hasCompletedFirstBurn,
    setUserFlag,
    queueMilestone,
    toast,
    ashLineTeaching,
    recordShown,
  ]);

  const handleReturnToSanctuary = useCallback(() => {
    if (typeof navigation.popToTop === 'function') {
      navigation.popToTop();
    } else {
      navigation.goBack();
    }
    // Releasing is final for this Anchor: completion always returns to
    // Sanctuary, never to a stale Practice or Detail route.
    navigateToSanctuary();
  }, [navigation, navigateToSanctuary]);

  const handleReturnToAnchor = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <BurnAnimationOverlay
      sigilSvg={resolvedSigilSvg}
      enhancedImageUrl={resolvedEnhancedImageUrl}
      isCharged={anchor?.isCharged ?? false}
      onCommitBurn={handleCommitBurn}
      onReturnToSanctuary={handleReturnToSanctuary}
      onReturnToAnchor={handleReturnToAnchor}
      ashLineText={ashLineTeaching?.copy}
    />
  );
};
