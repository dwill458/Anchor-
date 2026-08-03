import type { CourseLogEntry } from '@/types/chart';

export const COURSE_EVENT_COPY: Record<CourseLogEntry['eventType'], string> = {
  COURSE_CREATED: 'Course created.',
  DESTINATION_CHANGED: 'Destination updated.',
  WAYPOINT_ADDED: 'Waypoint added.',
  WAYPOINT_REORDERED: 'Waypoints reordered.',
  DESTINATION_ANCHOR_LINKED: 'Destination Anchor linked.',
  WAYPOINT_ANCHOR_LINKED: 'Waypoint Anchor linked.',
  PRACTICE_COMPLETED: 'Practice completed.',
  REFLECTION_ADDED: 'Reflection added',
  WAYPOINT_REACHED: 'Waypoint reached.',
  WAYPOINT_SKIPPED: 'Waypoint skipped.',
  WAYPOINT_CANCELLED: 'Waypoint removed from the course.',
  WAYPOINT_BLOCKED: 'Waypoint needs a new Anchor.',
  WAYPOINT_UNBLOCKED: 'Waypoint is available again.',
  COURSE_COMPLETED: 'Destination reached.',
  COURSE_ARCHIVED: 'Course archived.',
  COURSE_RESTORED: 'Course restored.',
};

export function courseLogEventCopy(entry: CourseLogEntry): string {
  const title = typeof entry.snapshot?.waypointTitle === 'string' ? entry.snapshot.waypointTitle : null;
  if (title && entry.eventType === 'WAYPOINT_REACHED') return `${title} reached.`;
  if (title && entry.eventType === 'WAYPOINT_SKIPPED') return `${title} skipped.`;
  if (title && entry.eventType === 'WAYPOINT_BLOCKED') return `${title} needs a new Anchor.`;
  if (entry.eventType === 'PRACTICE_COMPLETED' && entry.practiceSession) return `Completed a ${entry.practiceSession.practiceMode} practice.`;
  return COURSE_EVENT_COPY[entry.eventType];
}

export function isReleasedAnchorEntry(entry: CourseLogEntry): boolean {
  return entry.anchorLink?.anchorAvailable === false;
}
