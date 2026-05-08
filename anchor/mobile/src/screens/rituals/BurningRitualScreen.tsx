import React, { useCallback, useEffect } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BurnAnimationOverlay } from './components/BurnAnimationOverlay';
import { RootStackParamList } from '@/types';
import { post } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useTeachingStore } from '@/stores/teachingStore';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { TEACHINGS } from '@/constants/teaching';
import { useToast } from '@/components/ToastProvider';
import { resolveBurnArtworkUri } from './utils/resolveBurnArtworkUri';
import { AuthService } from '@/services/AuthService';
import { useNotificationController } from '../../hooks/useNotificationController';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
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
        AnalyticsService.track(AnalyticsEvents.BURN_FAILED, { anchor_id: anchorId });
        ErrorTrackingService.captureException(
          error instanceof Error ? error : new Error('Unknown error during anchor burn'),
          { screen: 'BurningRitualScreen' }
        );
        throw error;
      }
    }

    // Local update happens for everyone
    releaseAnchor(anchorId);
    await handleSigilVaulted();
    AnalyticsService.track(AnalyticsEvents.BURN_COMPLETED, { anchor_id: anchorId });

    // Set first-burn flag (once)
    if (!userFlags.hasCompletedFirstBurn) {
      setUserFlag('hasCompletedFirstBurn', true);
      queueMilestone('milestone_first_burn_v1');
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
    navigation.navigate('Vault');
  }, [navigation]);

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
