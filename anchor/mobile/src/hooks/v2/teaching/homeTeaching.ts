import type { BeatId } from '@/constants/v2/teachingCopy';

export function homeTeachingBeats({ hasAnchor, hasVision, hasChart }: { hasAnchor: boolean; hasVision: boolean; hasChart: boolean }): BeatId[] {
  if (!hasAnchor) return [];
  return ['home.today', ...(!hasVision ? ['home.progress' as const] : ['home.vision' as const]),
    ...(hasChart ? ['home.chart' as const] : []), ...(hasVision ? ['home.thread' as const] : [])];
}
