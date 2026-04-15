import { colors } from '@/theme';

export interface RankTier {
  name: string;
  minPrimes: number;
  color: string;
}

export const RANK_TIERS: RankTier[] = [
  { name: 'Initiate', minPrimes: 0, color: colors.silver },
  { name: 'Practitioner', minPrimes: 10, color: colors.gold },
  { name: 'Architect', minPrimes: 50, color: '#C0A060' },
  { name: 'Sovereign', minPrimes: 200, color: '#E8D5A0' },
];

export function getCurrentRank(totalPrimes: number): RankTier {
  return [...RANK_TIERS].reverse().find((tier) => totalPrimes >= tier.minPrimes) ?? RANK_TIERS[0];
}

export function getNextRank(totalPrimes: number): RankTier | null {
  return RANK_TIERS.find((tier) => tier.minPrimes > totalPrimes) ?? null;
}

export function getRankProgress(totalPrimes: number): number {
  const currentRank = getCurrentRank(totalPrimes);
  const nextRank = getNextRank(totalPrimes);

  if (!nextRank) {
    return 1;
  }

  const range = nextRank.minPrimes - currentRank.minPrimes;
  if (range <= 0) {
    return 1;
  }

  return Math.min(
    1,
    Math.max(0, (totalPrimes - currentRank.minPrimes) / range)
  );
}
