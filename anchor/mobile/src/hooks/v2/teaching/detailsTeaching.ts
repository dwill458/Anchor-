import type { BeatId } from '@/constants/v2/teachingCopy';
export const DETAILS_BEATS_PER_VISIT = 1;
export function detailsTeachingBeats(visionEmpty: boolean, chartEmpty: boolean): BeatId[] {
  if (visionEmpty) return ['details.vision'];
  if (chartEmpty) return ['details.chart'];
  return [];
}
