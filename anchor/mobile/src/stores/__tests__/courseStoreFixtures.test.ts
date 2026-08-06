/**
 * Binds the Phase 0 fixture matrix to the real store gate.
 *
 * phase0Fixtures.test.ts asserts what each fixture *should* allow. This file
 * drives the actual courseStore with each fixture's state and asserts the store
 * agrees — otherwise the matrix would be documentation that nothing enforces.
 */

import { useCourseStore } from '../courseStore';
import { chartApiClient } from '@/services/ChartApiClient';
import {
  CHART_FIXTURES,
  FIXTURE_COURSE_ID,
  FIXTURE_COURSE_VERSION,
  WAYPOINT_IDS,
} from '@/screens/chart/__fixtures__/phase0';

const ACCOUNT_ID = 'acct-chart-phase0';

/** Every fixture the matrix says must refuse Course mutations. */
const MUTATION_DENIED = [
  'loading',
  'offline',
  'stale',
  'migration-required',
  'repair-required',
  'chart-disabled',
] as const;

function applyFixture(name: string): void {
  const fixture = CHART_FIXTURES[name];
  if (!fixture) throw new Error(`Unknown fixture: ${name}`);
  useCourseStore.setState({
    accountId: ACCOUNT_ID,
    courses: fixture.state.activeCourse ? [fixture.state.activeCourse] : [],
    activeCourse: fixture.state.activeCourse,
    flags: fixture.state.flags,
    loading: fixture.state.loading,
    refreshing: fixture.state.refreshing,
    errorCode: fixture.state.errorCode,
    migrationRequired: fixture.state.migrationRequired,
    readOnly: fixture.state.readOnly,
    offline: fixture.state.offline,
    stale: fixture.state.stale,
    lastSyncedAt: fixture.state.lastSyncedAt
      ? Date.parse(fixture.state.lastSyncedAt)
      : null,
  });
}

describe('courseStore — fixture mutation gating', () => {
  let spies: jest.SpyInstance[] = [];

  beforeEach(() => {
    // Any network call at all is a failure for a denied fixture.
    spies = [
      jest.spyOn(chartApiClient, 'archiveCourse'),
      jest.spyOn(chartApiClient, 'addWaypoint'),
      jest.spyOn(chartApiClient, 'reorderWaypoints'),
      jest.spyOn(chartApiClient, 'linkAnchor'),
      jest.spyOn(chartApiClient, 'unlinkAnchor'),
      jest.spyOn(chartApiClient, 'updateCourse'),
      jest.spyOn(chartApiClient, 'completeWaypoint'),
      jest.spyOn(chartApiClient, 'skipWaypoint'),
      jest.spyOn(chartApiClient, 'cancelWaypoint'),
    ];
    for (const spy of spies) {
      spy.mockRejectedValue(new Error('no network call expected'));
    }
  });

  afterEach(() => {
    for (const spy of spies) spy.mockRestore();
    useCourseStore.getState().clearAccount();
  });

  it.each(MUTATION_DENIED)('refuses every mutation in the %s fixture', async name => {
    applyFixture(name);
    const store = useCourseStore.getState();

    await store.archiveCourse(FIXTURE_COURSE_ID, FIXTURE_COURSE_VERSION);
    await store.addWaypoint(FIXTURE_COURSE_ID, {
      idempotencyKey: 'wp-add-1',
      expectedCourseVersion: FIXTURE_COURSE_VERSION,
      title: 'New waypoint',
    });
    await store.reorderWaypoints(FIXTURE_COURSE_ID, {
      expectedCourseVersion: FIXTURE_COURSE_VERSION,
      orderedWaypointIds: [WAYPOINT_IDS.start],
    });
    // The three waypoint transitions run through the same gate. Before they
    // existed on the store, a reach could be sent with a stale
    // expectedCourseVersion because nothing routed it through this chokepoint.
    await store.completeWaypoint(FIXTURE_COURSE_ID, WAYPOINT_IDS.current, {
      idempotencyKey: 'complete-1',
      expectedCourseVersion: FIXTURE_COURSE_VERSION,
    });
    await store.skipWaypoint(FIXTURE_COURSE_ID, WAYPOINT_IDS.current, {
      idempotencyKey: 'skip-1',
      expectedCourseVersion: FIXTURE_COURSE_VERSION,
    });
    await store.cancelWaypoint(FIXTURE_COURSE_ID, WAYPOINT_IDS.fiveK, {
      idempotencyKey: 'cancel-1',
      expectedCourseVersion: FIXTURE_COURSE_VERSION,
    });
    await store.linkAnchor(FIXTURE_COURSE_ID, {
      idempotencyKey: 'link-1',
      expectedCourseVersion: FIXTURE_COURSE_VERSION,
      anchorId: 'anchor-1',
      role: 'WAYPOINT_PRIMARY',
      waypointId: WAYPOINT_IDS.current,
    });
    await store.unlinkAnchor(FIXTURE_COURSE_ID, 'link-current', FIXTURE_COURSE_VERSION);

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('reports the same denial code for a transition as for any other mutation', async () => {
    // A reach denied while offline must not surface as a network failure — the
    // client never attempted it.
    for (const [name, code] of Object.entries({
      offline: 'OFFLINE',
      stale: 'STALE',
      'migration-required': 'MIGRATION_REQUIRED',
      'chart-disabled': 'FEATURE_DISABLED',
    })) {
      applyFixture(name);
      await useCourseStore.getState().completeWaypoint(FIXTURE_COURSE_ID, WAYPOINT_IDS.current, {
        idempotencyKey: `complete-${name}`,
        expectedCourseVersion: FIXTURE_COURSE_VERSION,
      });
      expect(useCourseStore.getState().errorCode).toBe(code);
    }
  });

  it('allows a reach on an un-anchored current waypoint (D10)', async () => {
    // The whole point of D10: a Course with an un-anchored current waypoint is
    // live, not stuck. The store must not invent a client-side gate for it.
    applyFixture('reached-next-unlinked');
    const course = useCourseStore.getState().activeCourse!;
    const current = course.waypoints.find(wp => wp.id === course.currentWaypointId)!;
    expect(current.state).toBe('CURRENT');
    expect(current.anchorLink).toBeNull();

    const spy = jest
      .spyOn(chartApiClient, 'completeWaypoint')
      .mockResolvedValue({
        data: {
          course: { ...course, currentWaypointId: WAYPOINT_IDS.tenK },
          completedWaypoint: { ...current, state: 'REACHED' },
          nextWaypoint:
            course.waypoints.find(wp => wp.id === WAYPOINT_IDS.tenK)! ,
          courseCompleted: false,
          completionEventId: 'event-1',
          replayed: false,
        },
      } as never);

    const result = await useCourseStore
      .getState()
      .completeWaypoint(FIXTURE_COURSE_ID, current.id, {
        idempotencyKey: 'complete-unanchored',
        expectedCourseVersion: course.version,
      });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    // The response is authoritative: the pointer moved without a refetch.
    expect(useCourseStore.getState().activeCourse?.currentWaypointId).toBe(WAYPOINT_IDS.tenK);
    spy.mockRestore();
  });

  it('reports a specific error code for each denied reason', async () => {
    const expected: Record<string, string> = {
      'chart-disabled': 'FEATURE_DISABLED',
      offline: 'OFFLINE',
      'migration-required': 'MIGRATION_REQUIRED',
      'repair-required': 'VALIDATION_ERROR',
      stale: 'STALE',
    };

    for (const [name, code] of Object.entries(expected)) {
      applyFixture(name);
      await useCourseStore.getState().archiveCourse(FIXTURE_COURSE_ID, FIXTURE_COURSE_VERSION);
      expect(useCourseStore.getState().errorCode).toBe(code);
    }
  });

  it('blocks a mutation when the cache is stale even though the network is up', async () => {
    // The Course version in a stale cache cannot safely be sent as
    // expectedCourseVersion — it may already have been superseded elsewhere.
    applyFixture('stale');
    expect(useCourseStore.getState().offline).toBe(false);

    await useCourseStore.getState().archiveCourse(FIXTURE_COURSE_ID, FIXTURE_COURSE_VERSION);

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(useCourseStore.getState().errorCode).toBe('STALE');
  });

  it('keeps the cached Course readable while mutations are denied', async () => {
    for (const name of ['offline', 'stale', 'network-error-cached'] as const) {
      applyFixture(name);
      const state = useCourseStore.getState();
      expect(state.activeCourse?.id).toBe(FIXTURE_COURSE_ID);
      expect(state.activeCourse?.waypoints.length).toBeGreaterThan(0);
    }
  });

  it('permits mutations only in the fresh, online, writable fixture', async () => {
    applyFixture('active-current');
    const state = useCourseStore.getState();
    expect(state.offline).toBe(false);
    expect(state.stale).toBe(false);
    expect(state.migrationRequired).toBe(false);
    expect(state.flags.chart_write_enabled).toBe(true);

    const spy = jest
      .spyOn(chartApiClient, 'archiveCourse')
      .mockResolvedValue({ data: CHART_FIXTURES['archived'].state.activeCourse! });
    await useCourseStore.getState().archiveCourse(FIXTURE_COURSE_ID, FIXTURE_COURSE_VERSION);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('courseStore — pointer authority', () => {
  afterEach(() => {
    useCourseStore.getState().clearAccount();
  });

  it('never writes a local current-waypoint flag', () => {
    applyFixture('active-current');
    const serialized = JSON.stringify(useCourseStore.getState());

    // The only pointer in client state is the server's currentWaypointId.
    expect(serialized).not.toContain('localCurrentWaypointId');
    expect(serialized).not.toContain('isCurrent');
    expect(serialized).not.toContain('pendingCurrent');
  });

  it('exposes no action that sets the current waypoint', () => {
    const actions = Object.keys(useCourseStore.getState()).filter(
      key => typeof (useCourseStore.getState() as Record<string, unknown>)[key] === 'function',
    );
    for (const action of actions) {
      expect(action.toLowerCase()).not.toContain('makecurrent');
      expect(action.toLowerCase()).not.toContain('setcurrentwaypoint');
      expect(action.toLowerCase()).not.toContain('pause');
    }
  });
});
