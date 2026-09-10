import { CREATION_ROUTE_NAME } from '@/constants/v2/creation';
import { V2_PAYWALL_ROUTE } from '@/constants/v2/paywallRoutes';
import { V2_PRACTICE_ROUTE_MANIFEST } from '@/screens/v2/practice';
import { V2_RELEASE_ROUTE } from '@/constants/v2/release';
import { V2_WEEKLY_INSIGHT_ROUTE } from '@/constants/v2/weeklyInsightRoutes';

export const ANCHOR_V2_ROUTES = {
  firstRun: 'V2FirstRun',
  developmentHome: 'V2DevelopmentHome',
  systemGallery: 'V2SystemGallery',
  creation: CREATION_ROUTE_NAME,
  anchorLibrary: 'V2AnchorLibrary',
  anchorDetails: 'V2AnchorDetails',
  paywall: V2_PAYWALL_ROUTE,
  practice: V2_PRACTICE_ROUTE_MANIFEST.practice,
  practicePrepare: V2_PRACTICE_ROUTE_MANIFEST.focusPrepare,
  vision: 'V2Vision',
  chart: 'V2Chart',
  progress: 'V2Progress',
  release: V2_RELEASE_ROUTE,
  weeklyInsight: V2_WEEKLY_INSIGHT_ROUTE,
} as const;
