import React, { useCallback, useEffect } from 'react';
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

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
  const { navigateToVault } = useTabNavigation();
  const releaseAnchor = useAnchorStore((state) => state.releaseAnchor);
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { setUserFlag, queueMilestone, recordShown, userFlags } = useTeachingStore();
  const toast = useToast();
  const { handleBurnFlowEntered, handleSigilVaulted } = useNotificationController();

  const { anchorId, sigilSvg, enhancedImageUrl } = route.params;
  const anchor = getAnchorById(anchorId);
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

      try {
        await post(`/api/anchors/${anchorId}/burn`, {});
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
        // Anchor is confirmed gone from server — fall through to local release
      }
    }

    // Local update happens for everyone
    releaseAnchor(anchorId);
    await queueProgressionMilestonesFromStores({ sourceEventId: `release:${anchorId}` });
    await handleSigilVaulted();
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
    navigateToVault();
  }, [navigation, navigateToVault]);

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
