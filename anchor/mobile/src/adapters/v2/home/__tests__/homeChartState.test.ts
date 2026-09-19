import { resolveHomeChartState, type HomeChartResolutionInput } from '../chartAdapter';
import { makeAnchor } from './fixtures';
import type { CourseDetail, CourseSummary } from '@/types/chart';

const anchor = makeAnchor({ id: 'anchor-1', localId: 'anchor-1' });
const otherAnchorId = 'anchor-2';

const summary = (overrides: Partial<CourseSummary> = {}): CourseSummary =>
  ({
    id: 'course-1',
    destinationText: 'Reach 1,000 active users',
    status: 'ACTIVE',
    version: 1,
    currentWaypointId: 'wp-2',
    waypointCount: 2,
    reachedCount: 1,
    plottedAt: '',
    completedAt: null,
    archivedAt: null,
    destinationAnchorLink: { anchorId: 'anchor-1' } as never,
    ...overrides,
  }) as CourseSummary;

const detail = (overrides: Partial<CourseDetail> = {}): CourseDetail =>
  ({
    ...summary(),
    waypoints: [
      { id: 'wp-1', position: 0, state: 'REACHED', title: 'Ship beta' } as never,
      { id: 'wp-2', position: 1, state: 'CURRENT', title: 'Contact 3 creators' } as never,
    ],
    ...overrides,
  }) as CourseDetail;

const input = (overrides: Partial<HomeChartResolutionInput> = {}): HomeChartResolutionInput => ({
  anchor,
  chartEnabled: true,
  accountId: 'user-1',
  courseAccountId: 'user-1',
  initializationStatus: 'ready',
  courses: [],
  activeCourse: null,
  errorCode: null,
  ...overrides,
});

describe('resolveHomeChartState — absence is never loading', () => {
  it('is ABSENT, not loading, when the store is initialized and no Course exists', () => {
    expect(resolveHomeChartState(input())).toEqual({ state: 'none' });
  });

  it('is ABSENT when the account has an active Course that is linked to a different Anchor', () => {
    const foreign = detail({ destinationAnchorLink: { anchorId: otherAnchorId } as never });
    const state = resolveHomeChartState(input({ courses: [foreign], activeCourse: foreign }));
    expect(state).toEqual({ state: 'none' });
  });

  /**
   * The exact production defect: the Chart feature flag is off, so
   * `courseStore.refresh()` returns immediately and `initializationStatus`
   * stays `hydrating` forever. Home used to read that as "loading" and render
   * "Loading your current Course…" permanently on an Anchor with no Chart.
   */
  it('is ABSENT — never a permanent loading pill — when the Chart feature is disabled', () => {
    const state = resolveHomeChartState(input({ chartEnabled: false, initializationStatus: 'hydrating' }));
    expect(state).toEqual({ state: 'none' });
  });

  it('is RESOLVING (renders nothing) while the store has not initialized', () => {
    expect(resolveHomeChartState(input({ initializationStatus: 'idle' }))).toEqual({ state: 'resolving' });
    expect(resolveHomeChartState(input({ initializationStatus: 'hydrating' }))).toEqual({ state: 'resolving' });
  });

  it('is RESOLVING while the store still holds another account', () => {
    expect(resolveHomeChartState(input({ courseAccountId: 'other-user' }))).toEqual({ state: 'resolving' });
  });

  it('is RESOLVING — not absent — while an active Course exists but its links are unknown', () => {
    // Avoids a none -> ready flicker for an Anchor linked only via a waypoint.
    const state = resolveHomeChartState(input({ courses: [summary({ destinationAnchorLink: null })], activeCourse: null }));
    expect(state).toEqual({ state: 'resolving' });
  });

  it('is LOADING only when THIS Anchor is known to have a Course whose detail is in flight', () => {
    expect(resolveHomeChartState(input({ courses: [summary()], activeCourse: null }))).toEqual({ state: 'loading' });
  });

  it('is ERROR with a grounded message when a known relationship fails to load', () => {
    const state = resolveHomeChartState(input({ courses: [summary()], activeCourse: null, errorCode: 'NETWORK' }));
    expect(state).toEqual({ state: 'error', message: 'Your Chart could not be reached.' });
  });

  it('hides the section rather than showing an error when the failure concerns no known relationship', () => {
    expect(resolveHomeChartState(input({ errorCode: 'NETWORK' }))).toEqual({ state: 'none' });
  });

  it('is READY with the real Course when the loaded detail is linked to this Anchor', () => {
    const course = detail();
    const state = resolveHomeChartState(input({ courses: [course], activeCourse: course }));
    expect(state).toMatchObject({
      state: 'ready',
      courseId: 'course-1',
      destinationText: 'Reach 1,000 active users',
      nextMove: 'Contact 3 creators',
      currentWaypointId: 'wp-2',
    });
  });

  it('is ABSENT with no Anchor at all', () => {
    expect(resolveHomeChartState(input({ anchor: null }))).toEqual({ state: 'none' });
  });
});
