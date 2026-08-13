/**
 * Executable form of docs/chart/PHASE_0_FIXTURE_MATRIX.md.
 *
 * Every value here is deterministic and matches the documented matrix exactly,
 * so a fixture name in the doc, in a test, and in a screenshot all refer to the
 * same state. These are test fixtures only — nothing in this file is imported by
 * production code.
 *
 * Two rules this module enforces by construction:
 *   1. `DESTINATION` is never a WaypointState. The Course owns the destination.
 *   2. Waypoint `state` is server-derived display data. Fixtures state it
 *      explicitly rather than deriving it client-side, mirroring the contract
 *      that `Course.currentWaypointId` is the only pointer authority.
 */

import type {
  ChartErrorCode,
  ChartFeatureFlags,
  CourseDetail,
  CourseLogEntry,
  CourseSummary,
  WaypointState,
  WaypointSummary,
} from '@/types/chart';

// ── Fixture conventions (matrix "Fixture conventions" block) ────────────────

export const FIXTURE_ACCOUNT_ID = 'acct-chart-phase0';
export const FIXTURE_COURSE_ID = 'course-chart-phase0';
export const FIXTURE_COURSE_VERSION = 7;
export const FIXTURE_DESTINATION = 'Build a steadier creative practice';
export const FIXTURE_PLOTTED_AT = '2026-03-04T10:00:00.000Z';
export const FIXTURE_NOW = '2026-08-04T15:00:00.000Z';

export const FIXTURE_NOW_MS = Date.parse(FIXTURE_NOW);

export const WAYPOINT_IDS = {
  start: 'wp-start',
  hundred: 'wp-100',
  current: 'wp-current',
  fiveK: 'wp-5k',
  tenK: 'wp-10k',
} as const;

const WAYPOINT_TITLES: Record<string, string> = {
  [WAYPOINT_IDS.start]: 'BEGIN',
  [WAYPOINT_IDS.hundred]: 'FIND A RHYTHM',
  [WAYPOINT_IDS.current]: 'DEEPEN THE PRACTICE',
  [WAYPOINT_IDS.fiveK]: 'SUSTAIN THE RHYTHM',
  [WAYPOINT_IDS.tenK]: 'INTEGRATE THE PRACTICE',
};

const WAYPOINT_ORDER = [
  WAYPOINT_IDS.start,
  WAYPOINT_IDS.hundred,
  WAYPOINT_IDS.current,
  WAYPOINT_IDS.fiveK,
  WAYPOINT_IDS.tenK,
] as const;

// ── Builders ────────────────────────────────────────────────────────────────

function anchorLink(
  id: string,
  anchorId: string,
  intentionText: string,
  options: { available?: boolean; releasedAtUnlink?: boolean } = {},
): NonNullable<WaypointSummary['anchorLink']> {
  const available = options.available ?? true;
  return {
    id,
    role: 'WAYPOINT_PRIMARY',
    anchorId: available ? anchorId : null,
    anchorAvailable: available,
    snapshot: {
      snapshotVersion: 1,
      anchorId,
      intentionText,
      category: 'career',
      planetaryTier: null,
      enhancedImageUrl: null,
      releasedAtUnlink: options.releasedAtUnlink ?? false,
      capturedAt: FIXTURE_PLOTTED_AT,
    },
    linkedAt: FIXTURE_PLOTTED_AT,
  };
}

function waypoint(
  id: string,
  state: WaypointState,
  overrides: Partial<WaypointSummary> = {},
): WaypointSummary {
  return {
    id,
    courseId: FIXTURE_COURSE_ID,
    position: WAYPOINT_ORDER.indexOf(id as (typeof WAYPOINT_ORDER)[number]),
    title: WAYPOINT_TITLES[id] ?? id.toUpperCase(),
    description: null,
    state,
    blockedReason: null,
    reachedAt: state === 'REACHED' ? FIXTURE_PLOTTED_AT : null,
    skippedAt: state === 'SKIPPED' ? FIXTURE_NOW : null,
    cancelledAt: state === 'CANCELLED' ? FIXTURE_NOW : null,
    anchorLink: null,
    ...overrides,
  };
}

function course(overrides: Partial<CourseDetail> = {}): CourseDetail {
  const waypoints = overrides.waypoints ?? activeWaypoints();
  const summary: CourseSummary = {
    id: FIXTURE_COURSE_ID,
    destinationText: FIXTURE_DESTINATION,
    status: 'ACTIVE',
    version: FIXTURE_COURSE_VERSION,
    currentWaypointId: WAYPOINT_IDS.current,
    waypointCount: waypoints.length,
    reachedCount: waypoints.filter(item => item.state === 'REACHED').length,
    plottedAt: FIXTURE_PLOTTED_AT,
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: null,
  };
  return { ...summary, ...overrides, waypoints };
}

/** The matrix default: start/100 reached, current current, 5k/10k upcoming. */
function activeWaypoints(): WaypointSummary[] {
  return [
    waypoint(WAYPOINT_IDS.start, 'REACHED'),
    waypoint(WAYPOINT_IDS.hundred, 'REACHED', {
      anchorLink: anchorLink(
        'link-100',
        'anchor-100',
        'I build in the open without flinching.',
      ),
    }),
    waypoint(WAYPOINT_IDS.current, 'CURRENT', {
      anchorLink: anchorLink('link-current', 'anchor-current', FIXTURE_DESTINATION),
    }),
    waypoint(WAYPOINT_IDS.fiveK, 'UPCOMING'),
    waypoint(WAYPOINT_IDS.tenK, 'UPCOMING'),
  ];
}

// ── Chart view state (the shape ChartHomeScreen reads from courseStore) ──────

export interface ChartViewState {
  activeCourse: CourseDetail | null;
  flags: ChartFeatureFlags;
  loading: boolean;
  refreshing: boolean;
  errorCode: ChartErrorCode | null;
  migrationRequired: boolean;
  readOnly: boolean;
  offline: boolean;
  stale: boolean;
  lastSyncedAt: string | null;
}

const ENABLED_FLAGS: ChartFeatureFlags = {
  chart_enabled: true,
  chart_write_enabled: true,
  chart_ai_planner_enabled: false,
  chart_reflections_enabled: true,
  chart_notifications_enabled: false,
  chart_existing_user_intro_enabled: false,
};

const DISABLED_FLAGS: ChartFeatureFlags = {
  chart_enabled: false,
  chart_write_enabled: false,
  chart_ai_planner_enabled: false,
  chart_reflections_enabled: false,
  chart_notifications_enabled: false,
  chart_existing_user_intro_enabled: false,
};

function viewState(overrides: Partial<ChartViewState> = {}): ChartViewState {
  return {
    activeCourse: null,
    flags: ENABLED_FLAGS,
    loading: false,
    refreshing: false,
    errorCode: null,
    migrationRequired: false,
    readOnly: false,
    offline: false,
    stale: false,
    lastSyncedAt: FIXTURE_NOW,
    ...overrides,
  };
}

// ── Expectations asserted per fixture ───────────────────────────────────────

/**
 * Controls the fixture is allowed to show. `never` entries are the corrected
 * prototype affordances from the gap report — a fixture asserting them absent is
 * how the contract stays enforced once real Chart UI lands.
 */
export interface FixtureExpectation {
  /** Course mutations permitted at all in this state. */
  mutationsAllowed: boolean;
  /** Practice may be launched (subject to entitlement). */
  practiceAllowed: boolean;
  /** Read navigation into detail/log works from cache. */
  readNavigationAllowed: boolean;
  /** Private encrypted reflection drafts can still be written. */
  localDraftAllowed: boolean;
  /** Copy the surface must present, verbatim from the matrix/visual spec. */
  copy: string | null;
  /** Waypoint states the fixture renders. */
  waypointStates: WaypointState[];
  /** Navigation the fixture is expected to produce, if any. */
  expectedNavigation: string | null;
}

export interface ChartFixture {
  name: string;
  state: ChartViewState;
  expectation: FixtureExpectation;
}

const NEVER_ALLOWED_CONTROLS = [
  'MAKE THIS CURRENT',
  'PAUSE COURSE',
  'RESUME COURSE',
  'SWITCH COURSE',
] as const;

export const FORBIDDEN_PROTOTYPE_CONTROLS: readonly string[] =
  NEVER_ALLOWED_CONTROLS;

/** `DESTINATION` must never appear as a WaypointState anywhere. */
export const VALID_WAYPOINT_STATES: readonly WaypointState[] = [
  'UPCOMING',
  'CURRENT',
  'REACHED',
  'BLOCKED',
  'SKIPPED',
  'CANCELLED',
];

function expectation(
  overrides: Partial<FixtureExpectation> = {},
): FixtureExpectation {
  return {
    mutationsAllowed: true,
    practiceAllowed: true,
    readNavigationAllowed: true,
    localDraftAllowed: true,
    copy: null,
    waypointStates: [],
    expectedNavigation: null,
    ...overrides,
  };
}

// ── The 20 matrix fixtures ──────────────────────────────────────────────────

export const CHART_FIXTURES: Record<string, ChartFixture> = {
  empty: {
    name: 'empty',
    state: viewState({ activeCourse: null }),
    expectation: expectation({
      practiceAllowed: false,
      copy: 'Where are you going?',
      expectedNavigation: 'CourseSetup',
    }),
  },

  loading: {
    name: 'loading',
    // No cache means no `lastSyncedAt`, and the store derives
    // `stale = !lastSyncedAt || age > CHART_STALE_AFTER_MS`. That is what makes
    // mutations fail closed during the first load: there is no version to send.
    state: viewState({ loading: true, lastSyncedAt: null, stale: true }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      readNavigationAllowed: false,
      copy: 'Loading Chart',
      expectedNavigation: null,
    }),
  },

  'draft-setup': {
    name: 'draft-setup',
    state: viewState({
      activeCourse: course({
        status: 'DRAFT',
        version: 1,
        currentWaypointId: null,
        waypoints: [
          waypoint(WAYPOINT_IDS.start, 'UPCOMING'),
          waypoint(WAYPOINT_IDS.hundred, 'UPCOMING'),
        ],
      }),
    }),
    expectation: expectation({
      practiceAllowed: false,
      waypointStates: ['UPCOMING'],
      expectedNavigation: 'CourseEditor',
    }),
  },

  'active-current': {
    name: 'active-current',
    state: viewState({ activeCourse: course() }),
    expectation: expectation({
      copy: '2 of 5 waypoints reached',
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  /**
   * The matrix `reached` row where the next waypoint already carries a primary
   * Anchor link, so practice is available on it immediately. The un-anchored
   * form of the same transition is `reached-next-unlinked`; per D10 both are
   * valid and neither is blocked.
   */
  reached: {
    name: 'reached',
    state: viewState({
      activeCourse: course({
        version: FIXTURE_COURSE_VERSION + 1,
        currentWaypointId: WAYPOINT_IDS.fiveK,
        waypoints: [
          waypoint(WAYPOINT_IDS.start, 'REACHED'),
          waypoint(WAYPOINT_IDS.hundred, 'REACHED'),
          waypoint(WAYPOINT_IDS.current, 'REACHED'),
          waypoint(WAYPOINT_IDS.fiveK, 'CURRENT', {
            anchorLink: anchorLink('link-5k', 'anchor-5k', 'The channel repeats without me.'),
          }),
          waypoint(WAYPOINT_IDS.tenK, 'UPCOMING'),
        ],
      }),
    }),
    expectation: expectation({
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'ChartHome',
    }),
  },

  /**
   * The same transition when the next waypoint has never had an Anchor linked.
   *
   * Decision D10 (docs/chart/PHASE_0_D10_DECISION.md): this waypoint is CURRENT,
   * not BLOCKED. `BLOCKED` is reserved for a link that existed and stopped
   * working — the only case that emits WAYPOINT_BLOCKED. The absence of an
   * Anchor is carried by `anchorLink: null`, not by a state, so the frozen
   * six-value WaypointState union is untouched.
   *
   * Consequences asserted here: reach and skip stay available (the Course is
   * never stuck), while practice is unavailable until an Anchor is linked.
   */
  'reached-next-unlinked': {
    name: 'reached-next-unlinked',
    state: viewState({
      activeCourse: course({
        version: FIXTURE_COURSE_VERSION + 1,
        currentWaypointId: WAYPOINT_IDS.fiveK,
        waypoints: [
          waypoint(WAYPOINT_IDS.start, 'REACHED'),
          waypoint(WAYPOINT_IDS.hundred, 'REACHED'),
          waypoint(WAYPOINT_IDS.current, 'REACHED'),
          waypoint(WAYPOINT_IDS.fiveK, 'CURRENT', {
            blockedReason: null,
            anchorLink: null,
          }),
          waypoint(WAYPOINT_IDS.tenK, 'UPCOMING'),
        ],
      }),
    }),
    expectation: expectation({
      // Practice needs an Anchor to focus on; reach/skip do not.
      practiceAllowed: false,
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  'current-blocked': {
    name: 'current-blocked',
    state: viewState({
      activeCourse: course({
        waypoints: [
          waypoint(WAYPOINT_IDS.start, 'REACHED'),
          waypoint(WAYPOINT_IDS.hundred, 'REACHED'),
          waypoint(WAYPOINT_IDS.current, 'BLOCKED', {
            blockedReason: 'ANCHOR_RELEASED',
            // Burn closed the link but the snapshot survives as history.
            anchorLink: anchorLink(
              'link-current',
              'anchor-current',
              FIXTURE_DESTINATION,
              { available: false, releasedAtUnlink: true },
            ),
          }),
          waypoint(WAYPOINT_IDS.fiveK, 'UPCOMING'),
          waypoint(WAYPOINT_IDS.tenK, 'UPCOMING'),
        ],
      }),
    }),
    expectation: expectation({
      practiceAllowed: false,
      waypointStates: ['REACHED', 'BLOCKED', 'UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  upcoming: {
    name: 'upcoming',
    state: viewState({ activeCourse: course() }),
    expectation: expectation({
      practiceAllowed: false,
      waypointStates: ['UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  skipped: {
    name: 'skipped',
    state: viewState({
      activeCourse: course({
        version: FIXTURE_COURSE_VERSION + 1,
        waypoints: [
          waypoint(WAYPOINT_IDS.start, 'REACHED'),
          waypoint(WAYPOINT_IDS.hundred, 'REACHED'),
          waypoint(WAYPOINT_IDS.current, 'CURRENT'),
          waypoint(WAYPOINT_IDS.fiveK, 'SKIPPED'),
          waypoint(WAYPOINT_IDS.tenK, 'UPCOMING'),
        ],
      }),
    }),
    expectation: expectation({
      waypointStates: ['REACHED', 'CURRENT', 'SKIPPED', 'UPCOMING'],
      expectedNavigation: 'CourseLog',
    }),
  },

  cancelled: {
    name: 'cancelled',
    state: viewState({
      activeCourse: course({
        version: FIXTURE_COURSE_VERSION + 1,
        waypoints: [
          waypoint(WAYPOINT_IDS.start, 'REACHED'),
          waypoint(WAYPOINT_IDS.hundred, 'REACHED'),
          waypoint(WAYPOINT_IDS.current, 'CURRENT'),
          waypoint(WAYPOINT_IDS.fiveK, 'CANCELLED'),
          waypoint(WAYPOINT_IDS.tenK, 'UPCOMING'),
        ],
      }),
    }),
    expectation: expectation({
      copy: 'Waypoint removed from the course',
      waypointStates: ['REACHED', 'CURRENT', 'CANCELLED', 'UPCOMING'],
      expectedNavigation: 'CourseLog',
    }),
  },

  completed: {
    name: 'completed',
    state: viewState({
      activeCourse: course({
        status: 'COMPLETED',
        currentWaypointId: null,
        completedAt: FIXTURE_NOW,
        waypoints: WAYPOINT_ORDER.map(id => waypoint(id, 'REACHED')),
      }),
    }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      copy: 'Completion is confirmed by the server.',
      waypointStates: ['REACHED'],
      expectedNavigation: 'CompletedJourney',
    }),
  },

  archived: {
    name: 'archived',
    state: viewState({
      activeCourse: course({
        status: 'ARCHIVED',
        currentWaypointId: null,
        archivedAt: FIXTURE_NOW,
        // Archiving clears the pointer, so the former current waypoint derives
        // back to UPCOMING — there is no CURRENT without a pointer.
        waypoints: [
          waypoint(WAYPOINT_IDS.start, 'REACHED'),
          waypoint(WAYPOINT_IDS.hundred, 'REACHED'),
          waypoint(WAYPOINT_IDS.current, 'UPCOMING'),
          waypoint(WAYPOINT_IDS.fiveK, 'UPCOMING'),
          waypoint(WAYPOINT_IDS.tenK, 'UPCOMING'),
        ],
      }),
      readOnly: true,
    }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      waypointStates: ['REACHED', 'UPCOMING'],
      expectedNavigation: 'CourseDetails',
    }),
  },

  stale: {
    name: 'stale',
    state: viewState({
      activeCourse: course(),
      stale: true,
      lastSyncedAt: new Date(FIXTURE_NOW_MS - 6 * 60 * 1000).toISOString(),
    }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  offline: {
    name: 'offline',
    state: viewState({ activeCourse: course(), offline: true, readOnly: true }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      localDraftAllowed: true,
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  'entitlement-locked': {
    name: 'entitlement-locked',
    state: viewState({ activeCourse: course() }),
    expectation: expectation({
      practiceAllowed: false,
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'Paywall',
    }),
  },

  'network-error-cached': {
    name: 'network-error-cached',
    state: viewState({ activeCourse: course(), errorCode: 'NETWORK' }),
    expectation: expectation({
      mutationsAllowed: false,
      copy: 'Chart could not refresh. Cached data remains available.',
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  'not-found': {
    name: 'not-found',
    state: viewState({ activeCourse: null, errorCode: 'COURSE_NOT_FOUND' }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      readNavigationAllowed: false,
      copy: 'That Course is no longer available.',
      expectedNavigation: 'ChartHome',
    }),
  },

  'version-conflict': {
    name: 'version-conflict',
    state: viewState({
      activeCourse: course({ version: FIXTURE_COURSE_VERSION + 3 }),
      errorCode: 'COURSE_VERSION_CONFLICT',
    }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      copy: 'This Course changed elsewhere. Your view has been refreshed.',
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: 'WaypointDetail',
    }),
  },

  'migration-required': {
    name: 'migration-required',
    state: viewState({
      activeCourse: null,
      migrationRequired: true,
      readOnly: true,
    }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      readNavigationAllowed: false,
      copy: 'Chart needs to finish preparing your account.',
      expectedNavigation: null,
    }),
  },

  'repair-required': {
    name: 'repair-required',
    state: viewState({
      // needsRepair means the pointer cannot be trusted, so the fixture keeps
      // the server-returned pointer but forbids every mutation. The client must
      // not infer a replacement current waypoint locally.
      activeCourse: course({ needsRepair: true }),
      readOnly: true,
    }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      waypointStates: ['REACHED', 'CURRENT', 'UPCOMING'],
      expectedNavigation: null,
    }),
  },

  'chart-disabled': {
    name: 'chart-disabled',
    state: viewState({ activeCourse: null, flags: DISABLED_FLAGS }),
    expectation: expectation({
      mutationsAllowed: false,
      practiceAllowed: false,
      readNavigationAllowed: false,
      localDraftAllowed: false,
      expectedNavigation: 'Vault',
    }),
  },
};

// ── Deep-link fixtures (unknown targets) ────────────────────────────────────

export const UNKNOWN_DEEP_LINK_TARGETS = {
  unknownCourse: {
    kind: 'course' as const,
    courseId: 'course-does-not-exist',
    expectedErrorCode: 'COURSE_NOT_FOUND' as ChartErrorCode,
  },
  unknownWaypoint: {
    kind: 'waypoint' as const,
    courseId: FIXTURE_COURSE_ID,
    waypointId: 'wp-does-not-exist',
    expectedErrorCode: 'WAYPOINT_NOT_FOUND' as ChartErrorCode,
  },
};

// ── Log fixtures ────────────────────────────────────────────────────────────

export function logEntry(
  overrides: Partial<CourseLogEntry> & Pick<CourseLogEntry, 'id' | 'eventType'>,
): CourseLogEntry {
  return {
    message: '',
    waypointId: null,
    occurredAt: FIXTURE_NOW,
    recordedAt: FIXTURE_NOW,
    snapshot: null,
    reflection: null,
    practiceSession: null,
    anchorLink: null,
    ...overrides,
  };
}

export const CHART_FIXTURE_NAMES = Object.keys(CHART_FIXTURES);
