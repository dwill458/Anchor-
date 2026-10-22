import {
  RELEASE_CONSEQUENCE_ROWS as ROWS,
  RELEASE_ENDINGS,
  RELEASE_SUCCESSOR_LINK_NOTE,
  type V2ReleaseActionId,
} from '@/constants/v2/release';
import {
  V2_RELEASE_REASONS,
  type V2ReleaseConsequence,
  type V2ReleaseConsequenceSnapshot,
  type V2ReleaseLinkedCourse,
  type V2ReleaseReason,
  type V2ReleaseSnapshotInput,
  type V2ReleaseSuccessor,
} from './types';
import { anchorKeptExpression } from '@/components/v2/anchors/anchorPresentation';
import type { Anchor } from '@/types';

/**
 * Route params still carry free strings (e.g. Practice sends 'practice_prepare').
 * Anything that is not one of the five locked reasons is a plain manual release.
 */
export function normalizeReleaseReason(raw: string | null | undefined): V2ReleaseReason | undefined {
  return (V2_RELEASE_REASONS as readonly string[]).includes(raw ?? '') ? (raw as V2ReleaseReason) : undefined;
}

/**
 * The reason that may be shown and sent. Waypoint and destination completion are
 * never inferred on the client: they stand only when the server-synced Chart
 * confirms them, otherwise the release is manual and claims no achievement.
 */
export function resolveReleaseReason(
  requested: V2ReleaseReason | undefined,
  linkedCourse: V2ReleaseLinkedCourse | null | undefined,
): V2ReleaseReason {
  switch (requested) {
    case 'waypoint_completed':
      return linkedCourse?.linkKind === 'waypoint' && linkedCourse.waypointReached === true ? requested : 'no_longer_aligned';
    case 'destination_completed':
      return linkedCourse?.linkKind === 'destination' && linkedCourse.courseCompleted === true ? requested : 'no_longer_aligned';
    case 'outcome_completed':
      return linkedCourse ? 'no_longer_aligned' : requested;
    case 'evolve':
    case 'no_longer_aligned':
      return requested;
    default:
      return 'no_longer_aligned';
  }
}

export function releaseHoldHint(reason: V2ReleaseReason, copy: { holdHint: string; holdHintWaypoint: string; holdHintDestination: string; holdHintEvolve: string }): string {
  if (reason === 'waypoint_completed') return copy.holdHintWaypoint;
  if (reason === 'destination_completed') return copy.holdHintDestination;
  if (reason === 'evolve') return copy.holdHintEvolve;
  return copy.holdHint;
}

/**
 * Builds the preflight consequence snapshot from authoritative Anchor data.
 *
 * Rows follow the locked fixtures: Anchor, then Chart / Vision / Successor only
 * when those records really exist, then History. It never fabricates links.
 */
export function buildReleaseConsequenceSnapshot(
  input: V2ReleaseSnapshotInput,
): V2ReleaseConsequenceSnapshot {
  const { anchor, linkedCourse, hasLinkedVision, successor } = input;
  const reason = resolveReleaseReason(input.reason, linkedCourse);
  const hasLinkedCourse = Boolean(linkedCourse);
  const hasVision = Boolean(hasLinkedVision);
  const nextWaypointTitle = reason === 'waypoint_completed' ? linkedCourse?.nextWaypointTitle ?? null : null;
  const successorRecord = reason === 'evolve' ? successor ?? null : null;

  const consequences: V2ReleaseConsequence[] = [{ ...(reason === 'evolve' ? ROWS.anchorEvolve : ROWS.anchor) }];
  if (hasLinkedCourse) consequences.push(describeCourse(linkedCourse as V2ReleaseLinkedCourse, reason, nextWaypointTitle));
  if (hasVision) consequences.push({ ...ROWS.vision });
  if (successorRecord) {
    consequences.push({ ...ROWS.successor, detail: `${successorRecord.intentionText}. ${RELEASE_SUCCESSOR_LINK_NOTE}` });
  }
  consequences.push({ ...ROWS.history });

  return {
    anchorId: anchor.id,
    intentionText: anchor.intentionText,
    category: anchor.category ?? null,
    artworkSvg: anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg ?? '',
    imageUrl: anchor.enhancedImageUrl,
    expression: anchorKeptExpression(anchor as Pick<Anchor, 'classifierMeta'>),
    hasLinkedCourse,
    hasLinkedVision: hasVision,
    reason,
    successor: successorRecord,
    nextWaypointTitle,
    courseId: linkedCourse?.courseId ?? null,
    revision: [
      anchor.id,
      linkedCourse ? `${linkedCourse.courseId ?? ''}:${linkedCourse.revision ?? ''}:${linkedCourse.linkKind ?? ''}:${linkedCourse.waypointReached ? 1 : 0}:${linkedCourse.courseCompleted ? 1 : 0}` : 'no-course',
      hasVision ? 'vision' : 'no-vision',
      successorRecord?.anchorId ?? 'no-successor',
    ].join('|'),
    consequences,
  };
}

function describeCourse(
  course: V2ReleaseLinkedCourse,
  reason: V2ReleaseReason,
  nextWaypointTitle: string | null,
): V2ReleaseConsequence {
  if (reason === 'destination_completed') return { ...ROWS.chartDestination };
  if (reason === 'waypoint_completed') {
    return { ...ROWS.chartWaypoint, detail: nextWaypointTitle ? `${ROWS.chartWaypoint.detail}. Next: ${nextWaypointTitle}` : ROWS.chartWaypoint.detail };
  }
  const { waypointCount, reachedCount } = course;
  const reachedNote = waypointCount > 0 ? `. ${reachedCount} of ${waypointCount} waypoints reached stay in history` : '';
  return { ...ROWS.chart, detail: `${ROWS.chart.detail}${reachedNote}` };
}

export interface V2ReleaseEnding {
  reason: V2ReleaseReason;
  eyebrow: string;
  title?: string;
  body: string;
  intentionText: string;
  /** Evolve only: the intention that continues, with its link note. */
  successor: { intentionText: string; note: string } | null;
  primary: { id: V2ReleaseActionId; label: string };
  secondary: { id: V2ReleaseActionId; label: string } | null;
}

/** The completion config for a verified reason. Evolve without a successor degrades to the manual ending. */
export function buildReleaseEnding(input: {
  reason: V2ReleaseReason;
  intentionText: string;
  successor?: V2ReleaseSuccessor | null;
}): V2ReleaseEnding {
  const reason = input.reason === 'evolve' && !input.successor ? 'no_longer_aligned' : input.reason;
  const copy = RELEASE_ENDINGS[reason];
  return {
    reason,
    eyebrow: copy.eyebrow,
    title: copy.title,
    body: copy.body,
    intentionText: input.intentionText,
    successor: reason === 'evolve' && input.successor ? { intentionText: input.successor.intentionText, note: RELEASE_SUCCESSOR_LINK_NOTE } : null,
    primary: copy.primary,
    secondary: copy.secondary ?? null,
  };
}
