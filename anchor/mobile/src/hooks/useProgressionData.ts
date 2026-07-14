import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
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
    };
  }, [anchors, primingHistory, storedTotalPrimes, timezone]);
}
