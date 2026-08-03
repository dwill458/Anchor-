import { renderHook } from '@testing-library/react-native';
import type { WaypointSummary } from '@/types/chart';
import { ADVANCEMENT_ANIMATION_MS, resolveSafeAdvancement, useCourseMapAdvancement } from '../useCourseMapAnimation';
import type { RouteAdvancement } from '../courseMapTypes';

function waypoint(overrides: Partial<WaypointSummary> & Pick<WaypointSummary, 'id' | 'state'>): WaypointSummary {
  return {
    courseId: 'course-1',
    position: 1,
    title: 'Waypoint',
    description: null,
    blockedReason: null,
    reachedAt: null,
    skippedAt: null,
    cancelledAt: null,
    anchorLink: null,
    ...overrides,
  };
}

const advancement = (eventId: string, overrides: Partial<RouteAdvancement> = {}): RouteAdvancement => ({
  completedWaypointId: 'a',
  nextWaypointId: 'b',
  courseCompleted: false,
  eventId,
  ...overrides,
});

describe('resolveSafeAdvancement', () => {
  it('passes through when the next waypoint is not blocked', () => {
    const waypoints = [waypoint({ id: 'b', state: 'CURRENT' })];
    const trigger = advancement('e1');
    expect(resolveSafeAdvancement(trigger, waypoints)).toBe(trigger);
  });

  it('suppresses the trigger entirely when the next waypoint is BLOCKED', () => {
    const waypoints = [waypoint({ id: 'b', state: 'BLOCKED' })];
    expect(resolveSafeAdvancement(advancement('e1'), waypoints)).toBeNull();
  });

  it('passes through course-completing triggers with no next waypoint', () => {
    const trigger = advancement('e1', { nextWaypointId: null, courseCompleted: true });
    expect(resolveSafeAdvancement(trigger, [])).toBe(trigger);
  });

  it('passes through null/undefined unchanged', () => {
    expect(resolveSafeAdvancement(null, [])).toBeNull();
    expect(resolveSafeAdvancement(undefined, [])).toBeUndefined();
  });
});

describe('useCourseMapAdvancement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is idle with no advancement supplied', () => {
    const { result } = renderHook(() => useCourseMapAdvancement(null, false));
    expect(result.current.isAdvancing).toBe(false);
  });

  it('starts advancing when a new eventId is supplied and clears after the animation window', () => {
    const trigger = advancement('e1');
    const { result, rerender } = renderHook(({ adv }) => useCourseMapAdvancement(adv, false), {
      initialProps: { adv: trigger as typeof trigger | null },
    });

    expect(result.current.isAdvancing).toBe(true);
    expect(result.current.completedWaypointId).toBe('a');
    expect(result.current.nextWaypointId).toBe('b');

    jest.advanceTimersByTime(ADVANCEMENT_ANIMATION_MS + 50);
    rerender({ adv: trigger });
    expect(result.current.isAdvancing).toBe(false);
  });

  it('dedupes by eventId and never replays on rerender with the same event', () => {
    const trigger = advancement('e1');
    const { result, rerender } = renderHook(({ adv }) => useCourseMapAdvancement(adv, false), {
      initialProps: { adv: trigger as typeof trigger | null },
    });

    jest.advanceTimersByTime(ADVANCEMENT_ANIMATION_MS + 50);
    rerender({ adv: trigger });
    expect(result.current.isAdvancing).toBe(false);

    // Same eventId supplied again (e.g. parent re-render) must not replay.
    rerender({ adv: { ...trigger } });
    expect(result.current.isAdvancing).toBe(false);
  });

  it('starts a new animation only for a genuinely new eventId', () => {
    const first = advancement('e1');
    const second = advancement('e2', { completedWaypointId: 'b', nextWaypointId: 'c' });
    const { result, rerender } = renderHook(({ adv }) => useCourseMapAdvancement(adv, false), {
      initialProps: { adv: first as typeof first | null },
    });

    jest.advanceTimersByTime(ADVANCEMENT_ANIMATION_MS + 50);
    rerender({ adv: first });
    expect(result.current.isAdvancing).toBe(false);

    rerender({ adv: second });
    expect(result.current.isAdvancing).toBe(true);
    expect(result.current.completedWaypointId).toBe('b');
  });

  it('applies the new state instantly with no animating phase when reducedMotion is on', () => {
    const trigger = advancement('e1');
    const { result } = renderHook(() => useCourseMapAdvancement(trigger, true));
    expect(result.current.isAdvancing).toBe(false);
  });

  it('reports courseCompleted for a final advancement with no next waypoint', () => {
    const trigger = advancement('e1', { nextWaypointId: null, courseCompleted: true });
    const { result } = renderHook(() => useCourseMapAdvancement(trigger, false));
    expect(result.current.isAdvancing).toBe(true);
    expect(result.current.nextWaypointId).toBeNull();
    expect(result.current.courseCompleted).toBe(true);
  });

  it('clears its timer on unmount without leaking', () => {
    const trigger = advancement('e1');
    const { unmount } = renderHook(() => useCourseMapAdvancement(trigger, false));
    expect(() => {
      unmount();
      jest.advanceTimersByTime(ADVANCEMENT_ANIMATION_MS + 50);
    }).not.toThrow();
  });
});
