/**
 * Anchor 2.0 — Contextual Paywall constants.
 *
 * The paywall is a *presentation* layer over the existing server trial
 * lifecycle and RevenueCat infrastructure. Nothing here starts a trial, and no
 * price is ever hard-coded — pricing copy is built from live RevenueCat data
 * and these strings are only the fallbacks shown while that data loads or when
 * the store is unreachable.
 */

import { REVENUECAT_ANNUAL_PACKAGE_ID, REVENUECAT_MONTHLY_PACKAGE_ID } from '@/config';

/** Every place the paywall can be raised from. Each is a distinct, honest reason. */
export type V2PaywallContext =
  | 'SECOND_ANCHOR'
  | 'PRACTICE'
  | 'DEEP_PRIME'
  | 'VISUALIZE'
  | 'VISION_PREMIUM_ACTION'
  | 'TRIAL_ENDED'
  | 'GENERAL_UPGRADE';

export const V2_PAYWALL_CONTEXTS: readonly V2PaywallContext[] = [
  'SECOND_ANCHOR',
  'PRACTICE',
  'DEEP_PRIME',
  'VISUALIZE',
  'VISION_PREMIUM_ACTION',
  'TRIAL_ENDED',
  'GENERAL_UPGRADE',
] as const;

/** Client mirror of the server `TrialState` (`NOT_STARTED | ACTIVE | EXPIRED`). */
export type V2TrialState = 'TRIAL_NOT_STARTED' | 'TRIAL_ACTIVE' | 'TRIAL_ENDED';

/** Must match backend `TrialLifecycleService.TRIAL_DURATION_MS`. */
export const V2_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const V2_TRIAL_DURATION_DAYS = 7;

export type V2PaywallPlanId = 'annual' | 'monthly';

export const V2_PAYWALL_PLAN_PACKAGE_IDS: Record<V2PaywallPlanId, string> = {
  annual: REVENUECAT_ANNUAL_PACKAGE_ID,
  monthly: REVENUECAT_MONTHLY_PACKAGE_ID,
};

/** Only the annual package carries the 7-day introductory trial. */
export const V2_TRIAL_PLAN_ID: V2PaywallPlanId = 'annual';

/** The artifact rendered near the top of the sheet — never fabricated. */
export type V2PaywallArtifactKind = 'anchor' | 'vision' | 'vision-placeholder' | 'none';

/** Which practice/vision accent the contextual atmosphere borrows. */
export type V2PaywallTone = 'focus' | 'deepPrime' | 'visualize' | 'neutral';

export type V2PaywallCopy = {
  /** Small uppercase eyebrow. */
  eyebrow: string;
  headline: string;
  body: string;
  /** Primary action label when the trial is still available. */
  trialCta: string;
  /** Primary action label when the trial is spent (paid, no free days). */
  paidCta: string;
  artifact: V2PaywallArtifactKind;
  tone: V2PaywallTone;
};

/** Three confirmation rows — not a feature-marketing wall. */
export const V2_PAYWALL_BENEFITS: readonly string[] = [
  'Focus, Deep Prime & Visualize',
  'Create your Vision',
  'Track Thread Strength',
] as const;

const PRACTICE_COPY: V2PaywallCopy = {
  eyebrow: 'Anchor Pro',
  headline: 'Start practicing with Anchor',
  body: 'Your first 7 days are free. Unlock the complete Practice and Vision experience.',
  trialCta: 'Start 7-Day Free Trial',
  paidCta: 'Continue with Pro',
  artifact: 'anchor',
  tone: 'focus',
};

export const V2_PAYWALL_COPY: Record<V2PaywallContext, V2PaywallCopy> = {
  SECOND_ANCHOR: {
    eyebrow: 'Anchor Pro',
    headline: 'Create another Anchor',
    body: 'Your first Anchor stays yours. Start your 7-day trial to hold more than one intention at a time.',
    trialCta: 'Start 7-Day Free Trial',
    paidCta: 'Continue with Pro',
    artifact: 'anchor',
    tone: 'neutral',
  },
  PRACTICE: PRACTICE_COPY,
  DEEP_PRIME: {
    ...PRACTICE_COPY,
    headline: 'Go deeper with Deep Prime',
    body: 'Your first 7 days are free. Deep Prime and every guided mode unlock together.',
    tone: 'deepPrime',
  },
  VISUALIZE: {
    eyebrow: 'Anchor Pro',
    headline: 'Bring your direction into view',
    body: 'Start your 7-day trial to create your Vision and connect it to your practice.',
    trialCta: 'Start 7-Day Free Trial',
    paidCta: 'Continue with Pro',
    artifact: 'vision',
    tone: 'visualize',
  },
  VISION_PREMIUM_ACTION: {
    eyebrow: 'Anchor Pro',
    headline: 'Keep shaping your Vision',
    body: 'Start your 7-day trial to keep generating and refining scenes for this Vision.',
    trialCta: 'Start 7-Day Free Trial',
    paidCta: 'Continue with Pro',
    artifact: 'vision',
    tone: 'visualize',
  },
  TRIAL_ENDED: {
    eyebrow: 'Your trial has ended',
    headline: 'Keep building what you started.',
    body: 'Your Anchors, Vision, and progress are still here.',
    trialCta: 'Continue with Pro',
    paidCta: 'Continue with Pro',
    artifact: 'none',
    tone: 'neutral',
  },
  GENERAL_UPGRADE: {
    eyebrow: 'Anchor Pro',
    headline: 'Unlock the complete Anchor',
    body: 'Your first 7 days are free. Every practice mode, Vision, and Thread Strength included.',
    trialCta: 'Start 7-Day Free Trial',
    paidCta: 'Continue with Pro',
    artifact: 'none',
    tone: 'neutral',
  },
};

/** Contexts that should never offer the trial CTA even when eligible. */
export function contextAllowsTrial(context: V2PaywallContext): boolean {
  return context !== 'TRIAL_ENDED';
}

/** Fallback labels only — replaced the moment RevenueCat metadata resolves. */
export const V2_PAYWALL_PRICING_FALLBACK = {
  annualLabel: 'Annual plan',
  monthlyLabel: 'Monthly plan',
  loading: 'Loading current store pricing…',
  unavailable: 'Pricing is temporarily unavailable. Restore is still available.',
} as const;
