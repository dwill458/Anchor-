import type { Anchor, Course, CourseAnchorLink, Waypoint } from '@prisma/client';
import type {
  AnchorLinkSummary,
  AnchorSnapshot,
  BlockedReason,
  WaypointState,
  WaypointSummary,
} from '../types/chart';

type CoursePointer = Pick<Course, 'id' | 'status' | 'currentWaypointId'>;

export type WaypointWithOptionalCourse = Pick<
  Waypoint,
  | 'id'
  | 'courseId'
  | 'position'
  | 'title'
  | 'description'
  | 'reachedAt'
  | 'skippedAt'
  | 'cancelledAt'
  | 'supportingPracticeSessionId'
  | 'createdAt'
  | 'updatedAt'
>;

export type ActiveLink = Pick<
  CourseAnchorLink,
  'id' | 'role' | 'anchorId' | 'anchorSnapshot' | 'linkedAt' | 'unlinkedAt'
> | null;

export type AvailableAnchor = Pick<Anchor, 'id' | 'isArchived'> | null;

export type CourseInvariantViolation =
  | 'CURRENT_POINTER_MISSING'
  | 'CURRENT_POINTER_WRONG_COURSE'
  | 'CURRENT_POINTER_TERMINAL'
  | 'INACTIVE_COURSE_HAS_CURRENT'
  | 'ACTIVE_COURSE_HAS_NO_CURRENT'
  | 'ACTIVE_COURSE_HAS_NO_WAYPOINTS'
  | 'CURRENT_POINTER_HAS_TERMINAL_REMAINDER';

export function isTerminal(
  waypoint: Pick<Waypoint, 'reachedAt' | 'skippedAt' | 'cancelledAt'>
): boolean {
  return Boolean(waypoint.reachedAt || waypoint.skippedAt || waypoint.cancelledAt);
}

export function deriveBlockedReason(
  activeLink: ActiveLink,
  anchor: AvailableAnchor
): BlockedReason | null {
  if (activeLink?.unlinkedAt) {
    const snapshot = activeLink.anchorSnapshot as Partial<AnchorSnapshot> | null;
    return snapshot?.releasedAtUnlink ? 'ANCHOR_RELEASED' : 'ANCHOR_UNLINKED';
  }
  if (activeLink?.anchorId == null) {
    return activeLink ? 'ANCHOR_DELETED' : 'ANCHOR_UNLINKED';
  }
  if (!anchor || anchor.isArchived) {
    return 'ANCHOR_RELEASED';
  }
  return null;
}

export function deriveWaypointState(
  course: CoursePointer,
  waypoint: Pick<Waypoint, 'id' | 'courseId' | 'reachedAt' | 'skippedAt' | 'cancelledAt'>,
  activeLink: ActiveLink,
  anchor: AvailableAnchor
): WaypointState {
  if (waypoint.cancelledAt) return 'CANCELLED';
  if (waypoint.skippedAt) return 'SKIPPED';
  if (waypoint.reachedAt) return 'REACHED';
  if (waypoint.id === course.currentWaypointId && deriveBlockedReason(activeLink, anchor)) {
    return 'BLOCKED';
  }
  if (waypoint.id === course.currentWaypointId) return 'CURRENT';
  return 'UPCOMING';
}

export function selectNextWaypoint<
  T extends Pick<Waypoint, 'position' | 'reachedAt' | 'skippedAt' | 'cancelledAt'>,
>(waypoints: readonly T[], departingPosition: number): T | null {
  return (
    waypoints
      .filter(waypoint => waypoint.position > departingPosition && !isTerminal(waypoint))
      .sort((left, right) => left.position - right.position)[0] ?? null
  );
}

export function validateCourseInvariants(
  course: CoursePointer,
  waypoints: readonly Pick<
    Waypoint,
    'id' | 'courseId' | 'position' | 'reachedAt' | 'skippedAt' | 'cancelledAt'
  >[]
): CourseInvariantViolation[] {
  const violations: CourseInvariantViolation[] = [];
  const current = course.currentWaypointId
    ? waypoints.find(waypoint => waypoint.id === course.currentWaypointId)
    : null;

  if (course.status === 'ACTIVE' && waypoints.length === 0) {
    violations.push('ACTIVE_COURSE_HAS_NO_WAYPOINTS');
  }
  if (course.status === 'ACTIVE' && waypoints.length > 0 && !course.currentWaypointId) {
    violations.push('ACTIVE_COURSE_HAS_NO_CURRENT');
  }
  if (course.status !== 'ACTIVE' && course.currentWaypointId) {
    violations.push('INACTIVE_COURSE_HAS_CURRENT');
  }
  if (course.currentWaypointId && !current) {
    violations.push('CURRENT_POINTER_MISSING');
  } else if (current && current.courseId !== course.id) {
    violations.push('CURRENT_POINTER_WRONG_COURSE');
  } else if (current && isTerminal(current)) {
    violations.push('CURRENT_POINTER_TERMINAL');
  }

  const nonTerminalAfterCurrent = current
    ? waypoints.some(waypoint => waypoint.position > current.position && !isTerminal(waypoint))
    : false;
  if (course.status === 'ACTIVE' && !nonTerminalAfterCurrent && current && isTerminal(current)) {
    violations.push('CURRENT_POINTER_HAS_TERMINAL_REMAINDER');
  }
  return violations;
}

function normalizeSnapshot(value: unknown, fallback: string): AnchorSnapshot {
  if (typeof value === 'object' && value !== null) {
    const snapshot = value as Partial<AnchorSnapshot>;
    if (
      snapshot.snapshotVersion === 1 &&
      typeof snapshot.anchorId === 'string' &&
      typeof snapshot.intentionText === 'string' &&
      typeof snapshot.category === 'string' &&
      typeof snapshot.releasedAtUnlink === 'boolean' &&
      typeof snapshot.capturedAt === 'string'
    ) {
      return {
        snapshotVersion: 1,
        anchorId: snapshot.anchorId,
        intentionText: snapshot.intentionText,
        category: snapshot.category,
        planetaryTier: snapshot.planetaryTier ?? null,
        enhancedImageUrl: snapshot.enhancedImageUrl ?? null,
        releasedAtUnlink: snapshot.releasedAtUnlink,
        capturedAt: snapshot.capturedAt,
      };
    }
  }
  return {
    snapshotVersion: 1,
    anchorId: fallback,
    intentionText: '',
    category: '',
    planetaryTier: null,
    enhancedImageUrl: null,
    releasedAtUnlink: false,
    capturedAt: new Date(0).toISOString(),
  };
}

export function toAnchorLinkSummary(
  link: ActiveLink,
  anchor: AvailableAnchor
): AnchorLinkSummary | null {
  if (!link) return null;
  return {
    id: link.id,
    role: link.role,
    anchorId: link.anchorId,
    anchorAvailable: Boolean(link.anchorId && !link.unlinkedAt && anchor && !anchor.isArchived),
    snapshot: normalizeSnapshot(link.anchorSnapshot, link.anchorId ?? ''),
    linkedAt: link.linkedAt.toISOString(),
  };
}

export function buildWaypointSummary(
  course: CoursePointer,
  waypoint: WaypointWithOptionalCourse,
  activeLink: ActiveLink,
  anchor: AvailableAnchor
): WaypointSummary {
  const state = deriveWaypointState(course, waypoint, activeLink, anchor);
  return {
    id: waypoint.id,
    courseId: waypoint.courseId,
    position: waypoint.position,
    title: waypoint.title,
    description: waypoint.description,
    state,
    blockedReason: state === 'BLOCKED' ? deriveBlockedReason(activeLink, anchor) : null,
    reachedAt: waypoint.reachedAt?.toISOString() ?? null,
    skippedAt: waypoint.skippedAt?.toISOString() ?? null,
    cancelledAt: waypoint.cancelledAt?.toISOString() ?? null,
    anchorLink: toAnchorLinkSummary(activeLink, anchor),
  };
}

export function hasAvailablePrimaryAnchor(
  activeLink: ActiveLink,
  anchor: AvailableAnchor
): boolean {
  return deriveBlockedReason(activeLink, anchor) === null;
}
