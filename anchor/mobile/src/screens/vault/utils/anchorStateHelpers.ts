/**
 * Anchor State Helper Utilities
 *
 * Provides state derivation logic and meaning-driven copy generation
 * for the Anchor Details screen.
 */

import { Anchor } from '@/types';
import { differenceInDays, format } from 'date-fns';

export type AnchorState = 'dormant' | 'charged' | 'active' | 'stale';

/**
 * Determines anchor state based on activation history and charge status
 * Priority: ActiveToday > Stale > Charged > Dormant
 */
export function getAnchorState(anchor: Anchor): AnchorState {
  // Active today takes highest priority
  if (anchor.lastActivatedAt && isToday(anchor.lastActivatedAt)) {
    return 'active';
  }

  // Stale check (7+ days since last activation)
  if (anchor.lastActivatedAt) {
    const daysSince = getDaysSinceLastActivation(anchor.lastActivatedAt);
    if (daysSince >= 7) {
      return 'stale';
    }
  }

  // Charged but not activated today
  if (anchor.isCharged) {
    return 'charged';
  }

  // Never activated and not charged
  if (anchor.activationCount === 0 && !anchor.isCharged) {
    return 'dormant';
  }

  // Default: charged state (fallback)
  return 'charged';
}

/**
 * Checks if a date is today
 * Handles both Date objects and ISO strings
 */
export function isToday(date: Date | string): boolean {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();

  return (
    targetDate.getDate() === today.getDate() &&
    targetDate.getMonth() === today.getMonth() &&
    targetDate.getFullYear() === today.getFullYear()
  );
}

/**
 * Calculates days since last activation
 */
export function getDaysSinceLastActivation(lastActivatedAt: Date | string): number {
  const targetDate =
    typeof lastActivatedAt === 'string' ? new Date(lastActivatedAt) : lastActivatedAt;
  return differenceInDays(new Date(), targetDate);
}

/**
 * Estimates activations this week
 * TODO: Replace with actual activation history when available
 * Currently uses simplified logic based on lastActivatedAt
 */
export function getActivationsThisWeek(anchor: Anchor): number {
  // Placeholder logic - needs full activation history array
  if (!anchor.lastActivatedAt) return 0;

  const daysSince = getDaysSinceLastActivation(anchor.lastActivatedAt);

  // If activated within the last 7 days, count as 1
  // In reality, we'd iterate through an activations[] array and count this week's entries
  return daysSince < 7 ? 1 : 0;
}

/**
 * Meaning-driven copy for stats and CTAs
 */
export interface MeaningCopy {
  activationStatus: string;
  lastActivatedText: string;
  ctaLabel: string;
  ctaMicrocopy: string;
}

/**
 * Generates contextual messaging based on anchor state
 */
export function getMeaningCopy(anchor: Anchor, state: AnchorState): MeaningCopy {
  let activationStatus: string;

  // Generate activation status message
  if (anchor.activationCount === 0) {
    activationStatus = 'Waiting for first ignition';
  } else if (anchor.activationCount === 1) {
    activationStatus = 'Awakened · 1 time';
  } else if (anchor.activationCount >= 10) {
    activationStatus = `Integrated · ${anchor.activationCount} activations`;
  } else {
    activationStatus = `Activated ${anchor.activationCount} times`;
  }

  // Format last activated text
  const lastActivatedText = anchor.lastActivatedAt
    ? format(new Date(anchor.lastActivatedAt), 'MMM d, yyyy')
    : 'Not yet';

  // Determine CTA label based on state
  let ctaLabel: string;
  if (state === 'active') {
    ctaLabel = 'Activate Again';
  } else if (anchor.isCharged) {
    ctaLabel = 'Begin Activation';
  } else {
    ctaLabel = 'Begin Charging';
  }

  return {
    activationStatus,
    lastActivatedText,
    ctaLabel,
    ctaMicrocopy: '1–10 minutes · quiet focus',
  };
}
