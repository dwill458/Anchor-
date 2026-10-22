import type { BeatId } from '@/constants/v2/teachingCopy';
export function progressTeachingBeats({ unmeasured, hasWeek, hasRhythm, hasRoute }: { unmeasured: boolean; hasWeek: boolean; hasRhythm: boolean; hasRoute: boolean }): BeatId[] {
  return [...(!unmeasured ? ['progress.thread' as const] : []), ...(hasWeek ? ['progress.week' as const] : []),
    ...(hasRhythm ? ['progress.rhythm' as const] : []), ...(hasRoute ? ['progress.route' as const] : [])];
}
