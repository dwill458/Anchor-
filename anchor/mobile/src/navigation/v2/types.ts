import type { V2PaywallRouteParams } from '@/constants/v2/paywallRoutes';
import type { V2PracticeMode } from '@/constants/v2/practice';
import type { V2ReleaseRouteParams } from '@/screens/v2/release/releaseRoutes';
import type { V2WeeklyInsightRouteParams } from '@/constants/v2/weeklyInsightRoutes';
import type { AuthScreenParams } from '@/types';

export type AnchorV2StackParamList = {
  V2FirstRun: undefined;
  V2DevelopmentHome: undefined;
  V2SystemGallery: undefined;
  V2EvolvingAnchor: undefined;
  V2Creation: undefined;
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
  };
  V2PracticePrepare: { anchorId: string; mode?: V2PracticeMode };
  V2Vision: { anchorId?: string; initialMode?: 'view' | 'create' | 'ready'; resumeGeneration?: boolean };
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
