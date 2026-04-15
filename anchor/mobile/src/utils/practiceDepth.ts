import { colors } from '@/theme';

export interface DepthLevel {
  label: string;
  minPrimes: number;
  color: string;
}

export const DEPTH_LEVELS: DepthLevel[] = [
  { label: 'Surface', minPrimes: 0, color: colors.silver },
  { label: 'Grounded', minPrimes: 25, color: '#9A8A6A' },
  { label: 'Rooted', minPrimes: 75, color: '#B8973A' },
  { label: 'Embedded', minPrimes: 150, color: colors.gold },
  { label: 'Sovereign', minPrimes: 300, color: '#E8D5A0' },
];

export function getDepthLevel(totalPrimes: number): DepthLevel {
  return [...DEPTH_LEVELS].reverse().find((level) => totalPrimes >= level.minPrimes) ?? DEPTH_LEVELS[0];
}

export function getNextDepthLevel(totalPrimes: number): DepthLevel | null {
  return DEPTH_LEVELS.find((level) => level.minPrimes > totalPrimes) ?? null;
}

export function getDepthProgress(totalPrimes: number): number {
  const currentLevel = getDepthLevel(totalPrimes);
  const nextLevel = getNextDepthLevel(totalPrimes);

  if (!nextLevel) {
    return 1;
  }

  const range = nextLevel.minPrimes - currentLevel.minPrimes;
  if (range <= 0) {
    return 1;
  }

  return Math.min(
    1,
    Math.max(0, (totalPrimes - currentLevel.minPrimes) / range)
  );
}
