import { toThreadPresentation, threadQualitativeLabel } from '../threadAdapter';
import { toHomeVisionState } from '../visionAdapter';
import { toHomeChartState } from '../chartAdapter';
import { makeAnchor } from './fixtures';
import type { VisualizationScene } from '@/types/practice';
import type { CourseDetail } from '@/types/chart';

describe('threadAdapter', () => {
  it('surfaces the stored value clamped, and performs no progression math', () => {
    const present = toThreadPresentation(makeAnchor({ threadStrength: 79 }));
    expect(present).toMatchObject({ value: 79, unmeasured: false });
    expect(present.delta).toBeUndefined();
    expect(present.trend).toBeUndefined();
    expect(present.previousValue).toBeUndefined();
    expect(toThreadPresentation(makeAnchor({ threadStrength: 140 })).value).toBe(100);
    expect(toThreadPresentation(makeAnchor({ threadStrength: -5 })).value).toBe(0);
  });

  it('marks an Anchor with no stored strength as unmeasured (never fabricates a value)', () => {
    const result = toThreadPresentation(makeAnchor({ threadStrength: undefined }));
    expect(result).toMatchObject({ value: null, unmeasured: true });
  });

  it('labels strength qualitatively without inventing movement', () => {
    expect(threadQualitativeLabel(50, false)).toBe('Taking shape');
    expect(threadQualitativeLabel(0, true)).toBe('Not yet measured');
    expect(threadQualitativeLabel(95, false)).toBe('Fully tensioned');
  });
});

describe('visionAdapter', () => {
  it('is "none" without a scene', () => {
    expect(toHomeVisionState(null)).toEqual({ state: 'none' });
    expect(toHomeVisionState(undefined)).toEqual({ state: 'none' });
  });

  it('is "ready" with the real text scene and never fabricates an image uri', () => {
    const scene = {
      id: 'scene-1',
      anchorId: 'anchor-1',
      currentText: 'A calm studio at dawn',
      originalSuggestion: 'studio',
    } as VisualizationScene;
    const result = toHomeVisionState(scene);
    expect(result).toEqual({ state: 'ready', visionId: 'scene-1', previewText: 'A calm studio at dawn' });
    expect((result as { previewUri?: string }).previewUri).toBeUndefined();
  });
});

describe('chartAdapter', () => {
  const course = (overrides: Partial<CourseDetail> = {}): CourseDetail =>
    ({
      id: 'course-1',
      destinationText: 'Reach 1,000 active users',
      status: 'ACTIVE',
      version: 1,
      currentWaypointId: 'wp-2',
      waypointCount: 5,
      reachedCount: 2,
      plottedAt: '',
      completedAt: null,
      archivedAt: null,
      destinationAnchorLink: null,
      waypoints: [
        { id: 'wp-1', position: 1, state: 'REACHED', reachedAt: '2026-09-01', title: 'Ship beta' } as never,
        { id: 'wp-2', position: 2, state: 'CURRENT', reachedAt: null, title: 'Contact 3 creators' } as never,
      ],
      ...overrides,
    }) as CourseDetail;

  it('is "none" without an active course', () => {
    expect(toHomeChartState(null)).toEqual({ state: 'none' });
    expect(toHomeChartState(course({ status: 'COMPLETED' }))).toEqual({ state: 'none' });
  });

  it('reads real destination + next move + progress and never advances anything', () => {
    expect(toHomeChartState(course())).toEqual({
      state: 'ready',
      courseId: 'course-1',
      destinationText: 'Reach 1,000 active users',
      nextMove: 'Contact 3 creators',
      reachedCount: 2,
      waypointCount: 2,
      currentWaypointId: 'wp-2',
      currentWaypointIndex: 1,
      isFinished: false,
      waypoints: [
        { id: 'wp-1', title: 'Ship beta', state: 'REACHED', reached: true, isCurrent: false, isDestination: false },
        { id: 'wp-2', title: 'Contact 3 creators', state: 'CURRENT', reached: false, isCurrent: true, isDestination: true },
      ],
    });
  });

  it('does not guess a current waypoint when the authoritative id is unresolved', () => {
    const result = toHomeChartState(course({ currentWaypointId: 'missing', waypointCount: 2, reachedCount: 1 }));
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') return;
    expect(result.nextMove).toBeNull();
    expect(result.currentWaypointIndex).toBe(-1);
    expect(result.waypoints.some((waypoint) => waypoint.isCurrent)).toBe(false);
  });

  it.each([2, 3, 5, 6])('preserves a real %i-waypoint route without a count fallback', (count) => {
    const waypoints = Array.from({ length: count }, (_, index) => ({
      id: `wp-${index + 1}`,
      position: index + 1,
      state: index === 0 ? 'REACHED' : index === 1 ? 'CURRENT' : 'UPCOMING',
      reachedAt: index === 0 ? '2026-09-01' : null,
      title: `Waypoint ${index + 1}`,
    }));
    const result = toHomeChartState(course({
      currentWaypointId: 'wp-2',
      waypointCount: count,
      reachedCount: 1,
      waypoints: waypoints as never,
    }));
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') return;
    expect(result.waypointCount).toBe(count);
    expect(result.waypoints).toHaveLength(count);
    expect(result.currentWaypointId).toBe('wp-2');
    expect(result.currentWaypointIndex).toBe(1);
  });
});
