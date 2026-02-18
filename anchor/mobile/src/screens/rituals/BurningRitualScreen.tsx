import React, { useCallback } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BurnAnimationOverlay } from './components/BurnAnimationOverlay';
import { RootStackParamList } from '@/types';
import { post } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
  const { removeAnchor } = useAnchorStore();

  const { anchorId, sigilSvg, enhancedImageUrl } = route.params;

  const handleCommitBurn = useCallback(async () => {
    try {
      await post(`/api/anchors/${anchorId}/burn`, {});
      removeAnchor(anchorId);
      AnalyticsService.track(AnalyticsEvents.BURN_COMPLETED, { anchor_id: anchorId });
    } catch (error) {
      AnalyticsService.track(AnalyticsEvents.BURN_FAILED, { anchor_id: anchorId });
      ErrorTrackingService.captureException(
        error instanceof Error ? error : new Error('Unknown error during anchor burn'),
        { screen: 'BurningRitualScreen' }
      );
      throw error;
    }
  }, [anchorId, removeAnchor]);

  const handleReturnToSanctuary = useCallback(() => {
    navigation.navigate('Vault');
  }, [navigation]);

  const handleReturnToAnchor = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <BurnAnimationOverlay
      sigilSvg={sigilSvg}
      enhancedImageUrl={enhancedImageUrl}
      onCommitBurn={handleCommitBurn}
      onReturnToSanctuary={handleReturnToSanctuary}
      onReturnToAnchor={handleReturnToAnchor}
    />
  );
};

