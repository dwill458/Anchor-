import { useEffect, useMemo, useState } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { getDepthLevel, getDepthProgress, getNextDepthLevel } from '@/utils/practiceDepth';
import { getCurrentRank, getNextRank, getRankProgress } from '@/utils/practiceRank';
import {
  getMilestoneDates,
  subscribeToMilestoneDates,
  type MilestoneDates,
} from '@/utils/milestoneTracking';

interface TierInfo {
  name: string;
  min: number;
  color: string;
  copy: string;
  isCurrent: boolean;
  isReached: boolean;
  achievedDate: string | null;
}

interface ProgressionData {
  totalPrimes: number;
  rankTiers: TierInfo[];
  currentRank: TierInfo;
  nextRank: TierInfo | null;
  rankProgress: number;
  primesToNextRank: number | null;
  depthTiers: TierInfo[];
  currentDepth: TierInfo;
  nextDepth: TierInfo | null;
  depthProgress: number;
  primesToNextDepth: number | null;
  milestoneDatesLoaded: boolean;
}

const EMPTY_MILESTONE_DATES: MilestoneDates = {
  rank: {},
  depth: {},
};

const RANK_THRESHOLDS = [
  { name: 'Initiate', min: 0 },
  { name: 'Practitioner', min: 10 },
  { name: 'Architect', min: 50 },
  { name: 'Sovereign', min: 200 },
] as const;

const DEPTH_THRESHOLDS = [
  { name: 'Surface', min: 0 },
  { name: 'Grounded', min: 25 },
  { name: 'Rooted', min: 75 },
  { name: 'Embedded', min: 150 },
  { name: 'Sovereign', min: 300 },
] as const;

const RANK_COLORS: Record<string, string> = {
  Initiate: '#C0C0C0',
  Practitioner: '#D4AF37',
  Architect: '#C0A060',
  Sovereign: '#E8D5A0',
};

const DEPTH_COLORS: Record<string, string> = {
  Surface: '#C0C0C0',
  Grounded: '#9A8A6A',
  Rooted: '#B8973A',
  Embedded: '#D4AF37',
  Sovereign: '#E8D5A0',
};

const RANK_COPY: Record<string, string> = {
  Initiate: 'You started when others stalled.',
  Practitioner: 'You returned enough times for change to notice.',
  Architect: 'You shape reality through deliberate pattern.',
  Sovereign: 'Mastery through repetition. Authority through depth.',
};

const DEPTH_COPY: Record<string, string> = {
  Surface: 'The first imprint. Meaning has been marked, but not yet embodied.',
  Grounded: 'The pattern is taking root. Repetition is beginning to shape response.',
  Rooted: 'The pattern repeats without force. Momentum has replaced effort.',
  Embedded: 'The anchor now lives below conscious thought.',
  Sovereign: 'You no longer reach for alignment. You move from it.',
};

export function useProgressionData(): ProgressionData {
  const anchors = useAnchorStore((state) => state.anchors);
  const storedTotalPrimes = useAnchorStore((state) => state.totalPrimes);
  const [milestoneDates, setMilestoneDates] =
    useState<MilestoneDates>(EMPTY_MILESTONE_DATES);
  const [milestoneDatesLoaded, setMilestoneDatesLoaded] = useState(false);

  const lifetimePrimesFromAnchors = useMemo(
    () => anchors.reduce((sum, anchor) => sum + (anchor.activationCount ?? 0), 0),
    [anchors]
  );

  const totalPrimes = Math.max(storedTotalPrimes, lifetimePrimesFromAnchors);

  useEffect(() => {
    let isMounted = true;

    const loadMilestoneDates = async () => {
      const next = await getMilestoneDates();

      if (!isMounted) {
        return;
      }

      setMilestoneDates(next);
      setMilestoneDatesLoaded(true);
    };

    void loadMilestoneDates();

    const unsubscribe = subscribeToMilestoneDates(() => {
      void loadMilestoneDates();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return useMemo(() => {
    const rank = getCurrentRank(totalPrimes);
    const nextRankTier = getNextRank(totalPrimes);
    const depth = getDepthLevel(totalPrimes);
    const nextDepthTier = getNextDepthLevel(totalPrimes);

    const rankTiers: TierInfo[] = RANK_THRESHOLDS.map((tier) => ({
      name: tier.name,
      min: tier.min,
      color: RANK_COLORS[tier.name],
      copy: RANK_COPY[tier.name],
      isCurrent: tier.name === rank.name,
      isReached: totalPrimes >= tier.min,
      achievedDate: milestoneDates.rank[tier.name] ?? null,
    }));

    const depthTiers: TierInfo[] = DEPTH_THRESHOLDS.map((tier) => ({
      name: tier.name,
      min: tier.min,
      color: DEPTH_COLORS[tier.name],
      copy: DEPTH_COPY[tier.name],
      isCurrent: tier.name === depth.label,
      isReached: totalPrimes >= tier.min,
      achievedDate: milestoneDates.depth[tier.name] ?? null,
    }));

    return {
      totalPrimes,
      rankTiers,
      currentRank: rankTiers.find((tier) => tier.isCurrent) ?? rankTiers[0],
      nextRank:
        rankTiers.find((tier) => tier.name === nextRankTier?.name) ?? null,
      rankProgress: getRankProgress(totalPrimes),
      primesToNextRank: nextRankTier ? nextRankTier.minPrimes - totalPrimes : null,
      depthTiers,
      currentDepth: depthTiers.find((tier) => tier.isCurrent) ?? depthTiers[0],
      nextDepth:
        depthTiers.find((tier) => tier.name === nextDepthTier?.label) ?? null,
      depthProgress: getDepthProgress(totalPrimes),
      primesToNextDepth: nextDepthTier ? nextDepthTier.minPrimes - totalPrimes : null,
      milestoneDatesLoaded,
    };
  }, [milestoneDates, milestoneDatesLoaded, totalPrimes]);
}

