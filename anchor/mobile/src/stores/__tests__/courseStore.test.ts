import type { CourseSummary } from '@/types/chart';
import { useCourseStore } from '../courseStore';

const summary = (id: string, destinationText: string): CourseSummary => ({
  id,
  destinationText,
  status: 'ACTIVE',
  version: 1,
  currentWaypointId: null,
  waypointCount: 0,
  reachedCount: 0,
  plottedAt: '2026-08-03T00:00:00.000Z',
  completedAt: null,
  archivedAt: null,
  destinationAnchorLink: null,
});

describe('courseStore account scoping', () => {
  afterEach(() => {
    useCourseStore.getState().clearAccount();
  });

  it('clears the previous account Course before binding the next account', () => {
    useCourseStore.setState({
      accountId: 'account-a',
      courses: [summary('course-a', 'A private destination')],
    });

    useCourseStore.getState().bindAccount('account-b');

    expect(useCourseStore.getState().accountId).toBe('account-b');
    expect(useCourseStore.getState().courses).toEqual([]);
    expect(useCourseStore.getState().activeCourse).toBeNull();
    expect(useCourseStore.getState().courses.some((course) => course.destinationText === 'A private destination')).toBe(false);
  });
});
