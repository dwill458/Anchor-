import type { BeatId } from '@/constants/v2/teachingCopy';
import { TEACHING_COPY } from '@/constants/v2/teachingCopy';
import { v2PracticeDurationLabel, v2PracticeDurationAccessibilityLabel, v2PracticeModeTitle, type V2PracticeMode } from '@/constants/v2/practice';

export function homeTeachingBeats({ hasAnchor, todayReady, doneToday, mode, hasCompletedPractice }: {
  hasAnchor: boolean; todayReady: boolean; doneToday: boolean; mode?: V2PracticeMode; hasCompletedPractice: boolean;
}): BeatId[] {
  return hasAnchor && todayReady && !doneToday && mode !== 'release' && !hasCompletedPractice ? ['home.today'] : [];
}

export function homeTodayTeachingCopy(mode: V2PracticeMode, durationSeconds?: number) {
  const copy = TEACHING_COPY.beats['home.today'];
  const name = v2PracticeModeTitle(mode);
  const body = (duration: string | undefined) => (duration ? copy.body : copy.bodyWithoutDuration)
    .replace('{mode}', name).replace('{duration}', duration ?? '');
  return {
    title: copy.title,
    body: body(durationSeconds === undefined ? undefined : v2PracticeDurationLabel(durationSeconds)),
    accessibilityLabel: `${copy.title} ${body(durationSeconds === undefined ? undefined : v2PracticeDurationAccessibilityLabel(durationSeconds))}`,
  };
}
