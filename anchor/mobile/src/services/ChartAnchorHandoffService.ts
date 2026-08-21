import { useAuthStore } from '@/stores/authStore';
import { useCourseStore } from '@/stores/courseStore';
import {
  getFreshChartAnchorHandoff,
  useChartJourneyStore,
} from '@/stores/chartJourneyStore';
import type { ChartPracticeContext } from '@/types/practice';
import { canViewChart } from '@/types/chart';

export type ChartAnchorHandoffResult =
  | { status: 'none' }
  | { status: 'linked'; chartContext: ChartPracticeContext }
  | { status: 'stale' | 'unavailable' };

function activeHandoffMatches(accountId: string, linkIdempotencyKey: string): boolean {
  const state = useChartJourneyStore.getState();
  return state.accountId === accountId &&
    state.anchorCreationHandoff?.linkIdempotencyKey === linkIdempotencyKey;
}

function clearHandoffIfOwned(accountId: string, linkIdempotencyKey: string): void {
  if (activeHandoffMatches(accountId, linkIdempotencyKey)) {
    useChartJourneyStore.getState().clearAnchorCreation();
  }
}

export function cancelChartAnchorCreationHandoff(
  accountId: string,
  courseId: string,
  waypointId: string,
  linkIdempotencyKey?: string,
): void {
  if (useAuthStore.getState().user?.id !== accountId) return;
  const handoff = getFreshChartAnchorHandoff(accountId);
  if (
    !handoff ||
    handoff.courseId !== courseId ||
    handoff.waypointId !== waypointId ||
    (linkIdempotencyKey && handoff.linkIdempotencyKey !== linkIdempotencyKey)
  ) return;
  clearHandoffIfOwned(accountId, handoff.linkIdempotencyKey);
}

function accountStillActive(accountId: string): boolean {
  return useAuthStore.getState().user?.id === accountId &&
    useChartJourneyStore.getState().accountId === accountId;
}

/**
 * Completes the identifier-only handoff from canonical Anchor creation back
 * into Chart. The Course is refetched before the link so a restored creation
 * flow cannot attach to a deleted, promoted, or cross-account waypoint.
 * Ownership remains server-authoritative in the existing link endpoint.
 */
export async function completeChartAnchorCreation(
  anchorId: string,
): Promise<ChartAnchorHandoffResult> {
  const user = useAuthStore.getState().user;
  const accountId = user?.id;
  if (!accountId) return { status: 'none' };
  const handoff = getFreshChartAnchorHandoff(accountId);
  if (!handoff) return { status: 'none' };

  if (!canViewChart(user.chartFlags, user.chartCapabilities) || user.chartCapabilities?.canEditCourse !== true) {
    clearHandoffIfOwned(accountId, handoff.linkIdempotencyKey);
    return { status: 'stale' };
  }

  const courseStore = useCourseStore.getState();
  courseStore.bindAccount(accountId);
  courseStore.setFeatureFlags(user.chartFlags);
  const course = await courseStore.fetchCourseDetail(handoff.courseId);
  if (!accountStillActive(accountId) || !activeHandoffMatches(accountId, handoff.linkIdempotencyKey)) {
    return { status: 'none' };
  }
  const waypoint = course?.waypoints.find((item) => item.id === handoff.waypointId);
  if (
    !course ||
    course.status !== 'ACTIVE' ||
    course.currentWaypointId !== handoff.waypointId ||
    !waypoint ||
    (waypoint.state !== 'CURRENT' && waypoint.state !== 'BLOCKED')
  ) {
    clearHandoffIfOwned(accountId, handoff.linkIdempotencyKey);
    return { status: 'stale' };
  }

  // A previous request may have committed while its response was lost. The
  // authoritative refetch is enough to finish the handoff; rebuilding the
  // same-key request with a new replaceLinkId would correctly conflict.
  if (waypoint.anchorLink?.anchorAvailable && waypoint.anchorLink.anchorId === anchorId) {
    useChartJourneyStore.getState().markAnchorLinked(anchorId, course.version);
    return {
      status: 'linked',
      chartContext: {
        courseId: course.id,
        waypointId: waypoint.id,
        courseVersion: course.version,
      },
    };
  }
  if (
    (waypoint.anchorLink?.id ?? null) !== handoff.observedAnchorLinkId ||
    (waypoint.anchorLink?.anchorId ?? null) !== handoff.observedAnchorId
  ) {
    // A different device changed the link while the Anchor was being created.
    // Never silently replace that newer decision with a stale creation flow.
    clearHandoffIfOwned(accountId, handoff.linkIdempotencyKey);
    return { status: 'stale' };
  }

  const linked = await useCourseStore.getState().linkAnchor(course.id, {
    idempotencyKey: handoff.linkIdempotencyKey,
    expectedCourseVersion: course.version,
    anchorId,
    role: 'WAYPOINT_PRIMARY',
    waypointId: waypoint.id,
    ...(waypoint.anchorLink ? { replaceLinkId: waypoint.anchorLink.id } : {}),
  });
  if (!accountStillActive(accountId) || !activeHandoffMatches(accountId, handoff.linkIdempotencyKey)) {
    return { status: 'none' };
  }
  if (!linked) {
    const code = useCourseStore.getState().errorCode;
    if (code === 'COURSE_NOT_FOUND' || code === 'WAYPOINT_NOT_FOUND' || code === 'ANCHOR_LINK_INVALID' || code === 'ANCHOR_UNAVAILABLE') {
      clearHandoffIfOwned(accountId, handoff.linkIdempotencyKey);
      return { status: 'stale' };
    }
    // Keep the same link key and identifier-only handoff for a safe retry after
    // transient network/version recovery.
    return { status: 'unavailable' };
  }

  useChartJourneyStore.getState().markAnchorLinked(anchorId, linked.version);
  return {
    status: 'linked',
    chartContext: {
      courseId: linked.id,
      waypointId: waypoint.id,
      courseVersion: linked.version,
    },
  };
}

export function finishChartAnchorPracticeHandoff(
  courseId: string,
  waypointId: string,
  anchorId: string,
): void {
  const accountId = useAuthStore.getState().user?.id;
  if (!accountId) return;
  const handoff = getFreshChartAnchorHandoff(accountId);
  if (
    handoff?.courseId === courseId &&
    handoff.waypointId === waypointId &&
    handoff.anchorId === anchorId
  ) {
    cancelChartAnchorCreationHandoff(accountId, courseId, waypointId, handoff.linkIdempotencyKey);
  }
}
