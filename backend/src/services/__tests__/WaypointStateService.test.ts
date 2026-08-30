import {
  deriveBlockedReason,
  deriveWaypointState,
  hasAvailablePrimaryAnchor,
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
    // D10: no link record at all means "never anchored", not "blocked".
    expect(deriveWaypointState(course, waypoint(), null, null)).toBe('CURRENT');
  });

  it('distinguishes the three blocked reasons', () => {
    expect(deriveBlockedReason(null, null)).toBeNull();
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

  /**
   * Decision D10 — docs/chart/PHASE_0_D10_DECISION.md.
   *
   * A current waypoint that has never had a primary Anchor link is CURRENT, not
   * BLOCKED. `BLOCKED` is reserved for a link that existed and stopped working,
   * which is the only situation any code path emits WAYPOINT_BLOCKED for.
   */
  describe('a current waypoint that was never anchored (D10)', () => {
    it('is CURRENT, with no blocked reason', () => {
      expect(deriveBlockedReason(null, null)).toBeNull();
      expect(deriveWaypointState(course, waypoint(), null, null)).toBe('CURRENT');
    });

    it('is still distinguishable from an anchored waypoint', () => {
      expect(hasAvailablePrimaryAnchor(null, null)).toBe(false);
      expect(hasAvailablePrimaryAnchor(availableLink, availableAnchor)).toBe(true);
    });

    it('does not make a non-current unanchored waypoint anything but UPCOMING', () => {
      expect(deriveWaypointState(course, waypoint({ id: 'waypoint-9' }), null, null)).toBe(
        'UPCOMING'
      );
    });

    it('still blocks a link that was explicitly unlinked or released', () => {
      const unlinked = {
        ...availableLink,
        unlinkedAt: new Date('2026-08-02T12:00:00.000Z'),
        anchorSnapshot: { releasedAtUnlink: false },
      };
      expect(deriveBlockedReason(unlinked, null)).toBe('ANCHOR_UNLINKED');
      expect(deriveWaypointState(course, waypoint(), unlinked, null)).toBe('BLOCKED');
    });
  });

  it('reports an unavailable Anchor as unusable even though it is not "not blocked"', () => {
    // hasAvailablePrimaryAnchor is strictly stronger than "no blocked reason":
    // both of these have no usable Anchor, but only one of them is BLOCKED.
    expect(hasAvailablePrimaryAnchor({ ...availableLink, anchorId: null }, null)).toBe(false);
    expect(deriveBlockedReason({ ...availableLink, anchorId: null }, null)).toBe('ANCHOR_DELETED');
    expect(hasAvailablePrimaryAnchor(null, null)).toBe(false);
    expect(deriveBlockedReason(null, null)).toBeNull();
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
