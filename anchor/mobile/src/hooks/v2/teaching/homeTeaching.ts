import type { BeatId } from '@/constants/v2/teachingCopy';
import type { V2PracticeMode } from '@/constants/v2/practice';

export type HomeTeachingOptions = {
  hasAnchor: boolean;
  todayReady: boolean;
  doneToday: boolean;
  mode?: V2PracticeMode;
  hasCompletedPractice: boolean;
  hasVision?: boolean;
  anchorCount?: number;
  requestedBeat?: BeatId | null;
};

export function homeTeachingBeats({
  hasAnchor,
  todayReady,
  doneToday,
  mode,
  hasCompletedPractice,
  hasVision = false,
  anchorCount = 1,
  requestedBeat = null,
}: HomeTeachingOptions): BeatId[] {
  if (!hasAnchor) return [];
  const beats: BeatId[] = [];
  if (requestedBeat) beats.push(requestedBeat);
  if (hasCompletedPractice) beats.push('home.glow');
  if (hasVision) beats.push('home.thread');
  if (anchorCount >= 2) beats.push('home.swipe');
  if (todayReady && !doneToday && mode !== 'release' && !hasCompletedPractice) beats.push('home.today');
  // DEFERRED: 'home.anchor' is no longer auto-eligible; the 'Tap your anchor' chip and Getting started card replace the spontaneous bubble.
  return [...new Set(beats)];
}
