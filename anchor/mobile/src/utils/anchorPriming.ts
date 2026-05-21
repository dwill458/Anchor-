import type { Anchor } from '@/types';

type AnchorLike = Partial<Anchor> | null | undefined;

function hasChargeMarkers(anchor: AnchorLike): boolean {
  if (!anchor) {
    return false;
  }

  return Boolean(
    anchor.isCharged ||
      anchor.firstChargedAt ||
      anchor.chargedAt ||
      anchor.ignitedAt ||
      (anchor.chargeCount ?? 0) > 0
  );
}

export function hasAnchorPrimeHistory(anchor: AnchorLike): boolean {
  if (!anchor) {
    return false;
  }

  return hasChargeMarkers(anchor) || (anchor.activationCount ?? 0) > 0 || Boolean(anchor.lastActivatedAt);
}

export function isFirstPrimeForAnchor(anchor: AnchorLike): boolean {
  return !hasAnchorPrimeHistory(anchor);
}

export function needsChargeStateBackfill(anchor: AnchorLike): boolean {
  if (!anchor) {
    return false;
  }

  return !hasChargeMarkers(anchor) && ((anchor.activationCount ?? 0) > 0 || Boolean(anchor.lastActivatedAt));
}

export function buildRecoveredChargeState(
  anchor: AnchorLike,
  fallbackTime: Date,
  options?: { incrementChargeCount?: boolean }
): Pick<Anchor, 'isCharged' | 'chargedAt' | 'firstChargedAt' | 'chargeCount'> {
  const recoveredFirstChargeAt =
    anchor?.firstChargedAt ??
    anchor?.chargedAt ??
    anchor?.lastActivatedAt ??
    anchor?.ignitedAt ??
    fallbackTime;

  return {
    isCharged: true,
    chargedAt: anchor?.chargedAt ?? recoveredFirstChargeAt,
    firstChargedAt: anchor?.firstChargedAt ?? recoveredFirstChargeAt,
    chargeCount: options?.incrementChargeCount
      ? (anchor?.chargeCount ?? 0) + 1
      : Math.max(anchor?.chargeCount ?? 0, 1),
  };
}
