import type { V2PaywallRouteParams } from '@/constants/v2/paywallRoutes';
import type { V2PracticeMode } from '@/constants/v2/practice';
import type { V2ReleaseRouteParams } from '@/screens/v2/release/releaseRoutes';
import type { V2WeeklyInsightRouteParams } from '@/constants/v2/weeklyInsightRoutes';

export type AnchorV2StackParamList = {
  V2FirstRun: undefined;
  V2DevelopmentHome: undefined;
  V2SystemGallery: undefined;
  V2Creation: undefined;
  V2AnchorLibrary: undefined;
  V2AnchorDetails: { anchorId: string };
  V2Paywall: V2PaywallRouteParams;
  V2Practice: { anchorId?: string };
  V2PracticePrepare: { anchorId: string; mode?: V2PracticeMode };
  V2Vision: { anchorId?: string };
  V2Chart: { courseId?: string };
  V2Progress: { anchorId?: string };
  V2Release: V2ReleaseRouteParams;
  V2WeeklyInsight: V2WeeklyInsightRouteParams | undefined;
};
