import { COURSE_EVENT_COPY, courseLogEventCopy, isReleasedAnchorEntry } from '../courseLogPresentation';
import type { CourseEventType, CourseLogEntry } from '@/types/chart';

const entry = (eventType: CourseEventType): CourseLogEntry => ({
  id: eventType,
  eventType,
  message: '',
  waypointId: null,
  occurredAt: '2026-08-03T00:00:00.000Z',
  recordedAt: '2026-08-03T00:00:00.000Z',
  snapshot: null,
  reflection: null,
  practiceSession: null,
  anchorLink: null,
});

describe('Course Log presentation', () => {
  it('renders every frozen CourseEventType safely', () => {
    expect(Object.keys(COURSE_EVENT_COPY).sort()).toEqual([
      'COURSE_ARCHIVED', 'COURSE_COMPLETED', 'COURSE_CREATED', 'COURSE_RESTORED', 'DESTINATION_ANCHOR_LINKED', 'DESTINATION_CHANGED', 'PRACTICE_COMPLETED', 'REFLECTION_ADDED', 'WAYPOINT_ADDED', 'WAYPOINT_ANCHOR_LINKED', 'WAYPOINT_BLOCKED', 'WAYPOINT_CANCELLED', 'WAYPOINT_REACHED', 'WAYPOINT_REORDERED', 'WAYPOINT_SKIPPED', 'WAYPOINT_UNBLOCKED',
    ]);
    for (const eventType of Object.keys(COURSE_EVENT_COPY) as CourseEventType[]) {
      expect(courseLogEventCopy(entry(eventType))).toBeTruthy();
    }
  });

  it('uses the exact cancelled-waypoint copy', () => {
    expect(courseLogEventCopy(entry('WAYPOINT_CANCELLED'))).toBe('Waypoint removed from the course.');
  });

  it('keeps deleted reflections neutral and never uses deleted content', () => {
    expect(courseLogEventCopy(entry('REFLECTION_ADDED'))).toBe('Reflection added');
  });

  it('renders released anchors from a snapshot without fetching the live Anchor', () => {
    const released = {
      ...entry('WAYPOINT_BLOCKED'),
      anchorLink: {
        id: 'link', role: 'WAYPOINT_PRIMARY' as const, anchorId: null, anchorAvailable: false,
        linkedAt: '2026-08-03T00:00:00.000Z',
        snapshot: { snapshotVersion: 1 as const, anchorId: 'deleted', intentionText: 'private', category: 'focus', planetaryTier: null, enhancedImageUrl: null, releasedAtUnlink: true, capturedAt: '2026-08-03T00:00:00.000Z' },
      },
    };
    expect(isReleasedAnchorEntry(released)).toBe(true);
  });
});
