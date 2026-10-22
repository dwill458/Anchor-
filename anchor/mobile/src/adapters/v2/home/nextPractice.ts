import type { V2PracticeMode } from '@/constants/v2/practice';

export type NextPractice = V2PracticeMode | 'all_practices';

/**
 * Chooses the next Home practice after a session has already been completed
 * today. The normal, not-done recommendation remains server-owned.
 */
export function getNextPractice(input: {
  completedModes: ReadonlySet<V2PracticeMode>;
  hasVision: boolean;
  chartArcComplete: boolean;
}): NextPractice {
  const available: V2PracticeMode[] = [
    'focus',
    ...(input.hasVision ? ['visualize' as const] : []),
    'deep_prime',
    ...(input.chartArcComplete ? ['release' as const] : []),
  ];

  const completedFocusPair = input.completedModes.has('focus') && input.completedModes.has('visualize');
  const preferred: V2PracticeMode[] = completedFocusPair
    ? ['deep_prime', 'focus', 'visualize', 'release']
    : input.completedModes.has('visualize')
      ? ['focus', 'deep_prime', 'visualize', 'release']
      : input.completedModes.has('focus')
        ? [input.hasVision ? 'visualize' : 'deep_prime', 'focus', 'deep_prime', 'release']
        : ['focus', 'visualize', 'deep_prime', 'release'];

  const next = preferred.find((mode) =>
    available.includes(mode) && !input.completedModes.has(mode),
  );
  return next ?? 'all_practices';
}
