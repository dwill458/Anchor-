import type { BeatId } from '@/constants/v2/teachingCopy';
export function practiceTeachingBeats(anchorCount: number, switcherRendered: boolean): BeatId[] {
  return ['practice.today', ...(anchorCount >= 2 && switcherRendered ? ['practice.switch' as const] : [])];
}
