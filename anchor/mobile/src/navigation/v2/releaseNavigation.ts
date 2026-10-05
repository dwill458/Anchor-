import type { V2ReleaseContinuationCallbacks } from '@/screens/v2/release/releaseRoutes';
import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { AnchorV2StackParamList } from './types';

type ReplaceNavigation = { replace: (name: string, params?: object) => void; goBack: () => void };

/**
 * Where each Release ending goes. A released Anchor cannot be returned to, so every
 * continuation replaces the Release screen rather than pushing over it.
 */
export function createReleaseContinuations(navigation: ReplaceNavigation, platform = Platform.OS): V2ReleaseContinuationCallbacks {
  const chart = (courseId: string | null, anchorId: string, source: string) =>
    navigation.replace('V2Chart', { ...(courseId ? { courseId } : { anchorId }), source });
  return {
    onCancel: () => navigation.goBack(),
    // DEFERRED: Android keeps its existing native replacement; custom fade duration is iOS-only.
    onReleaseCompleted: () => platform === 'ios'
      ? navigation.replace('V2DevelopmentHome', { releaseReturnFade: true })
      : navigation.replace('V2DevelopmentHome'),
    onViewHistory: () => navigation.replace('V2AnchorLibrary'),
    onViewProgress: (anchorId) => navigation.replace('V2Progress', { anchorId }),
    onContinueToChart: (courseId, anchorId) => chart(courseId, anchorId, 'release'),
    onViewCompletedChart: (courseId, anchorId) => chart(courseId, anchorId, 'release_completed'),
    onContinueWithSuccessor: (successorAnchorId) => navigation.replace('V2AnchorDetails', { anchorId: successorAnchorId }),
    onCreateSuccessor: () => navigation.replace('V2Creation'),
  };
}

/** The incoming Home owns push replacement animation; only this iOS entry overrides it. */
export function releaseHomeScreenOptions(params: AnchorV2StackParamList['V2DevelopmentHome'], reduceMotion: boolean,
  platform = Platform.OS): NativeStackNavigationOptions {
  return platform === 'ios' && params?.releaseReturnFade
    ? { animation: 'fade', animationDuration: reduceMotion ? 120 : 260, animationTypeForReplace: 'push' }
    : {};
}
