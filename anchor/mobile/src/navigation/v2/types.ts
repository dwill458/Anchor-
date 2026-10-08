import type { V2PaywallRouteParams } from '@/constants/v2/paywallRoutes';
import type { V2PracticeMode } from '@/constants/v2/practice';
import type { V2ReleaseRouteParams } from '@/screens/v2/release/releaseRoutes';
import type { V2WeeklyInsightRouteParams } from '@/constants/v2/weeklyInsightRoutes';
import type { AuthScreenParams } from '@/types';

/** Carried through creation so the sealed Anchor returns to the Release it was started from. */
export type V2EvolveMarker = { fromAnchorId: string };

export type AnchorV2StackParamList = {
  V2FirstRun: undefined;
  V2DevelopmentHome: { releaseReturnFade?: boolean; visionReturn?: import('@/constants/v2/visionHomeReturn').VisionReturnParams } | undefined;
  V2SystemGallery: undefined;
  V2EvolvingAnchor: undefined;
  V2Creation: undefined;
  FirstAnchorCreation: {
    /** Evolve: the Anchor being released, so the field starts with its intention (editable). */
    initialIntention?: string;
    evolve?: V2EvolveMarker;
  } | undefined;
  AnchorCreationFlow: {
    fromOnboarding?: boolean;
    /** Onboarding's chosen area, so the Intention chrome the flow fades from matches what was shown. */
    focusAreaId?: import('@/constants/v2/focusAreas').FocusAreaId;
    intentionText: string;
    category?: string;
    distilledLetters?: string[];
    source: 'typed' | 'drawn';
    entry?: 'fade' | 'glide';
    fieldFrame?: { x: number; y: number; width: number; height: number; fontSize?: number; lineHeight?: number };
    /** Evolve: creation was opened from this Anchor's Release screen and returns there when sealed. */
    evolve?: V2EvolveMarker;
  };
  Paywall: V2PaywallRouteParams | undefined;
  V2AnchorLibrary: undefined;
  V2AnchorDetails: { anchorId: string };
  V2Paywall: V2PaywallRouteParams;
  V2Practice: {
    anchorId?: string;
    source?: string;
    returnRoute?: string;
    recommendedMode?: V2PracticeMode;
    resumeMode?: V2PracticeMode;
    resumeDuration?: number;
    resumeSource?: 'practice_hub' | 'recommended_today';
    /** The Anchor is flying in from Details; the push itself must not animate. */
    anchorTransition?: boolean;
  };
  V2PracticePrepare: { anchorId: string; mode?: V2PracticeMode };
  V2Vision: { edit?: boolean; anchorId?: string; initialMode?: 'view' | 'create' | 'ready'; resumeGeneration?: boolean };
  V2Chart: {
    courseId?: string;
    anchorId?: string;
    source?: string;
    reached?: { completedTitle: string; nextTitle: string | null; reachedCount: number; total: number; destinationReached: boolean };
  };
  V2ChartWaypoint: { anchorId: string; waypointId: string };
  V2ChartAdjust: { anchorId: string };
  V2ChartJourney: { anchorId: string };
  V2Progress: { anchorId?: string };
  V2Release: V2ReleaseRouteParams;
  V2WeeklyInsight: V2WeeklyInsightRouteParams | undefined;
  V2Settings: undefined;
  V2Auth: { initialMode?: 'signin' | 'create' } | undefined;
  Login: AuthScreenParams | undefined;
};
