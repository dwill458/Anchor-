/**
 * Decides whether an Anchor-creation attempt should raise the contextual
 * paywall. This is a pure resolver — it does not navigate and it does not
 * enforce anything on its own.
 *
 * Locked Free-user contract:
 *   - The FIRST Anchor is always allowed (never paywalled).
 *   - The SECOND Anchor attempt raises `SECOND_ANCHOR`.
 *   - Onboarding / first-run creation is never paywalled.
 *   - An entitled user (trial or paid) is never paywalled.
 *
 * It deliberately does NOT reproduce the production 1.5 hard-lock: a free user
 * who already has one Anchor still *sees* the app; only the act of creating an
 * additional Anchor is gated, and always with a recoverable paywall.
 */

import type { V2PaywallContext } from '@/constants/v2/paywall';

export type V2AnchorCreationGateInput = {
  /** Active (non-released, non-archived) Anchors the user already holds. */
  activeAnchorCount: number;
  /** The attempt originates from the first-run / onboarding flow. */
  isOnboarding: boolean;
  /** User currently has an active trial or paid entitlement. */
  hasEntitlement: boolean;
};

export type V2AnchorCreationGateResult =
  | { allowed: true; paywallContext: null }
  | { allowed: false; paywallContext: Extract<V2PaywallContext, 'SECOND_ANCHOR'> };

export function resolveAnchorCreationPaywall(
  input: V2AnchorCreationGateInput,
): V2AnchorCreationGateResult {
  const { activeAnchorCount, isOnboarding, hasEntitlement } = input;

  if (hasEntitlement) return { allowed: true, paywallContext: null };
  if (isOnboarding) return { allowed: true, paywallContext: null };
  if (activeAnchorCount < 1) return { allowed: true, paywallContext: null };

  return { allowed: false, paywallContext: 'SECOND_ANCHOR' };
}
