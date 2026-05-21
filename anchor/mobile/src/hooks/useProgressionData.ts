import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import type { PrimeRankName, PrimeDepthName } from '@/utils/milestoneTracking';
import {
  DEPTH_TIERS,
  MARK_TIERS,
  RANK_TIERS,
  formatDepthGuidance,
  formatRankGuidance,
  getAnchorDepthProgress,
  getCurrentRank,
  getDeepestPracticeAnchor,
  getDepthRequirementStatuses,
  getMarkProgress,
  getNextMark,
  getNextRankProgress,
  getPracticeDays,
  getRankRequirementStatuses,
  getReleasedAnchorCount,
  getTotalPrimes,
  type AnchorPrimeStats,
  type DepthName,
  type MarkName,
  type RankMetrics,
  type RankName,
  type RequirementStatus,
} from '@/utils/progression';

// Prime-only tier definitions for the progression sheet
export const PRIME_RANK_TIERS = [
  {
    name: 'Initiate' as const,
    min: 0,
    color: '#C0C0C0',
    copy: 'You started when others stalled.',
  },
  {
    name: 'Practitioner' as const,
    min: 10,
    color: '#D4AF37',
    copy: 'You returned enough times for change to notice.',
  },
  {
    name: 'Architect' as const,
    min: 50,
    color: '#C0A060',
    copy: 'You shape reality through deliberate pattern.',
  },
  {
    name: 'Sovereign' as const,
    min: 200,
    color: '#E8D5A0',
    copy: 'Mastery through repetition. Authority through depth.',
  },
] as const;

export const PRIME_DEPTH_TIERS = [
  {
    name: 'Surface' as const,
    min: 0,
    color: '#C0C0C0',
    copy: 'The first imprint. Meaning has been marked, but not yet embodied.',
  },
  {
    name: 'Grounded' as const,
    min: 25,
    color: '#9A8A6A',
    copy: 'The pattern is taking root. Repetition is beginning to shape response.',
  },
  {
    name: 'Rooted' as const,
    min: 75,
    color: '#B8973A',
    copy: 'The pattern repeats without force. Momentum has replaced effort.',
  },
  {
    name: 'Embedded' as const,
    min: 150,
    color: '#D4AF37',
    copy: 'The anchor now lives below conscious thought.',
  },
  {
    name: 'Sovereign' as const,
    min: 300,
    color: '#E8D5A0',
    copy: 'You no longer reach for alignment. You move from it.',
  },
] as const;

interface TierDetail<TName extends string> {
  name: TName;
  color: string;
  description: string;
  isCurrent: boolean;
  isReached: boolean;
  requirements: RequirementStatus[];
}

interface PrimeTier {
  name: string;
  min: number;
  color: string;
  copy: string;
  isCurrent: boolean;
  isReached: boolean;
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
  rank: {
    currentName: RankName;
    color: string;
    description: string;
    progress: number;
    guidance: string;
    isMax: boolean;
    tiers: TierDetail<RankName>[];
  };
  deepestPractice: DeepestPracticeDisplay | EmptyDeepestPracticeDisplay;
  nextMark: {
    name: MarkName;
    subtitle: string;
    current: number;
    required: number;
    progress: number;
    earned: boolean;
    tiers: Array<{
      name: MarkName;
      subtitle: string;
      threshold: number;
      isCurrent: boolean;
      isReached: boolean;
    }>;
  };
  // Prime-only progression for sheet/cards
  primeRank: {
    current: PrimeTier;
    next: PrimeTier | null;
    progress: number;
    primesToNext: number | null;
  };
  primeDepth: {
    current: PrimeTier;
    next: PrimeTier | null;
    progress: number;
    primesToNext: number | null;
  };
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

function buildRankTierDetails(metrics: RankMetrics, currentName: RankName) {
  return RANK_TIERS.map((tier) => {
    const requirements = getRankRequirementStatuses(tier, metrics);
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

function computePrimeTierProgress(
  totalPrimes: number,
  tiers: readonly { name: string; min: number; color: string; copy: string }[],
  maxPrimes: number
): { current: PrimeTier; next: PrimeTier | null; progress: number; primesToNext: number | null } {
  let currentIdx = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalPrimes >= tiers[i].min) {
      currentIdx = i;
      break;
    }
  }

  const currentTier = tiers[currentIdx];
  const nextTier = tiers[currentIdx + 1] ?? null;

  const currentMin = currentTier.min;
  const nextMin = nextTier?.min ?? maxPrimes;
  const progress = nextTier ? Math.min(1, (totalPrimes - currentMin) / (nextMin - currentMin)) : 1;
  const primesToNext = nextTier ? Math.max(0, nextTier.min - totalPrimes) : null;

  return {
    current: {
      name: currentTier.name,
      min: currentTier.min,
      color: currentTier.color,
      copy: currentTier.copy,
      isCurrent: true,
      isReached: true,
    },
    next: nextTier
      ? {
          name: nextTier.name,
          min: nextTier.min,
          color: nextTier.color,
          copy: nextTier.copy,
          isCurrent: false,
          isReached: false,
        }
      : null,
    progress,
    primesToNext,
  };
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
    const metrics: RankMetrics = {
      totalPrimes,
      practiceDays,
      releasedAnchors,
    };

    const rankState = getCurrentRank(metrics);
    const rankProgress = getNextRankProgress(metrics);
    const rankTiers = buildRankTierDetails(metrics, rankState.tier.name);

    const deepest = getDeepestPracticeAnchor(anchors, primingHistory, timezone);
    const markState = getNextMark(practiceDays);
    const markProgress = getMarkProgress(practiceDays);

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

    // Prime-only rank/depth (for sheet and new profile cards)
    const primeRank = computePrimeTierProgress(totalPrimes, PRIME_RANK_TIERS, 200);
    const primeDepth = computePrimeTierProgress(totalPrimes, PRIME_DEPTH_TIERS, 300);

    return {
      totalPrimes,
      countedPrimes,
      practiceDays,
      activeAnchors,
      releasedAnchors,
      hasAnchors: anchors.length > 0,
      forgedCount: anchors.length,
      rank: {
        currentName: rankState.tier.name,
        color: rankState.tier.color,
        description: rankState.tier.description,
        progress: rankProgress.progress,
        guidance: formatRankGuidance(rankProgress, anchors.length > 0),
        isMax: rankProgress.nextTier == null,
        tiers: rankTiers,
      },
      deepestPractice,
      nextMark: {
        name: markState.current.name,
        subtitle: markState.earned
          ? `${markState.current.name} forged`
          : markState.current.subtitle,
        current: markProgress.current,
        required: markProgress.required,
        progress: markProgress.progress,
        earned: markProgress.earned,
        tiers: MARK_TIERS.map((tier) => ({
          name: tier.name,
          subtitle: tier.subtitle,
          threshold: tier.threshold,
          isCurrent: tier.name === markState.current.name,
          isReached: practiceDays >= tier.threshold,
        })),
      },
      primeRank,
      primeDepth,
    };
  }, [anchors, primingHistory, storedTotalPrimes, timezone]);
}
