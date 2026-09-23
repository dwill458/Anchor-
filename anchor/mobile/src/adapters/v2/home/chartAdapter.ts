import type { Anchor } from '@/types';
import type { CourseDetail, CourseSummary, WaypointSummary } from '@/types/chart';
import type { ChartForAnchor, ChartRequestError } from '@/services/v2/chartV2Api';

/**
 * Chart context for Home, derived from the existing Course/Waypoint domain.
 * Read-only: it never advances waypoints, completes destinations, or writes
 * to CourseService.
 */
export type HomeChartState =
  /**
   * The Anchor has no Chart. Home renders nothing and the next section closes
   * the gap. This is an ABSENT state and is deliberately distinct from
   * `resolving`/`loading` below.
   */
  | { state: 'none' }
  /**
   * Whether a Chart relationship exists is not yet knowable (the Course store
   * has not bound this account or has not initialized). Home renders NOTHING
   * for this state — an unknown relationship must never appear as a loading
   * placeholder standing in for absence.
   */
  | { state: 'resolving' }
  /** A Chart relationship is KNOWN to exist and its detail is in flight. */
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      courseId: string;
      destinationText: string;
      nextMove: string | null;
      reachedCount: number;
      waypointCount: number;
      currentWaypointId: string | null;
      currentWaypointIndex: number | null;
      isFinished: boolean;
      waypoints: Array<{
        id: string;
        title: string;
        state: WaypointSummary['state'];
        reached: boolean;
        isCurrent: boolean;
        isDestination: boolean;
      }>;
    };

/**
 * The real One Move: the server's current Move. Never the waypoint title — a
 * waypoint is a state to reach, not an action.
 */
function oneMoveTitle(course: CourseDetail): string | null {
  if (!course.currentMoveId) return null;
  return course.moves?.find((move) => move.id === course.currentMoveId)?.title ?? null;
}

/** Anchor ids a Course link may legitimately point at. */
function anchorIdentitySet(anchor: Anchor): Set<string> {
  return new Set([anchor.id, anchor.localId].filter((value): value is string => Boolean(value)));
}

/**
 * Relationship check against a Course SUMMARY. A summary only carries the
 * destination link, so this can confirm a relationship but never rule one out
 * (a waypoint-only link is visible on the detail alone).
 */
export function courseSummaryMatchesAnchor(course: CourseSummary, anchor: Anchor): boolean {
  const link = course.destinationAnchorLink;
  if (!link || link.anchorId === null) return false;
  return anchorIdentitySet(anchor).has(link.anchorId);
}

export function courseMatchesAnchor(
  course: CourseDetail,
  anchor: Anchor,
  options?: { isOnlyActiveAnchor?: boolean },
): boolean {
  const anchorIds = anchorIdentitySet(anchor);
  const links = [
    course.destinationAnchorLink,
    ...course.waypoints.map((waypoint) => waypoint.anchorLink),
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));

  /**
   * Courses created before Anchor linking carry no relationship at all. They
   * are attributable only when the account has exactly one active Anchor, and
   * the caller has to say so — defaulting to `false` keeps the link-based rule
   * as the general case, so a Course is never shown against an Anchor it was
   * merely co-resident with.
   */
  if (links.length === 0) return options?.isOnlyActiveAnchor === true;
  return links.some((link) => link.anchorId !== null && anchorIds.has(link.anchorId));
}

export function toHomeChartState(course: CourseDetail | null | undefined): HomeChartState {
  if (!course || course.status !== 'ACTIVE') return { state: 'none' };
  const waypoints = [...(course.waypoints ?? [])]
    .filter((waypoint: WaypointSummary) => waypoint.state !== 'CANCELLED' && !waypoint.cancelledAt)
    .sort((a, b) => a.position - b.position);
  const currentWaypointIndex = course.currentWaypointId
    ? waypoints.findIndex((waypoint) => waypoint.id === course.currentWaypointId)
    : waypoints.findIndex((waypoint) => waypoint.state === 'CURRENT');
  const resolvedCurrentIndex = currentWaypointIndex >= 0 ? currentWaypointIndex : null;
  const reachedCount = waypoints.filter((waypoint) => waypoint.state === 'REACHED' || Boolean(waypoint.reachedAt)).length;
  const isFinished = waypoints.length > 0 && waypoints.every((waypoint) =>
    waypoint.state === 'REACHED' || Boolean(waypoint.reachedAt),
  );
  return {
    state: 'ready',
    courseId: course.id,
    destinationText: course.destinationText,
    nextMove: oneMoveTitle(course),
    reachedCount,
    waypointCount: waypoints.length,
      currentWaypointId: resolvedCurrentIndex === null ? null : waypoints[resolvedCurrentIndex].id,
    currentWaypointIndex: isFinished ? -1 : (resolvedCurrentIndex ?? -1),
    isFinished,
    waypoints: waypoints.map((waypoint, index) => ({
      id: waypoint.id,
      title: waypoint.title,
      state: waypoint.state,
      reached: waypoint.state === 'REACHED' || Boolean(waypoint.reachedAt),
      isCurrent: !isFinished && resolvedCurrentIndex === index,
      isDestination: index === waypoints.length - 1,
    })),
  };
}

export type HomeChartResolutionInput = {
  anchor: Anchor | null;
  /** `courseStore.flags.chart_enabled`. */
  chartEnabled: boolean;
  /** Signed-in account. */
  accountId: string | null;
  /** Account the Course store is currently bound to. */
  courseAccountId: string | null;
  initializationStatus: 'idle' | 'hydrating' | 'ready' | 'migrationRequired';
  courses: CourseSummary[];
  activeCourse: CourseDetail | null;
  errorCode: string | null;
  /**
   * True when the account has exactly one active Anchor, which is the only
   * condition under which an unlinked legacy Course may be attributed to it.
   */
  isOnlyActiveAnchor?: boolean;
};

/**
 * Resolves Home's Chart state from the real Course relationship.
 *
 * The rule the previous implementation violated: a Course store that is merely
 * busy is NOT evidence that this Anchor has a Chart. `resolving` (unknown) and
 * `none` (absent) both render nothing, so the section can never appear as a
 * "Loading your current Course…" pill on an Anchor that has no Course, and can
 * never flicker between absent and present while the detail loads.
 */
export function resolveHomeChartState(input: HomeChartResolutionInput): HomeChartState {
  const { anchor, chartEnabled, accountId, courseAccountId, initializationStatus, courses, activeCourse, errorCode, isOnlyActiveAnchor } = input;

  if (!anchor) return { state: 'none' };
  // Chart is switched off for this account: absent, not pending.
  if (!chartEnabled) return { state: 'none' };
  // The store still holds another account's (or no) data.
  if (courseAccountId !== accountId) return { state: 'resolving' };
  if (initializationStatus === 'idle' || initializationStatus === 'hydrating') return { state: 'resolving' };

  // A loaded detail linked to this Anchor is the only thing that can render.
  if (activeCourse && courseMatchesAnchor(activeCourse, anchor, { isOnlyActiveAnchor })) {
    const ready = toHomeChartState(activeCourse);
    if (ready.state === 'ready') return ready;
  }

  const activeSummary = courses.find((course) => course.status === 'ACTIVE') ?? null;

  // A KNOWN relationship whose detail has not arrived (or failed) — the only
  // case that earns a visible loading/error treatment with retry.
  if (activeSummary && (courseSummaryMatchesAnchor(activeSummary, anchor) || (isOnlyActiveAnchor === true && !activeSummary.destinationAnchorLink))) {
    if (errorCode) return { state: 'error', message: homeChartErrorMessage(errorCode) };
    return { state: 'loading' };
  }

  // An active Course exists for the account but its links are not yet known,
  // so this Anchor's relationship is still unknown rather than absent.
  if (activeSummary && !activeCourse) return { state: 'resolving' };

  return { state: 'none' };
}

/** Grounded, non-technical message for a Chart failure on a known relationship. */
export function homeChartErrorMessage(errorCode: string): string {
  if (errorCode === 'NETWORK') return 'Your Chart could not be reached.';
  if (errorCode === 'MIGRATION_REQUIRED') return 'Your Chart needs to be updated.';
  return 'Your Chart could not be loaded.';
}

/**
 * Home / Anchor Details Chart state from the per-Anchor Chart read model
 * (Anchor 2.0: one route per Anchor). Unknown renders nothing; a failed read
 * without a cached Chart also renders nothing rather than advertising Chart.
 */
export function resolveAnchorChartState(input: {
  data: ChartForAnchor | null;
  loading: boolean;
  error: ChartRequestError | null;
}): HomeChartState {
  if (!input.data) return input.loading ? { state: 'resolving' } : { state: 'none' };
  return toHomeChartState(input.data.chart);
}
