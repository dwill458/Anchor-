export { V2PaywallScreen, default } from './V2PaywallScreen';
export type { V2PaywallScreenProps } from './V2PaywallScreen';

// Paywall contexts & pricing model
export {
  V2_PAYWALL_CONTEXTS,
  V2_PAYWALL_COPY,
  V2_PAYWALL_BENEFITS,
  V2_TRIAL_DURATION_MS,
  V2_TRIAL_DURATION_DAYS,
  V2_TRIAL_PLAN_ID,
  V2_PAYWALL_PLAN_PACKAGE_IDS,
  contextAllowsTrial,
} from '@/constants/v2/paywall';
export type {
  V2PaywallContext,
  V2TrialState,
  V2PaywallPlanId,
  V2PaywallTone,
  V2PaywallArtifactKind,
} from '@/constants/v2/paywall';

// Route manifest + continuation contracts
export { V2_PAYWALL_ROUTE } from '@/constants/v2/paywallRoutes';
export type {
  V2PaywallRouteParams,
  V2PaywallResumeIntent,
  V2PaywallOutcome,
  V2PaywallContinuation,
  V2PaywallEntitlementResult,
} from '@/constants/v2/paywallRoutes';

// Hooks a host needs to decide *when* to raise the paywall
export { useV2Paywall, useV2TrialState, useV2AnchorCreationGate } from '@/hooks/v2/paywall';
export { resolveAnchorCreationPaywall, resolveV2TrialState } from '@/adapters/v2/paywall';
