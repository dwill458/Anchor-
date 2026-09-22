import { evidenceDayLabel } from '@/constants/v2/home';
import { v2PracticeModeTitle } from '@/constants/v2/practice';
import type { PracticeSessionRecord, PracticeMode } from '@/types/practice';

export type HomeRecentActivityItem = {
  id: string;
  title: string;
  dayLabel: string;
  mode: PracticeMode;
  durationSeconds: number;
};

/** Only canonical completed sessions for this account and Anchor enter Home. */
export function toHomeRecentActivity(input: {
  sessions: PracticeSessionRecord[];
  accountId: string | null;
  anchorId: string | null;
  anchorLocalId?: string | null;
  now?: Date;
}): HomeRecentActivityItem[] {
  const { sessions, accountId, anchorId, anchorLocalId, now = new Date() } = input;
  if (!accountId || !anchorId) return [];
  return sessions
    .filter((session) => session.accountId === accountId && (
      session.anchorId === anchorId || session.anchorServerId === anchorId ||
      Boolean(anchorLocalId && session.anchorLocalId === anchorLocalId)
    ))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, 3)
    .map((session) => ({
      id: session.id,
      title: v2PracticeModeTitle(session.practiceMode),
      dayLabel: evidenceDayLabel(session.completedAt, now),
      mode: session.practiceMode,
      durationSeconds: session.completedDurationSeconds,
    }));
}
