import type { BeatId } from '@/constants/v2/teachingCopy';
import type { V2PracticeMode } from '@/constants/v2/practice';

export function homeTeachingBeats({ hasAnchor, todayReady, doneToday, mode, hasCompletedPractice }: {
  hasAnchor: boolean; todayReady: boolean; doneToday: boolean; mode?: V2PracticeMode; hasCompletedPractice: boolean;
}): BeatId[] {
  const beats: BeatId[] = [];
  if (hasAnchor && todayReady && !doneToday && mode !== 'release' && !hasCompletedPractice) beats.push('home.today');
  // Registry order keeps Today first; the coordinator's one-bubble session budget spaces them apart.
  if (hasAnchor) beats.push('home.anchor');
  return beats;
}
