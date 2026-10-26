import type { BeatId } from '@/constants/v2/teachingCopy';
import type { V2PracticeMode } from '@/constants/v2/practice';

export function homeTeachingBeats({ hasAnchor, todayReady, doneToday, mode, hasCompletedPractice }: {
  hasAnchor: boolean; todayReady: boolean; doneToday: boolean; mode?: V2PracticeMode; hasCompletedPractice: boolean;
}): BeatId[] {
  return hasAnchor && todayReady && !doneToday && mode !== 'release' && !hasCompletedPractice ? ['home.today'] : [];
}
