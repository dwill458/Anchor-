import { deriveThreadEvents, type AnyProgressSession } from '@/adapters/v2/progress/progressAdapter';
import type { V2ThreadEventItem } from '@/adapters/v2/progress/types';
import type { CourseLogEntry } from '@/types/chart';
import type { Anchor } from '@/types';
import { evidenceDayLabel } from '@/constants/v2/home';

export type HomeProgressEvidence = {
  id: string;
  title: string;
  dayLabel: string;
  occurredAt: string;
};

export type HomeProgressState =
  | { state: 'none' }
  | { state: 'empty' }
  | { state: 'ready'; evidence: HomeProgressEvidence[]; totalSessions: number };

export const HOME_PROGRESS_EVIDENCE_LIMIT = 3;

/**
 * Home's Progress preview. It reuses the single Progress derivation authority
 * (`deriveThreadEvents`) rather than inventing a second one, and shows only
 * persisted facts: no example stage transitions and no sample weekdays.
 *
 * Course log entries are account-scoped, so they are admitted only when this
 * Anchor actually owns the active Chart. Without that gate another Anchor's
 * waypoints would appear as this Anchor's evidence.
 */
export function toHomeProgressState(input: {
  anchor: Anchor | null;
  courseLogs: CourseLogEntry[];
  sessions: AnyProgressSession[];
  /** True only when the selected Anchor is linked to the loaded active Course. */
  ownsActiveChart: boolean;
  now?: Date;
}): HomeProgressState {
  const { anchor, courseLogs, sessions, ownsActiveChart, now = new Date() } = input;
  if (!anchor) return { state: 'none' };

  const scopedLogs = ownsActiveChart ? courseLogs : [];
  const events: V2ThreadEventItem[] = deriveThreadEvents(anchor, scopedLogs, sessions);
  if (events.length === 0) return { state: 'empty' };

  const totalSessions = sessions.filter((session) => {
    const aid = session.anchorId || (session as any).anchorLocalId || (session as any).anchor_id;
    return aid === anchor.id || (anchor.localId && aid === anchor.localId);
  }).length;

  return {
    state: 'ready',
    totalSessions,
    evidence: events.slice(0, HOME_PROGRESS_EVIDENCE_LIMIT).map((event) => ({
      id: event.id,
      title: event.title,
      occurredAt: event.occurredAt,
      dayLabel: evidenceDayLabel(event.occurredAt, now),
    })),
  };
}
