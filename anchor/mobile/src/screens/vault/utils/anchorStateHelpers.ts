/**
 * Anchor State Helper Utilities
 *
 * Provides state derivation logic and meaning-driven copy generation
 * for the Anchor Details screen.
 */

import { Anchor } from '@/types';
import { differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';

export type AnchorState = 'dormant' | 'charged' | 'active' | 'stale';

/**
 * True once an anchor has had its first ignition/charge.
 */
export function hasIgnited(anchor: Anchor): boolean {
  return Boolean(
    anchor.firstChargedAt ||
      anchor.chargedAt ||
      anchor.ignitedAt ||
      (anchor.chargeCount ?? 0) > 0 ||
      anchor.isCharged ||
      anchor.activationCount > 0 ||
      anchor.lastActivatedAt
  );
}

/**
 * Released/archived anchors should not allow activation/reinforcement.
 */
export function isAnchorReleased(anchor: Anchor): boolean {
  return Boolean(anchor.isReleased || anchor.releasedAt || anchor.archivedAt);
}

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
export function getMeaningCopy(anchor: Anchor, _state: AnchorState): MeaningCopy {
  const ignited = hasIgnited(anchor);
  const activationStatus = ignited ? 'Anchor is live' : 'Ready to ignite';
  const lastActivatedText = getLastActivatedText(anchor.lastActivatedAt);
  const ctaLabel = ignited ? 'Activate' : 'Ignite Anchor';
  const ctaMicrocopy = ignited
    ? '10-60 seconds · enter focus'
    : '1-10 minutes · first charge';

  return {
    activationStatus,
    lastActivatedText,
    ctaLabel,
    ctaMicrocopy,
  };
}

/**
 * Returns a concise headline for the Ritual Dashboard card based on anchor state.
 */
export function getDashboardHeadline(state: AnchorState, ignited: boolean): string {
  if (!ignited) return 'Ready to ignite';
  switch (state) {
    case 'active': return '✦ Live';
    case 'charged': return 'Charged';
    case 'stale': return 'Fading — recharge soon';
    default: return 'Ready';
  }
}

export function getDeepChargeMicrocopy(lastActivatedAt?: Date | string): string {
  if (!lastActivatedAt) return 'Your anchor may be dim. Recharge it.';

  const activationDate =
    typeof lastActivatedAt === 'string' ? new Date(lastActivatedAt) : lastActivatedAt;

  if (Number.isNaN(activationDate.getTime())) {
    return 'Your anchor may be dim. Recharge it.';
  }

  const now = new Date();
  const minutesSinceActivation = differenceInMinutes(now, activationDate);
  if (minutesSinceActivation >= 0 && minutesSinceActivation <= 10) {
    return 'Optional: deepen what you just started.';
  }

  const hoursSinceActivation = differenceInHours(now, activationDate);
  if (hoursSinceActivation >= 24) {
    return 'Your anchor may be dim. Recharge it.';
  }

  return 'Best when your intention feels dim.';
}

function getLastActivatedText(lastActivatedAt?: Date | string): string {
  if (!lastActivatedAt) return 'Not yet';

  const activationDate =
    typeof lastActivatedAt === 'string' ? new Date(lastActivatedAt) : lastActivatedAt;

  if (Number.isNaN(activationDate.getTime())) return 'Not yet';

  const now = new Date();
  const minutes = differenceInMinutes(now, activationDate);
  if (minutes <= 0) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = differenceInHours(now, activationDate);
  if (hours < 24) return `${hours}h ago`;

  const days = differenceInDays(now, activationDate);
  if (days < 7) return `${days}d ago`;

  return format(activationDate, 'MMM d, yyyy');
}
