/**
 * Executable verification of docs/chart/PHASE_0_FIXTURE_MATRIX.md.
 *
 * These tests assert the *contract* each fixture must satisfy, not the pixels.
 * They exist so Phase 1 cannot regress a rule while the visuals are being built:
 * if a future change lets a mutation through offline, reintroduces
 * "MAKE THIS CURRENT", or lets `DESTINATION` become a WaypointState, one of these
 * fails.
 */

import {
  CHART_FIXTURES,
  CHART_FIXTURE_NAMES,
  FIXTURE_COURSE_ID,
  FIXTURE_COURSE_VERSION,
  FIXTURE_DESTINATION,
  FIXTURE_PLOTTED_AT,
  FORBIDDEN_PROTOTYPE_CONTROLS,
  UNKNOWN_DEEP_LINK_TARGETS,
  VALID_WAYPOINT_STATES,
  WAYPOINT_IDS,
  type ChartFixture,
} from '../__fixtures__/phase0';
import { CHART_STALE_AFTER_MS } from '@/types/chart';

const fixture = (name: string): ChartFixture => {
  const found = CHART_FIXTURES[name];
  if (!found) throw new Error(`Unknown fixture: ${name}`);
  return found;
};

const allFixtures = (): ChartFixture[] => Object.values(CHART_FIXTURES);

/**
 * The states in which the frozen contract requires Course mutations to fail
 * closed. Kept as a list so a new read-only state must be classified here
 * explicitly rather than defaulting to writable.
 */
const MUTATION_DENIED_FIXTURES = [
  'loading',
  'offline',
  'stale',
  'migration-required',
  'repair-required',
  'chart-disabled',
  'completed',
  'archived',
  'not-found',
  'version-conflict',
  'network-error-cached',
];

describe('Phase 0 fixture matrix — coverage', () => {
  it('covers every documented fixture exactly once', () => {
    // Mirrors the matrix rows. A row added to the doc without a fixture here is
    // an unimplemented state, which is what NO-GO was about.
    expect(CHART_FIXTURE_NAMES.sort()).toEqual(
      [
        'active-current',
        'archived',
        'cancelled',
        'chart-disabled',
        'completed',
        'current-blocked',
        'draft-setup',
        'empty',
        'entitlement-locked',
        'loading',
        'migration-required',
        'network-error-cached',
        'not-found',
        'offline',
        'reached',
        'reached-next-unlinked',
        'repair-required',
        'skipped',
        'stale',
        'upcoming',
        'version-conflict',
      ].sort(),
    );
  });

  it('uses the documented deterministic fixture conventions', () => {
    const active = fixture('active-current').state.activeCourse;
    expect(active).not.toBeNull();
    expect(active?.id).toBe(FIXTURE_COURSE_ID);
    expect(active?.version).toBe(FIXTURE_COURSE_VERSION);
    expect(active?.destinationText).toBe(FIXTURE_DESTINATION);
    expect(active?.plottedAt).toBe(FIXTURE_PLOTTED_AT);
  });
});

describe('Phase 0 fixture matrix — pointer authority', () => {
  it('never exposes more than one current waypoint', () => {
    for (const item of allFixtures()) {
      const waypoints = item.state.activeCourse?.waypoints ?? [];
      const currents = waypoints.filter(wp => wp.state === 'CURRENT');
      expect(currents.length).toBeLessThanOrEqual(1);
    }
  });

  it('derives CURRENT only for the waypoint Course.currentWaypointId points at', () => {
    for (const item of allFixtures()) {
      const course = item.state.activeCourse;
      if (!course) continue;
      for (const wp of course.waypoints) {
        if (wp.state === 'CURRENT') expect(wp.id).toBe(course.currentWaypointId);
      }
      // BLOCKED is the current waypoint too — it is current-but-unresolvable,
      // which is why it must never advance on its own.
      const blocked = course.waypoints.filter(wp => wp.state === 'BLOCKED');
      for (const wp of blocked) expect(wp.id).toBe(course.currentWaypointId);
    }
  });

  it('clears the pointer for every non-ACTIVE course', () => {
    for (const item of allFixtures()) {
      const course = item.state.activeCourse;
      if (!course || course.status === 'ACTIVE') continue;
      expect(course.currentWaypointId).toBeNull();
    }
  });

  it('never marks a terminal waypoint as current', () => {
    for (const item of allFixtures()) {
      const course = item.state.activeCourse;
      if (!course?.currentWaypointId) continue;
      const current = course.waypoints.find(wp => wp.id === course.currentWaypointId);
      expect(current).toBeDefined();
      expect(['SKIPPED', 'CANCELLED', 'REACHED']).not.toContain(current?.state);
    }
  });
});

describe('Phase 0 fixture matrix — corrected prototype affordances', () => {
  it('never uses DESTINATION as a WaypointState', () => {
    for (const item of allFixtures()) {
      for (const wp of item.state.activeCourse?.waypoints ?? []) {
        expect(VALID_WAYPOINT_STATES).toContain(wp.state);
        expect(wp.state as string).not.toBe('DESTINATION');
      }
      for (const state of item.expectation.waypointStates) {
        expect(VALID_WAYPOINT_STATES).toContain(state);
      }
    }
  });

  it('keeps the destination a Course-level property, not a waypoint', () => {
    const active = fixture('active-current').state.activeCourse!;
    expect(active.destinationText).toBe(FIXTURE_DESTINATION);
    // The final route item is an ordinary upcoming waypoint.
    const last = active.waypoints[active.waypoints.length - 1];
    expect(last.id).toBe(WAYPOINT_IDS.tenK);
    expect(last.state).toBe('UPCOMING');
  });

  it('lists the prototype controls that must never ship', () => {
    expect(FORBIDDEN_PROTOTYPE_CONTROLS).toContain('MAKE THIS CURRENT');
    expect(FORBIDDEN_PROTOTYPE_CONTROLS).toContain('PAUSE COURSE');
    expect(FORBIDDEN_PROTOTYPE_CONTROLS).toContain('SWITCH COURSE');
  });

  it('has no paused course status and at most one live course', () => {
    const liveStatuses = allFixtures()
      .map(item => item.state.activeCourse?.status)
      .filter((status): status is NonNullable<typeof status> => status != null);
    for (const status of liveStatuses) {
      expect(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).toContain(status);
    }
    // Each fixture models exactly one course; there is no switcher fixture.
    for (const item of allFixtures()) {
      expect(Array.isArray(item.state.activeCourse)).toBe(false);
    }
  });
});

describe('Phase 0 fixture matrix — mutations fail closed', () => {
  it.each(MUTATION_DENIED_FIXTURES)(
    'disables course mutations in the %s fixture',
    name => {
      expect(fixture(name).expectation.mutationsAllowed).toBe(false);
    },
  );

  it('only allows mutations in fresh, online, writable states', () => {
    for (const item of allFixtures()) {
      if (!item.expectation.mutationsAllowed) continue;
      expect(item.state.offline).toBe(false);
      expect(item.state.stale).toBe(false);
      expect(item.state.readOnly).toBe(false);
      expect(item.state.loading).toBe(false);
      expect(item.state.migrationRequired).toBe(false);
      expect(item.state.flags.chart_write_enabled).toBe(true);
      expect(item.state.activeCourse?.needsRepair).toBeUndefined();
    }
  });

  it('keeps cached reads and encrypted local drafts available offline', () => {
    const offline = fixture('offline');
    expect(offline.state.activeCourse).not.toBeNull();
    expect(offline.expectation.readNavigationAllowed).toBe(true);
    expect(offline.expectation.localDraftAllowed).toBe(true);
    expect(offline.expectation.mutationsAllowed).toBe(false);
  });

  it('treats a cache older than the stale threshold as stale', () => {
    const stale = fixture('stale');
    const age = Date.parse('2026-08-04T15:00:00.000Z') - Date.parse(stale.state.lastSyncedAt!);
    expect(age).toBeGreaterThan(CHART_STALE_AFTER_MS);
    expect(stale.state.stale).toBe(true);
  });

  it('never shows stale data while loading', () => {
    const loading = fixture('loading');
    expect(loading.state.activeCourse).toBeNull();
    expect(loading.state.lastSyncedAt).toBeNull();
  });

  it('treats any fixture without a sync timestamp as stale', () => {
    // Mirrors the store: `stale = !lastSyncedAt || age > CHART_STALE_AFTER_MS`.
    for (const item of allFixtures()) {
      if (item.state.lastSyncedAt === null) expect(item.state.stale).toBe(true);
    }
  });

  it('does not repair the pointer locally when the server says repair is needed', () => {
    const repair = fixture('repair-required');
    expect(repair.state.activeCourse?.needsRepair).toBe(true);
    expect(repair.state.readOnly).toBe(true);
    expect(repair.expectation.mutationsAllowed).toBe(false);
    // No client-side pointer inference: the pointer is whatever the server sent.
    expect(repair.state.activeCourse?.currentWaypointId).toBe(WAYPOINT_IDS.current);
  });
});

describe('Phase 0 fixture matrix — blocked, skipped, cancelled', () => {
  it('keeps the burned Anchor snapshot in history and blocks the current waypoint', () => {
    const course = fixture('current-blocked').state.activeCourse!;
    const current = course.waypoints.find(wp => wp.id === course.currentWaypointId)!;
    expect(current.state).toBe('BLOCKED');
    expect(current.blockedReason).toBe('ANCHOR_RELEASED');
    // Link is closed (no live anchor) but the snapshot survives.
    expect(current.anchorLink?.anchorId).toBeNull();
    expect(current.anchorLink?.anchorAvailable).toBe(false);
    expect(current.anchorLink?.snapshot.releasedAtUnlink).toBe(true);
    expect(current.anchorLink?.snapshot.intentionText).toBe(FIXTURE_DESTINATION);
  });

  it('does not advance the pointer because an Anchor was released', () => {
    const blocked = fixture('current-blocked').state.activeCourse!;
    const active = fixture('active-current').state.activeCourse!;
    expect(blocked.currentWaypointId).toBe(active.currentWaypointId);
    expect(blocked.reachedCount).toBe(2);
  });

  it('offers no practice on a blocked waypoint', () => {
    expect(fixture('current-blocked').expectation.practiceAllowed).toBe(false);
    expect(fixture('reached-next-unlinked').expectation.practiceAllowed).toBe(false);
  });

  /**
   * Decision D10 — docs/chart/PHASE_0_D10_DECISION.md.
   *
   * A current waypoint that has never had a primary Anchor linked is CURRENT,
   * not BLOCKED, so a reach never strands the Course. The un-anchored condition
   * is carried by `anchorLink: null`; it withholds practice, nothing else.
   */
  it('leaves an un-anchored next waypoint CURRENT after a reach', () => {
    const unanchored = fixture('reached-next-unlinked').state.activeCourse!;
    const current = unanchored.waypoints.find(
      wp => wp.id === unanchored.currentWaypointId,
    )!;

    expect(current.state).toBe('CURRENT');
    expect(current.blockedReason).toBeNull();
    expect(current.anchorLink).toBeNull();
    // The same transition with a linked next waypoint is also CURRENT — the only
    // difference is whether practice is available.
    const linked = fixture('reached').state.activeCourse!;
    const linkedCurrent = linked.waypoints.find(wp => wp.id === linked.currentWaypointId)!;
    expect(linkedCurrent.state).toBe('CURRENT');
    expect(linkedCurrent.anchorLink).not.toBeNull();
    expect(fixture('reached').expectation.practiceAllowed).toBe(true);
    expect(fixture('reached-next-unlinked').expectation.practiceAllowed).toBe(false);
  });

  it('reserves BLOCKED for a link that existed and stopped working', () => {
    // Every BLOCKED waypoint across the matrix must retain the link record that
    // explains it. A BLOCKED waypoint with no anchorLink would be a state the
    // server has no WAYPOINT_BLOCKED event for.
    for (const item of allFixtures()) {
      for (const wp of item.state.activeCourse?.waypoints ?? []) {
        if (wp.state !== 'BLOCKED') continue;
        expect(wp.blockedReason).not.toBeNull();
        expect(wp.anchorLink).not.toBeNull();
      }
    }
  });

  it('never pairs a blocked reason with a non-BLOCKED state', () => {
    for (const item of allFixtures()) {
      for (const wp of item.state.activeCourse?.waypoints ?? []) {
        if (wp.state === 'BLOCKED') continue;
        expect(wp.blockedReason).toBeNull();
      }
    }
  });

  it('allows mutations on an un-anchored current waypoint, so no Course is stuck', () => {
    // The reach/skip path is what keeps the Course live; only practice depends
    // on an Anchor being linked.
    const unanchored = fixture('reached-next-unlinked');
    expect(unanchored.expectation.mutationsAllowed).toBe(true);
    expect(unanchored.expectation.practiceAllowed).toBe(false);
    expect(unanchored.expectation.readNavigationAllowed).toBe(true);
  });

  it('renders skipped and cancelled as distinct terminal states', () => {
    const skipped = fixture('skipped').state.activeCourse!.waypoints.find(
      wp => wp.id === WAYPOINT_IDS.fiveK,
    )!;
    const cancelled = fixture('cancelled').state.activeCourse!.waypoints.find(
      wp => wp.id === WAYPOINT_IDS.fiveK,
    )!;
    expect(skipped.state).toBe('SKIPPED');
    expect(skipped.skippedAt).not.toBeNull();
    expect(skipped.cancelledAt).toBeNull();
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.skippedAt).toBeNull();
    // Cancellation is not a skip.
    expect(cancelled.state).not.toBe(skipped.state);
  });

  it('uses the frozen cancellation copy', () => {
    expect(fixture('cancelled').expectation.copy).toBe(
      'Waypoint removed from the course',
    );
  });

  it('only cancels an upcoming, non-current waypoint', () => {
    const course = fixture('cancelled').state.activeCourse!;
    const cancelled = course.waypoints.find(wp => wp.state === 'CANCELLED')!;
    expect(cancelled.id).not.toBe(course.currentWaypointId);
  });

  it('increments the course version for skip and cancel', () => {
    expect(fixture('skipped').state.activeCourse!.version).toBe(
      FIXTURE_COURSE_VERSION + 1,
    );
    expect(fixture('cancelled').state.activeCourse!.version).toBe(
      FIXTURE_COURSE_VERSION + 1,
    );
  });
});

describe('Phase 0 fixture matrix — completed and archived', () => {
  it('shows completion only with a server-confirmed COMPLETED status', () => {
    const completed = fixture('completed');
    expect(completed.state.activeCourse?.status).toBe('COMPLETED');
    expect(completed.state.activeCourse?.completedAt).not.toBeNull();
    expect(completed.expectation.copy).toBe('Completion is confirmed by the server.');
  });

  it('exposes no edit, reorder, reach, or cancel controls when completed or archived', () => {
    for (const name of ['completed', 'archived']) {
      expect(fixture(name).expectation.mutationsAllowed).toBe(false);
      expect(fixture(name).expectation.practiceAllowed).toBe(false);
    }
  });

  it('marks archived read-only and keeps it navigable', () => {
    const archived = fixture('archived');
    expect(archived.state.readOnly).toBe(true);
    expect(archived.state.activeCourse?.status).toBe('ARCHIVED');
    expect(archived.expectation.readNavigationAllowed).toBe(true);
  });
});

describe('Phase 0 fixture matrix — errors, migration, disabled flag', () => {
  it('keeps cached Chart usable on a refresh failure', () => {
    const cached = fixture('network-error-cached');
    expect(cached.state.errorCode).toBe('NETWORK');
    expect(cached.state.activeCourse).not.toBeNull();
    expect(cached.expectation.readNavigationAllowed).toBe(true);
    expect(cached.expectation.copy).toBe(
      'Chart could not refresh. Cached data remains available.',
    );
  });

  it('uses the frozen copy for not-found, conflict, and migration', () => {
    expect(fixture('not-found').expectation.copy).toBe(
      'That Course is no longer available.',
    );
    expect(fixture('version-conflict').expectation.copy).toBe(
      'This Course changed elsewhere. Your view has been refreshed.',
    );
    expect(fixture('migration-required').expectation.copy).toBe(
      'Chart needs to finish preparing your account.',
    );
  });

  it('discards the local view in favour of the newer server version on conflict', () => {
    const conflict = fixture('version-conflict');
    expect(conflict.state.errorCode).toBe('COURSE_VERSION_CONFLICT');
    expect(conflict.state.activeCourse!.version).toBeGreaterThan(FIXTURE_COURSE_VERSION);
    expect(conflict.expectation.mutationsAllowed).toBe(false);
  });

  it('exposes nothing writable while migration is required', () => {
    const migration = fixture('migration-required');
    expect(migration.state.migrationRequired).toBe(true);
    expect(migration.state.readOnly).toBe(true);
    expect(migration.state.activeCourse).toBeNull();
  });

  it('exposes no Chart surface at all when the flag is off', () => {
    const disabled = fixture('chart-disabled');
    expect(disabled.state.flags.chart_enabled).toBe(false);
    expect(disabled.state.flags.chart_write_enabled).toBe(false);
    expect(disabled.expectation.readNavigationAllowed).toBe(false);
    expect(disabled.expectation.localDraftAllowed).toBe(false);
    expect(disabled.expectation.expectedNavigation).toBe('Vault');
  });
});

describe('Phase 0 fixture matrix — entitlement and navigation', () => {
  it('shows the practice card but denies launch when entitlement is locked', () => {
    const locked = fixture('entitlement-locked');
    // The Course is fresh and writable — only the entitlement blocks practice.
    expect(locked.state.offline).toBe(false);
    expect(locked.state.stale).toBe(false);
    expect(locked.expectation.practiceAllowed).toBe(false);
    expect(locked.expectation.expectedNavigation).toBe('Paywall');
  });

  it('routes each fixture to its documented destination', () => {
    expect(fixture('empty').expectation.expectedNavigation).toBe('CourseSetup');
    expect(fixture('active-current').expectation.expectedNavigation).toBe('WaypointDetail');
    expect(fixture('upcoming').expectation.expectedNavigation).toBe('WaypointDetail');
    expect(fixture('skipped').expectation.expectedNavigation).toBe('CourseLog');
    expect(fixture('cancelled').expectation.expectedNavigation).toBe('CourseLog');
    expect(fixture('completed').expectation.expectedNavigation).toBe('CompletedJourney');
    expect(fixture('archived').expectation.expectedNavigation).toBe('CourseDetails');
    expect(fixture('draft-setup').expectation.expectedNavigation).toBe('CourseEditor');
  });

  it('produces no navigation from loading, migration, or repair', () => {
    for (const name of ['loading', 'migration-required', 'repair-required']) {
      expect(fixture(name).expectation.expectedNavigation).toBeNull();
    }
  });

  it('maps unknown deep-link targets to typed errors, not to a fabricated course', () => {
    expect(UNKNOWN_DEEP_LINK_TARGETS.unknownCourse.expectedErrorCode).toBe(
      'COURSE_NOT_FOUND',
    );
    expect(UNKNOWN_DEEP_LINK_TARGETS.unknownWaypoint.expectedErrorCode).toBe(
      'WAYPOINT_NOT_FOUND',
    );
    expect(UNKNOWN_DEEP_LINK_TARGETS.unknownCourse.courseId).not.toBe(FIXTURE_COURSE_ID);
  });
});

describe('Phase 0 fixture matrix — progress and accessibility semantics', () => {
  it('reports reached counts that match the waypoint states', () => {
    for (const item of allFixtures()) {
      const course = item.state.activeCourse;
      if (!course) continue;
      const reached = course.waypoints.filter(wp => wp.state === 'REACHED').length;
      expect(course.reachedCount).toBe(reached);
      expect(course.waypointCount).toBe(course.waypoints.length);
    }
  });

  it('uses the observed progress copy for the active fixture', () => {
    const active = fixture('active-current');
    expect(active.expectation.copy).toBe('2 of 5 waypoints reached');
    expect(active.state.activeCourse!.reachedCount).toBe(2);
    expect(active.state.activeCourse!.waypointCount).toBe(5);
  });

  it('gives every waypoint a non-empty title so the linear list is announceable', () => {
    for (const item of allFixtures()) {
      for (const wp of item.state.activeCourse?.waypoints ?? []) {
        expect(wp.title.trim().length).toBeGreaterThan(0);
        // State is carried as data, so a screen reader label can be built from
        // title + state without relying on colour alone.
        expect(VALID_WAYPOINT_STATES).toContain(wp.state);
      }
    }
  });

  it('keeps waypoint positions unique and ordered within a course', () => {
    for (const item of allFixtures()) {
      const positions = (item.state.activeCourse?.waypoints ?? []).map(wp => wp.position);
      expect(new Set(positions).size).toBe(positions.length);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it('scopes every waypoint to its own course', () => {
    for (const item of allFixtures()) {
      const course = item.state.activeCourse;
      if (!course) continue;
      for (const wp of course.waypoints) expect(wp.courseId).toBe(course.id);
    }
  });
});

describe('Phase 0 fixture matrix — privacy', () => {
  it('carries no reflection text on any fixture course payload', () => {
    for (const item of allFixtures()) {
      const serialized = JSON.stringify(item.state.activeCourse ?? {});
      // Anchor snapshots legitimately hold intention text; reflection bodies and
      // structured content must never appear in a Course payload.
      expect(serialized).not.toContain('whatHelped');
      expect(serialized).not.toContain('whatLearned');
      expect(serialized).not.toContain('reflectionBody');
    }
  });
});
