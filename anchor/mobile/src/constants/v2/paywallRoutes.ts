/**
 * Route + continuation contracts for the contextual paywall.
 *
 * UI-E does not edit central navigation. A host that wires the paywall into the
 * V2 navigator registers this route name with these params and honours the
 * continuation contract. See `REQUIRED_INTEGRATION_CHANGES` in
 * `ANCHOR_2_UI_E_PAYWALL_SYSTEM.md`.
 */

import type { V2PaywallContext } from './paywall';
import type { V2PaywallEntitlementResult } from '@/hooks/v2/paywall';
import type { V2PaywallPlanId } from './paywall';

/** Canonical route name for the paywall screen. */
export const V2_PAYWALL_ROUTE = 'V2Paywall' as const;

/**
 * A serialisable description of the intent that raised the paywall, so a
 * successful entitlement grant can resume exactly where the user was.
 */
export type V2PaywallResumeIntent =
  | { type: 'create_anchor' }
  | { type: 'open_practice'; anchorId: string; mode?: 'focus' | 'deep' }
  | { type: 'open_visualize'; anchorId: string }
  | { type: 'vision_premium_action'; anchorId: string; action: string }
  | { type: 'none' };

/** Navigation params for `V2_PAYWALL_ROUTE`. */
export type V2PaywallRouteParams = {
  context: V2PaywallContext;
  /** Preserved and handed back verbatim on a successful grant. */
  resumeIntent?: V2PaywallResumeIntent;
  /** Optional pre-selection; the screen still defaults sensibly without it. */
  preferredPlan?: V2PaywallPlanId;
};

/** What the paywall reports back to its host. */
export type V2PaywallOutcome =
  | { status: 'dismissed' }
  | { status: 'entitled'; result: V2PaywallEntitlementResult; resumeIntent: V2PaywallResumeIntent };

/** Callback contract a host supplies to receive the outcome. */
export type V2PaywallContinuation = (outcome: V2PaywallOutcome) => void;

export type { V2PaywallEntitlementResult };
