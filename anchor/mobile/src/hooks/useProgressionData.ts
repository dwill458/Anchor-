import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import {
  DEPTH_TIERS,
  formatDepthGuidance,
  getAnchorDepthProgress,
  getDeepestPracticeAnchor,
  getDepthRequirementStatuses,
  getPracticeDays,
  getReleasedAnchorCount,
  getTotalPrimes,
  type AnchorPrimeStats,
  type DepthName,
  type RequirementStatus,
} from '@/utils/progression';

interface TierDetail<TName extends string> {
  name: TName;
  color: string;
  description: string;
  isCurrent: boolean;
  isReached: boolean;
  requirements: RequirementStatus[];
}

interface DeepestPracticeDisplay {
  empty: false;
  anchor: Anchor;
  title: string;
  artworkUri: string | null;
  sigilXml: string | null;
  stats: AnchorPrimeStats;
  tierName: DepthName;
  tierColor: string;
  description: string;
  progress: number;
  guidance: string;
  tiers: TierDetail<DepthName>[];
}

interface EmptyDeepestPracticeDisplay {
  empty: true;
  title: string;
  subtitle: string;
  tiers: TierDetail<DepthName>[];
}

export interface ProgressionData {
  totalPrimes: number;
  countedPrimes: number;
  practiceDays: number;
  activeAnchors: number;
  releasedAnchors: number;
  hasAnchors: boolean;
  forgedCount: number;
  deepestPractice: DeepestPracticeDisplay | EmptyDeepestPracticeDisplay;
}

function buildAnchorTitle(anchor: Anchor): string {
  const trimmed = anchor.intentionText?.trim() ?? '';
  if (!trimmed) {
    return 'Untitled Anchor';
  }

  if (trimmed.length <= 48) {
    return trimmed;
  }

  return `${trimmed.slice(0, 45).trimEnd()}...`;
}

function buildDepthTierDetails(stats: AnchorPrimeStats, currentName: DepthName) {
  return DEPTH_TIERS.map((tier) => {
    const requirements = getDepthRequirementStatuses(tier, stats);
    return {
      name: tier.name,
      color: tier.color,
      description: tier.description,
      isCurrent: tier.name === currentName,
      isReached: requirements.every((requirement) => requirement.met),
      requirements,
    };
  });
}

export function useProgressionData(): ProgressionData {
  const anchors = useAnchorStore((state) => state.anchors);
  const storedTotalPrimes = useAnchorStore((state) => state.totalPrimes);
  const primingHistory = useSessionStore((state) => state.primingHistory ?? []);
  const timezone = useProfileStore((state) => state.timezone);

  return useMemo(() => {
    const countedPrimes = getTotalPrimes(primingHistory);
    const totalPrimes = Math.max(storedTotalPrimes, countedPrimes);
    const practiceDays = getPracticeDays(primingHistory, timezone);
    const releasedAnchors = getReleasedAnchorCount(anchors);
    const activeAnchors = anchors.filter(
      (anchor) => !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt
    ).length;

    const deepest = getDeepestPracticeAnchor(anchors, primingHistory, timezone);

    const deepestPractice = deepest
      ? {
          empty: false as const,
          anchor: deepest.anchor,
          title: buildAnchorTitle(deepest.anchor),
          artworkUri: deepest.anchor.enhancedImageUrl ?? null,
          sigilXml:
            deepest.anchor.reinforcedSigilSvg ??
            deepest.anchor.baseSigilSvg ??
            null,
          stats: deepest.stats,
          tierName: deepest.depth.tier.name,
          tierColor: deepest.depth.tier.color,
          description: deepest.depth.tier.description,
          progress: deepest.progress.progress,
          guidance: formatDepthGuidance(deepest.progress),
          tiers: buildDepthTierDetails(deepest.stats, deepest.depth.tier.name),
        }
      : {
          empty: true as const,
          title: 'No Anchor in practice yet',
          subtitle: 'Forge an Anchor to begin deepening a symbol.',
          tiers: buildDepthTierDetails(
            { primes: 0, practiceDays: 0, deepPrimes: 0 },
            'Surface'
          ),
        };

    return {
      totalPrimes,
      countedPrimes,
      practiceDays,
      activeAnchors,
      releasedAnchors,
      hasAnchors: anchors.length > 0,
      forgedCount: anchors.length,
      deepestPractice,
    };
  }, [anchors, primingHistory, storedTotalPrimes, timezone]);
}
