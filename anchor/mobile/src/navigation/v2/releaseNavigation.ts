import type { V2ReleaseContinuationCallbacks } from '@/screens/v2/release/releaseRoutes';

type ReplaceNavigation = { replace: (name: string, params?: object) => void; goBack: () => void };

/**
 * Where each Release ending goes. A released Anchor cannot be returned to, so every
 * continuation replaces the Release screen rather than pushing over it.
 */
export function createReleaseContinuations(navigation: ReplaceNavigation): V2ReleaseContinuationCallbacks {
  const chart = (courseId: string | null, anchorId: string, source: string) =>
    navigation.replace('V2Chart', { ...(courseId ? { courseId } : { anchorId }), source });
  return {
    onCancel: () => navigation.goBack(),
    onReleaseCompleted: () => navigation.replace('V2DevelopmentHome'),
    onViewHistory: () => navigation.replace('V2AnchorLibrary'),
    onViewProgress: (anchorId) => navigation.replace('V2Progress', { anchorId }),
    onContinueToChart: (courseId, anchorId) => chart(courseId, anchorId, 'release'),
    onViewCompletedChart: (courseId, anchorId) => chart(courseId, anchorId, 'release_completed'),
    onContinueWithSuccessor: (successorAnchorId) => navigation.replace('V2AnchorDetails', { anchorId: successorAnchorId }),
    onCreateSuccessor: () => navigation.replace('V2Creation'),
  };
}
