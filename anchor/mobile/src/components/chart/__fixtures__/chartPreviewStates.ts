import type { CourseDetail } from '@/types/chart';

/** Explicit fixtures for tests and the unregistered dev preview; never persisted. */
const normal: CourseDetail = {
  id: 'chart-preview-fixture', destinationText: 'Reach 1,000', status: 'ACTIVE', version: 1,
  currentWaypointId: 'w1', currentMoveId: 'm1', waypointCount: 5, reachedCount: 0,
  plottedAt: '2026-01-01T00:00:00Z', completedAt: null, archivedAt: null, destinationAnchorLink: null,
  waypoints: Array.from({ length: 5 }, (_, i) => ({
    id: `w${i + 1}`, courseId: 'chart-preview-fixture', position: i,
    title: i === 0 ? 'Build a steady audience' : `Waypoint ${i + 1}`, description: null,
    kind: 'METRIC', metric: { label: null, baseline: 84, current: i === 0 ? 254 : null, target: 1000 },
    state: i === 0 ? 'CURRENT' : 'UPCOMING', blockedReason: null,
    reachedAt: null, skippedAt: null, cancelledAt: null, anchorLink: null,
  })),
  moves: [{ id: 'm1', courseId: 'chart-preview-fixture', waypointId: 'w1',
    title: 'Publish one useful story', rationale: null, source: 'USER', status: 'ACTIVE',
    position: 0, isCurrent: true, completedAt: null, createdAt: '2026-01-01T00:00:00Z' }],
};

export const chartPreviewCourses: Record<'empty' | 'normal' | 'regressed' | 'reached' | 'complete', CourseDetail | null> = {
  empty: null,
  normal,
  regressed: { ...normal, waypoints: normal.waypoints.map((w, i) => i === 0
    ? { ...w, metric: { ...w.metric!, current: 54 } } : w) },
  reached: { ...normal, currentWaypointId: null, currentMoveId: null, reachedCount: 1,
    waypoints: normal.waypoints.map((w, i) => i === 0 ? { ...w, state: 'REACHED',
      reachedAt: '2026-01-02T00:00:00Z', metric: { ...w.metric!, current: 1000 } } : w) },
  complete: { ...normal, status: 'COMPLETED', currentWaypointId: null, reachedCount: 5,
    completedAt: '2026-01-02T00:00:00Z', waypoints: normal.waypoints.map(w => ({ ...w,
      state: 'REACHED', reachedAt: '2026-01-02T00:00:00Z', metric: { ...w.metric!, current: 1000 } })) },
};
