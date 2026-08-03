import {
  deriveBlockedReason,
  deriveWaypointState,
  selectNextWaypoint,
  validateCourseInvariants,
} from '../WaypointStateService';

const course = { id: 'course-1', status: 'ACTIVE' as const, currentWaypointId: 'waypoint-1' };
const availableAnchor = { id: 'anchor-1', isArchived: false };
const availableLink = {
  id: 'link-1',
  role: 'WAYPOINT_PRIMARY' as const,
  anchorId: 'anchor-1',
  anchorSnapshot: null,
  linkedAt: new Date('2026-08-01T00:00:00.000Z'),
  unlinkedAt: null,
};

function waypoint(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'waypoint-1',
    courseId: 'course-1',
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    ...overrides,
  } as any;
}

describe('WaypointStateService', () => {
  it('derives every persisted/projection state from timestamps and the current pointer', () => {
    expect(deriveWaypointState(course, waypoint(), availableLink, availableAnchor)).toBe('CURRENT');
    expect(
      deriveWaypointState(course, waypoint({ id: 'waypoint-2' }), availableLink, availableAnchor)
    ).toBe('UPCOMING');
    expect(
      deriveWaypointState(
        course,
        waypoint({ reachedAt: new Date() }),
        availableLink,
        availableAnchor
      )
    ).toBe('REACHED');
    expect(
      deriveWaypointState(
        course,
        waypoint({ skippedAt: new Date() }),
        availableLink,
        availableAnchor
      )
    ).toBe('SKIPPED');
    expect(
      deriveWaypointState(
        course,
        waypoint({ cancelledAt: new Date() }),
        availableLink,
        availableAnchor
      )
    ).toBe('CANCELLED');
    expect(deriveWaypointState(course, waypoint(), null, null)).toBe('BLOCKED');
  });

  it('distinguishes the three blocked reasons', () => {
    expect(deriveBlockedReason(null, null)).toBe('ANCHOR_UNLINKED');
    expect(deriveBlockedReason({ ...availableLink, anchorId: null }, null)).toBe('ANCHOR_DELETED');
    expect(deriveBlockedReason(availableLink, null)).toBe('ANCHOR_RELEASED');
    expect(deriveBlockedReason(availableLink, { ...availableAnchor, isArchived: true })).toBe(
      'ANCHOR_RELEASED'
    );
    const releasedLink = {
      ...availableLink,
      anchorId: null,
      unlinkedAt: new Date('2026-08-02T12:00:00.000Z'),
      anchorSnapshot: { releasedAtUnlink: true },
    };
    expect(deriveBlockedReason(releasedLink, null)).toBe('ANCHOR_RELEASED');
    expect(deriveWaypointState(course, waypoint(), releasedLink, null)).toBe('BLOCKED');
    expect(deriveBlockedReason(availableLink, availableAnchor)).toBeNull();
  });

  it('selects the next nonterminal waypoint by sparse position', () => {
    const next = selectNextWaypoint(
      [
        { position: 300, reachedAt: null, skippedAt: null, cancelledAt: null, id: 'third' },
        { position: 100, reachedAt: new Date(), skippedAt: null, cancelledAt: null, id: 'done' },
        { position: 200, reachedAt: null, skippedAt: null, cancelledAt: null, id: 'second' },
      ],
      100
    );
    expect(next?.id).toBe('second');
  });

  it('reports pointer and active-course invariant violations', () => {
    expect(
      validateCourseInvariants({ ...course, currentWaypointId: null }, [waypoint()])
    ).toContain('ACTIVE_COURSE_HAS_NO_CURRENT');
    expect(
      validateCourseInvariants({ ...course, currentWaypointId: 'missing' }, [waypoint()])
    ).toContain('CURRENT_POINTER_MISSING');
    expect(
      validateCourseInvariants({ ...course, status: 'DRAFT', currentWaypointId: 'waypoint-1' }, [
        waypoint(),
      ])
    ).toContain('INACTIVE_COURSE_HAS_CURRENT');
  });
});
