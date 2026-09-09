import {
  RELEASE_CONSEQUENCE_BASE,
  RELEASE_CONSEQUENCE_COURSE,
  RELEASE_CONSEQUENCE_VISION,
} from '@/constants/v2/release';
import type {
  V2ReleaseConsequence,
  V2ReleaseConsequenceSnapshot,
  V2ReleaseSnapshotInput,
} from './types';

/**
 * Builds the preflight consequence snapshot from authoritative Anchor data.
 *
 * It states what Release accomplishes (intention retired, Anchor sealed,
 * reminders stop, history preserved) and only mentions a Course or Vision when
 * one is actually linked. It never fabricates linked records.
 */
export function buildReleaseConsequenceSnapshot(
  input: V2ReleaseSnapshotInput,
): V2ReleaseConsequenceSnapshot {
  const { anchor, linkedCourse, hasLinkedVision } = input;

  const hasLinkedCourse = Boolean(linkedCourse);
  const hasVision = Boolean(hasLinkedVision);

  const consequences: V2ReleaseConsequence[] = [];
  for (const row of RELEASE_CONSEQUENCE_BASE) {
    consequences.push({ ...row });

    // Slot Course + Vision rows next to the Anchor row so the snapshot reads
    // as one honorable "everything is kept" statement.
    if (row.id === 'anchor') {
      if (hasLinkedCourse) {
        consequences.push(describeCourse(linkedCourse));
      }
      if (hasVision) {
        consequences.push({ ...RELEASE_CONSEQUENCE_VISION });
      }
    }
  }

  return {
    anchorId: anchor.id,
    intentionText: anchor.intentionText,
    category: anchor.category ?? null,
    artworkSvg: anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg ?? '',
    hasLinkedCourse,
    hasLinkedVision: hasVision,
    consequences,
  };
}

function describeCourse(
  course: V2ReleaseSnapshotInput['linkedCourse'],
): V2ReleaseConsequence {
  if (!course) {
    return { ...RELEASE_CONSEQUENCE_COURSE };
  }

  const { waypointCount, reachedCount } = course;
  const reachedNote =
    waypointCount > 0
      ? ` ${reachedCount} of ${waypointCount} waypoints reached stay in history.`
      : '';

  return {
    ...RELEASE_CONSEQUENCE_COURSE,
    detail: `${RELEASE_CONSEQUENCE_COURSE.detail}${reachedNote}`.trim(),
  };
}
