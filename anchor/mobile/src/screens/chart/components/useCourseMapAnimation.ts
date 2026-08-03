import { useEffect, useRef, useState } from 'react';
import type { WaypointSummary } from '@/types/chart';
import type { RouteAdvancement } from './courseMapTypes';

export const ADVANCEMENT_ANIMATION_MS = 900;

/**
 * Blocked waypoints never animate (Part 7 of the contract). If the
 * advancement's next waypoint is BLOCKED in the current props snapshot, the
 * trigger is suppressed entirely before it ever reaches the animation hook.
 */
export function resolveSafeAdvancement(
  advancement: RouteAdvancement | null | undefined,
  waypoints: WaypointSummary[],
): RouteAdvancement | null | undefined {
  if (!advancement || !advancement.nextWaypointId) return advancement;
  const next = waypoints.find((w) => w.id === advancement.nextWaypointId);
  return next?.state === 'BLOCKED' ? null : advancement;
}

export type CourseMapAdvancementState = {
  isAdvancing: boolean;
  completedWaypointId: string | null;
  nextWaypointId: string | null;
  courseCompleted: boolean;
};

const IDLE: CourseMapAdvancementState = {
  isAdvancing: false,
  completedWaypointId: null,
  nextWaypointId: null,
  courseCompleted: false,
};

/**
 * Owns only the transient "is a route-advancement animation currently
 * playing" boundary. It never mutates Course/Waypoint data — the props
 * already reflect the committed post-transition state; this hook just
 * decides, for `ADVANCEMENT_ANIMATION_MS`, whether to show the settle/
 * illuminate/halo-appear sequence instead of jumping straight to it.
 *
 * Dedupes by `eventId` so rerenders (parent re-render, unrelated prop
 * change) never replay an animation, and never plays a stale/cached
 * transition it has already handled.
 */
export function useCourseMapAdvancement(
  advancement: RouteAdvancement | null | undefined,
  reducedMotion: boolean,
): CourseMapAdvancementState {
  const handledEventIds = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<RouteAdvancement | null>(null);

  useEffect(() => {
    if (!advancement) return;
    if (handledEventIds.current.has(advancement.eventId)) return;
    handledEventIds.current.add(advancement.eventId);

    if (reducedMotion) {
      // Instant state replacement — no transient animating phase at all.
      return;
    }

    setActive(advancement);
    const timer = setTimeout(() => {
      setActive((current) => (current?.eventId === advancement.eventId ? null : current));
    }, ADVANCEMENT_ANIMATION_MS);

    return () => clearTimeout(timer);
  }, [advancement, reducedMotion]);

  if (!active) return IDLE;

  return {
    isAdvancing: true,
    completedWaypointId: active.completedWaypointId,
    nextWaypointId: active.nextWaypointId,
    courseCompleted: active.courseCompleted,
  };
}
