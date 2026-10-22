import type { V2ReleaseContinuationCallbacks } from '@/screens/v2/release/releaseRoutes';
import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { AnchorV2StackParamList } from './types';
import { handOffEvolvedToHome, handOffReleaseToHome } from './releaseHandoff';

type ReplaceNavigation = {
  replace: (name: string, params?: object) => void;
  goBack: () => void;
  /** Present on stack navigation. Evolve pushes creation on top of Release so Release stays underneath. */
  push?: (name: string, params?: object) => void;
  /** Present on stack navigation. The Evolve paywall opens on top of Release. */
  navigate?: (name: string, params?: object) => void;
  /** Present on stack navigation. Return Home pops to the Home beneath, with no transition of its own. */
  setOptions?: (options: { animation?: 'none' | 'fade'; gestureEnabled?: boolean }) => void;
  popToTop?: () => void;
  canGoBack?: () => boolean;
};

/**
 * Where each Release ending goes. A released Anchor cannot be returned to, so every
 * continuation replaces the Release screen rather than pushing over it.
 *
 * Return Home is the exception that prefers the Home already beneath Release: it hands off to it as a
 * `release` arrival (see releaseHandoff.ts) and keeps the replacement below as its fallback.
 * `getReduceMotion` is read when Return Home is tapped (the celebration Reduce Motion source).
 */
export function createReleaseContinuations(
  navigation: ReplaceNavigation,
  platform = Platform.OS,
  { getReduceMotion = () => false }: { getReduceMotion?: () => boolean } = {},
): V2ReleaseContinuationCallbacks {
  const chart = (courseId: string | null, anchorId: string, source: string) =>
    navigation.replace('V2Chart', { ...(courseId ? { courseId } : { anchorId }), source });
  // DEFERRED: Android keeps its existing native replacement; custom fade duration is iOS-only.
  const replaceHome = () => platform === 'ios'
    ? navigation.replace('V2DevelopmentHome', { releaseReturnFade: true })
    : navigation.replace('V2DevelopmentHome');
  return {
    onCancel: () => navigation.goBack(),
    onReleaseCompleted: (anchorId) => {
      void handOffReleaseToHome(navigation, { anchorId, fallback: replaceHome }, { reduceMotion: getReduceMotion() });
    },
    onViewHistory: () => navigation.replace('V2AnchorLibrary'),
    onViewProgress: (anchorId) => navigation.replace('V2Progress', { anchorId }),
    onContinueToChart: (courseId, anchorId) => chart(courseId, anchorId, 'release'),
    onViewCompletedChart: (courseId, anchorId) => chart(courseId, anchorId, 'release_completed'),
    // The new Anchor lands on Home (the Evolved arrival); its Details are the fallback when Home cannot take it.
    onContinueWithSuccessor: (successorAnchorId, released) => {
      void handOffEvolvedToHome(navigation, {
        successorAnchorId,
        released,
        fallback: () => navigation.replace('V2AnchorDetails', { anchorId: successorAnchorId }),
      }, { reduceMotion: getReduceMotion() });
    },
    onCreateSuccessor: () => navigation.replace('V2Creation'),
    // The same route and params shape the creation gates use (IntentionInputScreen, useSaveAnchor).
    onEvolvePaywall: (params) => navigation.navigate?.('Paywall', params),
    // Release is never replaced: it is the screen creation returns to, with or without a successor.
    onBeginEvolve: ({ anchorId, intentionText }) => navigation.push?.('FirstAnchorCreation', {
      initialIntention: intentionText,
      evolve: { fromAnchorId: anchorId },
    }),
  };
}

/** The incoming Home owns push replacement animation; only this iOS entry overrides it. */
export function releaseHomeScreenOptions(params: AnchorV2StackParamList['V2DevelopmentHome'], reduceMotion: boolean,
  platform = Platform.OS): NativeStackNavigationOptions {
  return platform === 'ios' && params?.releaseReturnFade
    ? { animation: 'fade', animationDuration: reduceMotion ? 120 : 260, animationTypeForReplace: 'push' }
    : {};
}
